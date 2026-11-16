// Conexión a Postgres (Supabase) por el pooler en modo transacción. Solo se importa desde el servidor.
// El esquema está en supabase/migrations. La API pública de Supabase no puede leer nada (RLS).
// Los datos de un cuaderno se leen y escriben con enCuaderno(): fija el cuaderno de la transacción y
// cambia al rol finanzas_app, que por RLS solo ve y cambia las filas de ese cuaderno.
import { AsyncLocalStorage } from 'node:async_hooks';
import postgres from 'postgres';
import semilla from '../semilla.json';
import { NOMBRE_CATEGORIA_AHORRO, type ModoRestablecer, type Seccion } from '../tipos';

export type Param = string | number | boolean | null;
export type Semilla = typeof semilla;

/* ---------- Conexión ---------- */
// En desarrollo Next recarga módulos: la conexión se guarda en globalThis para no abrir varias.
const g = globalThis as unknown as {
  __finanzasPg?: postgres.Sql; __finanzasTx?: AsyncLocalStorage<postgres.TransactionSql>;
};

function conexion(): postgres.Sql {
  if (!g.__finanzasPg) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL: la cadena de conexión de Supabase (pooler, puerto 6543)');
    const esquema = process.env.DB_SCHEMA?.replace(/[^a-z0-9_]/gi, '');
    g.__finanzasPg = postgres(url, {
      prepare: false, // el pooler en modo transacción no admite sentencias preparadas
      max: Number(process.env.DB_MAX_CONEXIONES) || 3,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require',
      onnotice: () => {},
      // Esquema alterno (p. ej. para pruebas). Por defecto: public.
      ...(esquema ? { connection: { search_path: esquema } } : {}),
    });
  }
  return g.__finanzasPg;
}

// Dentro de transaccion() todas las consultas usan la misma conexión (la de la transacción).
const enCurso = (g.__finanzasTx ??= new AsyncLocalStorage<postgres.TransactionSql>());
const actual = (): postgres.Sql => (enCurso.getStore() as unknown as postgres.Sql) ?? conexion();

/** Las consultas se escriben con "?" y se pasan a $1, $2… de Postgres. */
const aPg = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

export async function todas<T>(sql: string, ...p: Param[]): Promise<T[]> {
  return (await actual().unsafe(aPg(sql), p as never[])) as unknown as T[];
}
export async function una<T>(sql: string, ...p: Param[]): Promise<T | undefined> {
  return (await todas<T>(sql, ...p))[0];
}
/** Ejecuta y devuelve cuántas filas cambió. */
export async function ejecutar(sql: string, ...p: Param[]): Promise<number> {
  return (await actual().unsafe(aPg(sql), p as never[])).count;
}
/** INSERT que devuelve el id de la fila nueva. */
export async function insertar(sql: string, ...p: Param[]): Promise<number> {
  const r = await todas<{ id: number }>(`${sql} RETURNING id`, ...p);
  return Number(r[0].id);
}
/**
 * Inserta muchas filas en una sola consulta (o en pocas, por bloques).
 * "alFinal" se agrega tal cual, p. ej. un ON CONFLICT.
 */
export async function insertarVarios(tabla: string, cols: string[], filas: Param[][], alFinal = '') {
  const BLOQUE = 1000;
  for (let i = 0; i < filas.length; i += BLOQUE) {
    const parte = filas.slice(i, i + BLOQUE);
    const marcas = parte.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
    await ejecutar(`INSERT INTO ${tabla} (${cols.join(', ')}) VALUES ${marcas} ${alFinal}`, ...parte.flat());
  }
}

/** Todo o nada. Si ya hay una transacción en curso, se une a ella. */
export async function transaccion<T>(fn: () => Promise<T>): Promise<T> {
  if (enCurso.getStore()) return fn();
  return (await conexion().begin(tx => enCurso.run(tx, fn))) as T;
}

/**
 * Ejecuta fn dentro de una transacción "en" un cuaderno: Postgres solo deja ver y cambiar las filas
 * de ese cuaderno, y las filas nuevas quedan en él solas (cuaderno_id = app_cuaderno()).
 * Con comoApp = false se fija el cuaderno pero se conserva el usuario del servidor (para administrar
 * miembros e invitaciones, que se filtran a mano).
 */
export async function enCuaderno<T>(id: number, fn: () => Promise<T>, comoApp = true): Promise<T> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Cuaderno no válido');
  return (await conexion().begin(tx => enCurso.run(tx, async () => {
    await tx.unsafe(`SELECT set_config('app.cuaderno', $1, true)`, [String(id)]);
    if (comoApp) await tx.unsafe('SET LOCAL ROLE finanzas_app');
    return fn();
  }))) as T;
}

/* ---------- Ayudas compartidas ---------- */
export const NOMBRE_POR_SECCION: Record<Seccion, string> = {
  ahorro: NOMBRE_CATEGORIA_AHORRO, deuda: 'Deudas', evento: 'Eventos y viajes', operativo: 'Gastos del hogar', ingreso: 'Ingresos',
};

/** Primera categoría de una sección; si no hay ninguna, la crea con un nombre por defecto. */
export async function categoriaDeSeccion(seccion: Seccion): Promise<number> {
  const c = await una<{ id: number }>('SELECT id FROM categorias WHERE seccion = ? ORDER BY orden, id LIMIT 1', seccion);
  if (c) return c.id;
  const { m } = (await una<{ m: number }>('SELECT COALESCE(MAX(orden), -1) + 1 AS m FROM categorias'))!;
  let nombre = NOMBRE_POR_SECCION[seccion];
  if (await una('SELECT 1 FROM categorias WHERE nombre = ?', nombre)) nombre = `${nombre} (${seccion})`;
  return insertar('INSERT INTO categorias (nombre, seccion, orden) VALUES (?, ?, ?)', nombre, seccion, m);
}

