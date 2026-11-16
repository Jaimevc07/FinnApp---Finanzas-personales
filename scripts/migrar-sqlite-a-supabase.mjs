// Copia todos los datos de data/finanzas.db (SQLite) a Supabase (Postgres), conservando los ids.
// Uso: node --env-file=.env.local scripts/migrar-sqlite-a-supabase.mjs data/finanzas.db
// Opcional: DB_SCHEMA=prueba para copiar a otro esquema. BORRA lo que haya en Supabase antes de copiar.
import { DatabaseSync } from 'node:sqlite';
import postgres from 'postgres';

const archivo = process.argv[2];
const lite = new DatabaseSync(archivo, { readOnly: true });
const todas = sql => lite.prepare(sql).all().map(r => ({ ...r }));
const esquema = process.env.DB_SCHEMA;
const pg = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: 'require', onnotice: () => {}, ...(esquema ? { connection: { search_path: esquema } } : {}) });

const d = {
  config: todas('SELECT clave, valor FROM config'),
  periodos: todas('SELECT id, etiqueta, cobro, orden FROM periodos'),
  categorias: todas('SELECT id, nombre, seccion, control, orden, icono FROM categorias'),
  rubros: todas('SELECT id, categoria_id, nombre, orden, saldo_usd, saldo, tasa, recurrente, icono, cupo, cupo_de FROM rubros'),
  valores: todas('SELECT rubro_id, periodo_id, valor, auto FROM valores'),
  metas: todas('SELECT id, nombre, detalle, objetivo, periodo_objetivo, modo, ahorrado, rubro_id, orden, icono, pausada_desde, aporte_pausado FROM metas'),
  listas: todas('SELECT id, nombre, rubro_id, presupuesto, orden, icono FROM listas'),
  items: todas('SELECT id, lista_id, categoria, producto, cantidad, precio, estado, orden FROM items'),
  movimientos: todas('SELECT id, fecha, tipo, descripcion, categoria, medio, valor, creado, tarjeta_id FROM movimientos'),
};
// creado se guardaba en hora local de Colombia (UTC−5) sin zona
for (const m of d.movimientos) m.creado = m.creado ? `${m.creado.replace(' ', 'T')}-05:00` : new Date().toISOString();
const rubrosSinCupoDe = d.rubros.map(r => ({ ...r, cupo_de: null }));

await pg.begin(async tx => {
  for (const t of ['movimientos', 'items', 'listas', 'metas', 'valores', 'rubros', 'categorias', 'periodos', 'config']) await tx.unsafe(`DELETE FROM ${t}`);
  const ins = async (t, filas) => { for (let i = 0; i < filas.length; i += 500) if (filas.length) await tx`INSERT INTO ${tx(t)} ${tx(filas.slice(i, i + 500))}`; };
  await ins('config', d.config);
  await ins('periodos', d.periodos);
  await ins('categorias', d.categorias);
  await ins('rubros', rubrosSinCupoDe);
  for (const r of d.rubros.filter(x => x.cupo_de)) await tx`UPDATE rubros SET cupo_de = ${r.cupo_de} WHERE id = ${r.id}`;
  await ins('valores', d.valores);
  await ins('metas', d.metas);
  await ins('listas', d.listas);
  await ins('items', d.items);
  await ins('movimientos', d.movimientos);
  for (const t of ['categorias', 'rubros', 'metas', 'listas', 'items', 'movimientos']) {
    await tx.unsafe(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`);
  }
});

// Verificación: mismas cantidades y mismas sumas en las dos bases
let ok = true;
for (const [t, filas] of Object.entries(d)) {
  const [{ n }] = await pg.unsafe(`SELECT COUNT(*)::int AS n FROM ${t}`);
  const igual = n === filas.length;
  ok &&= igual;
  console.log(igual ? '✔' : '✘', t.padEnd(12), 'SQLite', String(filas.length).padStart(4), '→ Supabase', String(n).padStart(4));
}
const sumaLite = d.valores.reduce((s, v) => s + v.valor, 0);
const [{ s }] = await pg`SELECT COALESCE(SUM(valor), 0)::float8 AS s FROM valores`;
const sumaMov = d.movimientos.reduce((s, v) => s + v.valor, 0);
const [{ m }] = await pg`SELECT COALESCE(SUM(valor), 0)::float8 AS m FROM movimientos`;
console.log(Math.abs(sumaLite - s) < 0.01 ? '✔' : '✘', 'suma de valores', sumaLite, '→', s);
console.log(Math.abs(sumaMov - m) < 0.01 ? '✔' : '✘', 'suma de movimientos', sumaMov, '→', m);
ok &&= Math.abs(sumaLite - s) < 0.01 && Math.abs(sumaMov - m) < 0.01;
await pg.end();
console.log(ok ? '\nMIGRACIÓN OK' : '\nHAY DIFERENCIAS');
process.exit(ok ? 0 : 1);
