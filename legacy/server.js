// Servidor de Finanzas del Hogar: API REST + archivos estáticos, con SQLite nativo de Node (node:sqlite).
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');
const PORT = Number(process.env.PORT) || 4300;

mkdirSync(path.join(DIR, 'db'), { recursive: true });
const db = new DatabaseSync(path.join(DIR, 'db', 'finanzas.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec(readFileSync(path.join(DIR, 'db', 'schema.sql'), 'utf8'));

/* ---------- Datos iniciales (diagnóstico) ---------- */
const SEED = {
  config: { trm: 4200, salTope: 786424, salPost: 1350000, sobraReal: 0, ahorro: 0, metaMeses: 3, q1: '', q2: '' },
  ingresos: [['Jaime', 2700000], ['María', 3600000], ['Ingreso adicional', 1750000]],
  fijos: [['Maestría', 1800000], ['Casa (arriendo / cuota)', 700000], ['Mercado (carne + otros)', 650000],
          ['Luz', 450000], ['Internet', 300000], ['Moto', 263576], ['Agua y gas', 100000]],
  deudas: [['Tarjeta en dólares', 'USD', 500, 0], ['Tarjeta 1', 'COP', 1237991, 0], ['Tarjeta 2', 'COP', 1687162, 0]],
};

function seed() {
  db.exec('BEGIN');
  try {
    for (const t of ['config', 'ingresos', 'gastos_fijos', 'deudas', 'gastos', 'pasos']) db.exec(`DELETE FROM ${t}`);
    const c = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?)');
    for (const [k, v] of Object.entries(SEED.config)) c.run(k, String(v));
    const i = db.prepare('INSERT INTO ingresos (nombre, valor, orden) VALUES (?, ?, ?)');
    SEED.ingresos.forEach(([n, v], o) => i.run(n, v, o));
    const f = db.prepare('INSERT INTO gastos_fijos (nombre, valor, orden) VALUES (?, ?, ?)');
    SEED.fijos.forEach(([n, v], o) => f.run(n, v, o));
    const d = db.prepare('INSERT INTO deudas (nombre, moneda, saldo, interes, orden) VALUES (?, ?, ?, ?, ?)');
    SEED.deudas.forEach(([n, m, s, r], o) => d.run(n, m, s, r, o));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
if (db.prepare('SELECT COUNT(*) AS n FROM config').get().n === 0) seed();

/* ---------- Tablas editables (lista blanca de columnas) ---------- */
const TABLAS = {
  ingresos: { tabla: 'ingresos', cols: ['nombre', 'valor', 'orden'], orden: 'orden, id' },
  fijos:    { tabla: 'gastos_fijos', cols: ['nombre', 'valor', 'orden'], orden: 'orden, id' },
  deudas:   { tabla: 'deudas', cols: ['nombre', 'moneda', 'saldo', 'interes', 'orden'], orden: 'orden, id' },
  gastos:   { tabla: 'gastos', cols: ['fecha', 'descripcion', 'categoria', 'medio', 'valor'], orden: 'fecha DESC, id DESC' },
};

function estado() {
  const out = { config: {}, pasos: {} };
  for (const r of db.prepare('SELECT clave, valor FROM config').all()) out.config[r.clave] = r.valor;
  for (const r of db.prepare('SELECT clave, hecho FROM pasos').all()) out.pasos[r.clave] = !!r.hecho;
  for (const [k, t] of Object.entries(TABLAS)) out[k] = db.prepare(`SELECT * FROM ${t.tabla} ORDER BY ${t.orden}`).all();
  return out;
}

const limpiar = (t, body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => t.cols.includes(k)));

/* ---------- HTTP ---------- */
const send = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
const leerBody = req => new Promise((ok, fail) => {
  let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { fail(new Error('JSON no válido')); } });
});
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

async function api(req, res, partes) {
  const [recurso, id] = partes;
  const m = req.method;

  if (recurso === 'estado' && m === 'GET') return send(res, 200, estado());

  if (recurso === 'config' && m === 'PUT') {
    const body = await leerBody(req);
    const st = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
    for (const [k, v] of Object.entries(body)) if (k in SEED.config) st.run(k, String(v));
    return send(res, 200, { ok: true });
  }

  if (recurso === 'pasos' && id && m === 'PUT') {
    const { hecho } = await leerBody(req);
    db.prepare('INSERT INTO pasos (clave, hecho) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET hecho = excluded.hecho').run(id, hecho ? 1 : 0);
    return send(res, 200, { ok: true });
  }

  if (recurso === 'reset' && m === 'POST') { seed(); return send(res, 200, estado()); }

  if (recurso === 'importar' && m === 'POST') {
    const data = await leerBody(req);
    db.exec('BEGIN');
    try {
      for (const [k, t] of Object.entries(TABLAS)) {
        if (!Array.isArray(data[k])) continue;
        db.exec(`DELETE FROM ${t.tabla}`);
        for (const row of data[k]) {
          const r = limpiar(t, row); const cols = Object.keys(r);
          if (cols.length) db.prepare(`INSERT INTO ${t.tabla} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(r));
        }
      }
      const st = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
      for (const [k, v] of Object.entries(data.config || {})) if (k in SEED.config) st.run(k, String(v));
      db.exec('DELETE FROM pasos');
      for (const [k, v] of Object.entries(data.pasos || {})) db.prepare('INSERT INTO pasos (clave, hecho) VALUES (?, ?)').run(k, v ? 1 : 0);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return send(res, 200, estado());
  }

  const t = TABLAS[recurso];
  if (!t) return send(res, 404, { error: 'Recurso no encontrado' });

  if (m === 'GET' && !id) return send(res, 200, db.prepare(`SELECT * FROM ${t.tabla} ORDER BY ${t.orden}`).all());

  if (m === 'POST' && !id) {
    const r = limpiar(t, await leerBody(req)); const cols = Object.keys(r);
    if (!cols.length) return send(res, 400, { error: 'Faltan datos' });
    const info = db.prepare(`INSERT INTO ${t.tabla} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(r));
    return send(res, 201, db.prepare(`SELECT * FROM ${t.tabla} WHERE id = ?`).get(info.lastInsertRowid));
  }

  if (m === 'PUT' && id) {
    const r = limpiar(t, await leerBody(req)); const cols = Object.keys(r);
    if (!cols.length) return send(res, 400, { error: 'Faltan datos' });
    db.prepare(`UPDATE ${t.tabla} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(r), Number(id));
    return send(res, 200, db.prepare(`SELECT * FROM ${t.tabla} WHERE id = ?`).get(Number(id)));
  }

  if (m === 'DELETE' && id) {
    db.prepare(`DELETE FROM ${t.tabla} WHERE id = ?`).run(Number(id));
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: 'Método no permitido' });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url.pathname.slice(5).split('/').filter(Boolean).map(decodeURIComponent));
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT') { res.writeHead(404); return res.end('No encontrado'); }
    console.error(e); send(res, 500, { error: e.message });
  }
}).on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nEl puerto ${PORT} ya está en uso.`);
    console.error(`- Si la app ya está abierta en otra terminal, entra a http://localhost:${PORT}`);
    console.error(`- O usa otro puerto:  $env:PORT=4400; npm start\n`);
    process.exit(1);
  }
  throw e;
}).listen(PORT, () => console.log(`Finanzas del Hogar → http://localhost:${PORT}  (Ctrl+C para detener)`));