export const categoriaAhorro = () => categoriaDeSeccion('ahorro');

/**
 * Marca como "solo algunos meses" los rubros que no se repiten: viajes, eventos y deudas,
 * y los ingresos o gastos con valor en menos de la mitad de los meses (primas, bonos, ingresos temporales).
 */
export async function marcarPuntuales() {
  await ejecutar(`
    UPDATE rubros SET recurrente = 0 WHERE id IN (
      SELECT r.id FROM rubros r JOIN categorias c ON c.id = r.categoria_id
      WHERE c.seccion IN ('evento', 'deuda')
         OR (c.seccion IN ('ingreso', 'operativo')
             AND (SELECT COUNT(*) FROM valores v WHERE v.rubro_id = r.id AND (v.valor > 0 OR v.auto = 1))
                 BETWEEN 1 AND ((SELECT COUNT(*) FROM periodos) - 1) / 2)
    )`);
}

/* ---------- Restablecer ---------- */
const TABLAS_DATOS = ['items', 'listas', 'metas', 'valores', 'rubros', 'categorias', 'periodos', 'config'];

/** Borra todo y carga los datos del Excel. */
export function sembrar(s: Semilla = semilla, conservarMovimientos = false) {
  return transaccion(async () => {
    if (!conservarMovimientos) await ejecutar('DELETE FROM movimientos');
    else await ejecutar('UPDATE movimientos SET tarjeta_id = NULL');
    for (const t of TABLAS_DATOS) await ejecutar(`DELETE FROM ${t}`);

    await insertarVarios('config', ['clave', 'valor'], [...Object.entries(s.config).map(([k, v]) => [k, String(v)]), ['metas_migradas', '1']]);
    await insertarVarios('periodos', ['id', 'etiqueta', 'cobro', 'orden'], s.periodos.map((x, i) => [x.id, x.etiqueta, x.cobro, i]));

    const idCat = new Map<string, number>();
    for (const [i, x] of s.categorias.entries()) {
      idCat.set(x.nombre, await insertar('INSERT INTO categorias (nombre, seccion, control, orden) VALUES (?, ?, ?, ?)', x.nombre, x.seccion, x.control ?? null, i));
    }

    const idRubro = new Map<string, number>();
    const valores: Param[][] = [];
    for (const [i, x] of s.rubros.entries()) {
      const id = await insertar('INSERT INTO rubros (categoria_id, nombre, orden, saldo_usd) VALUES (?, ?, ?, ?)', idCat.get(x.categoria)!, x.nombre, i, x.saldo_usd ?? null);
      idRubro.set(x.nombre, id);
      x.valores.forEach((val, j) => valores.push([id, s.periodos[j].id, val, (x.auto as number[]).includes(j) ? 1 : 0]));
    }
    await insertarVarios('valores', ['rubro_id', 'periodo_id', 'valor', 'auto'], valores);

    await insertarVarios('metas', ['nombre', 'detalle', 'objetivo', 'periodo_objetivo', 'modo', 'ahorrado', 'orden'],
      s.metas.map((x, i) => [x.nombre, x.detalle, x.objetivo, x.periodo_objetivo, x.modo, x.ahorrado, i]));

    for (const [i, x] of s.listas.entries()) {
      const id = await insertar('INSERT INTO listas (nombre, rubro_id, presupuesto, orden) VALUES (?, ?, ?, ?)', x.nombre, idRubro.get(x.rubro) ?? null, x.presupuesto, i);
      await insertarVarios('items', ['lista_id', 'categoria', 'producto', 'cantidad', 'precio', 'estado', 'orden'],
        x.items.map((y, j) => [id, y.categoria, y.producto, y.cantidad, y.precio, y.estado, j]));
    }
    await marcarPuntuales();
  });
}

/** Conserva la estructura (nombres) y deja todos los montos en $0. */
export function ponerEnCeros(conservarMovimientos: boolean) {
  return transaccion(async () => {
    await ejecutar('UPDATE valores SET valor = 0, auto = 0');
    await ejecutar('UPDATE rubros SET saldo = NULL, saldo_usd = NULL, tasa = NULL, cupo = NULL');
    await ejecutar('UPDATE metas SET objetivo = 0, ahorrado = 0');
    await ejecutar('UPDATE listas SET presupuesto = 0');
    await ejecutar(`UPDATE items SET precio = 0, estado = 'Pendiente'`);
    await ejecutar(`UPDATE config SET valor = '0' WHERE clave IN ('saldo_inicial','ingreso_2028','operativo_2028','cuota_carro_2028')`);
    if (!conservarMovimientos) await ejecutar('DELETE FROM movimientos');
  });
}

/** Borra rubros, deudas, metas, listas y movimientos. Quedan las categorías y los meses del plan. */
export function vaciar(conservarMovimientos: boolean) {
  return transaccion(async () => {
    for (const t of ['items', 'listas', 'metas', 'valores', 'rubros']) await ejecutar(`DELETE FROM ${t}`);
    if (!conservarMovimientos) await ejecutar('DELETE FROM movimientos');
    await ejecutar(`UPDATE config SET valor = '0' WHERE clave IN ('saldo_inicial','ingreso_2028','operativo_2028','cuota_carro_2028')`);
    await ejecutar(`UPDATE config SET valor = '' WHERE clave = 'nota_2028'`);
    await categoriaAhorro();
  });
}

export function restablecerDb(modo: ModoRestablecer, conservarMovimientos: boolean) {
  if (modo === 'excel') return sembrar(semilla, conservarMovimientos);
  if (modo === 'vacio') return vaciar(conservarMovimientos);
  return ponerEnCeros(conservarMovimientos);
}
