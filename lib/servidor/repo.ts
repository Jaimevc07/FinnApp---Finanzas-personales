// Lectura y escritura de datos (Postgres). Todas las mutaciones validan con listas blancas.
import {
  categoriaAhorro, categoriaDeSeccion, ejecutar, insertar, insertarVarios,
  marcarPuntuales, NOMBRE_POR_SECCION, restablecerDb, todas, transaccion, una, type Param,
} from './db';
import type { DatosPlantilla } from './plantilla';
import { quien } from './sesion';
import { planDeudas, valorCelda } from '../calculos';
import { cop } from '../formato';
import { cobroDe, esMes, etiquetaMes, mesAnterior, mesSiguiente } from '../meses';
import {
  CONFIG_NUMERICA, ESTADOS_COMPRA, SECCIONES,
  type Actividad, type Categoria, type Config, type DatosRubro, type Estado, type ItemLista, type Lista, type Meta,
  type Miembro, type ModoRestablecer, type Movimiento, type Periodo, type Rubro, type TipoActividad,
} from '../tipos';

type Fila = Record<string, unknown>;
const texto = (v: unknown, max = 160) => String(v ?? '').trim().slice(0, max);
const monto = (v: unknown) => Math.max(0, Number(v) || 0);
/** Día del mes 1–31 o nulo */
const diaDelMes = (v: unknown) => { const n = Math.round(Number(v)); return n >= 1 && n <= 31 ? n : null; };
const montoONulo = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.max(0, Number(v) || 0));
/** Clave de ícono (p. ej. "piggy-bank"); cualquier otra cosa queda en nulo = automático. */
const icono = (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v) ? v : null);
const siguienteOrden = async (tabla: string) => (await una<{ m: number }>(`SELECT COALESCE(MAX(orden), -1) + 1 AS m FROM ${tabla}`))!.m;
const UPSERT_VALOR = 'ON CONFLICT (rubro_id, periodo_id) DO UPDATE SET valor = excluded.valor, auto = excluded.auto';

/* ---------- Quién hizo qué ---------- */
/**
 * Deja constancia de un cambio a nombre del miembro de la sesión. Con "clave", si esa persona cambió
 * lo mismo hace poco (p. ej. la misma celda varias veces), se actualiza esa línea en vez de repetirla.
 */
export async function registrar(tipo: TipoActividad, accion: string, detalle = '', clave: string | null = null) {
  const q = quien();
  if (!q) return;
  if (clave) {
    const n = await ejecutar(`UPDATE actividad SET accion = ?, detalle = ?, fecha = now() WHERE id = (
      SELECT id FROM actividad WHERE cuaderno_id = app_cuaderno() AND usuario_id = ? AND clave = ? AND fecha > now() - interval '15 minutes' ORDER BY fecha DESC LIMIT 1)`,
    accion, detalle, q.id, clave);
    if (n) return;
  }
  await ejecutar('INSERT INTO actividad (usuario_id, nombre, tipo, accion, detalle, clave) VALUES (?, ?, ?, ?, ?, ?)', q.id, q.nombre, tipo, accion, detalle, clave);
}

/** Historial de cambios del hogar, del más reciente al más antiguo. */
export async function listarActividad(o: { limite?: number; usuario?: string | null; antes?: number | null } = {}): Promise<Actividad[]> {
  const limite = Math.min(200, Math.max(1, Math.round(Number(o.limite) || 50)));
  const filtros: string[] = [];
  const p: Param[] = [];
  if (o.usuario && /^[0-9a-f-]{36}$/i.test(o.usuario)) { filtros.push('usuario_id = ?'); p.push(o.usuario); }
  if (o.antes && Number.isInteger(o.antes)) { filtros.push('id < ?'); p.push(o.antes); }
  return todas<Actividad>(`SELECT id::int AS id, fecha, usuario_id::text AS usuario_id, nombre, tipo, accion, detalle FROM actividad
    ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limite}`, ...p);
}

const ARTICULO: Record<string, string> = { ingreso: 'el ingreso', operativo: 'el gasto', evento: 'el evento', deuda: 'la deuda', ahorro: 'el ahorro' };
const tipoDeSeccion = (seccion: string): TipoActividad => (seccion === 'deuda' ? 'deuda' : seccion === 'evento' ? 'plan' : 'presupuesto');
const rubroConSeccion = (id: number) => una<{ nombre: string; seccion: string }>(
  'SELECT r.nombre, c.seccion FROM rubros r JOIN categorias c ON c.id = r.categoria_id WHERE r.id = ?', id);
const etiquetaDe = async (periodoId: string) => (await una<{ etiqueta: string }>('SELECT etiqueta FROM periodos WHERE id = ?', periodoId))?.etiqueta ?? periodoId;

/** Todo el estado en una sola consulta (cada tabla llega como JSON). */
/** Los datos del cuaderno de la transacción (llamar dentro de enCuaderno). Miembros e invitaciones los agrega la API. */
export async function leerEstado(): Promise<Estado> {
  const r = (await una<{
    config: { clave: string; valor: string }[];
    valores: { rubro_id: number; periodo_id: string; valor: number; auto: number }[];
    periodos: Periodo[]; categorias: Categoria[]; rubros: (Omit<Rubro, 'recurrente'> & { recurrente: number })[];
    metas: Meta[]; listas: Lista[]; items: ItemLista[]; movimientos: Movimiento[];
  }>(`SELECT
    (SELECT COALESCE(json_agg(t ORDER BY t.clave), '[]') FROM (SELECT clave, valor FROM config) t) AS config,
    (SELECT COALESCE(json_agg(t), '[]') FROM (SELECT rubro_id, periodo_id, valor, auto FROM valores) t) AS valores,
    (SELECT COALESCE(json_agg(t ORDER BY t.orden), '[]') FROM (SELECT id, etiqueta, cobro, orden FROM periodos) t) AS periodos,
    (SELECT COALESCE(json_agg(t ORDER BY t.orden, t.id), '[]') FROM (SELECT id, nombre, seccion, control, orden, icono FROM categorias) t) AS categorias,
    (SELECT COALESCE(json_agg(t ORDER BY t.orden, t.id), '[]') FROM (
      SELECT id, categoria_id, nombre, orden, saldo_usd, saldo, tasa, cupo, cupo_de, dia_corte, dia_pago, recurrente, icono FROM rubros) t) AS rubros,
    (SELECT COALESCE(json_agg(t ORDER BY t.orden, t.id), '[]') FROM (
      SELECT id, nombre, detalle, objetivo, periodo_objetivo, modo, ahorrado, rubro_id, orden, icono, pausada_desde, aporte_pausado FROM metas) t) AS metas,
    (SELECT COALESCE(json_agg(t ORDER BY t.orden, t.id), '[]') FROM (SELECT id, nombre, rubro_id, presupuesto, orden, icono FROM listas) t) AS listas,
    (SELECT COALESCE(json_agg(t ORDER BY t.orden, t.id), '[]') FROM (
      SELECT id, lista_id, categoria, producto, cantidad, precio, estado, orden, creado_por, editado_por FROM items) t) AS items,
    (SELECT COALESCE(json_agg(t ORDER BY t.fecha DESC, t.id DESC), '[]') FROM (
      SELECT id, fecha, tipo, descripcion, categoria, medio, valor, tarjeta_id, rubro_id, creado, creado_por, editado_por, editado FROM movimientos) t) AS movimientos`))!;

  const config = { saldo_inicial: 0 } as Record<string, unknown>;
  for (const c of r.config) config[c.clave] = CONFIG_NUMERICA.includes(c.clave as keyof Config) ? Number(c.valor) || 0 : c.valor;
  const valores: Estado['valores'] = {};
  for (const v of r.valores) valores[`${v.rubro_id}:${v.periodo_id}`] = { valor: v.valor, auto: !!v.auto };
  return {
    config: config as Config,
    periodos: r.periodos,
    categorias: r.categorias,
    rubros: r.rubros.map(x => ({ ...x, recurrente: !!x.recurrente })),
    valores,
    metas: r.metas,
    listas: r.listas,
    items: r.items,
    movimientos: r.movimientos,
    miembros: [],
  };
}

/* ---------- Configuración ---------- */
const CLAVES_CONFIG: (keyof Config)[] = ['hogar', 'trm', 'trm_referencia', 'saldo_inicial', 'ingreso_2028', 'operativo_2028', 'cuota_carro_2028', 'nota_2028'];
const NOMBRE_CONFIG: Record<keyof Config, string> = {
  hogar: 'nombre del hogar', trm: 'TRM', trm_referencia: 'TRM de referencia', saldo_inicial: 'saldo inicial',
  ingreso_2028: 'ingresos después del plan', operativo_2028: 'gasto después del plan', cuota_carro_2028: 'cuotas después del plan', nota_2028: 'nota',
};
export async function guardarConfig(body: Fila, conRegistro = true) {
  const filas = Object.entries(body)
    .filter(([k]) => CLAVES_CONFIG.includes(k as keyof Config))
    .map(([k, v]) => [k, CONFIG_NUMERICA.includes(k as keyof Config) ? String(Number(v) || 0) : texto(v, 200)]);
  if (!filas.length) return;
  await insertarVarios('config', ['clave', 'valor'], filas, 'ON CONFLICT (cuaderno_id, clave) DO UPDATE SET valor = excluded.valor');
  if (conRegistro) {
    const cambios = filas.map(([k, v]) => `${NOMBRE_CONFIG[k as keyof Config]}: ${CONFIG_NUMERICA.includes(k as keyof Config) && k !== 'trm' && k !== 'trm_referencia' ? cop(Number(v)) : v}`);
    await registrar('ajustes', 'cambió la configuración', cambios.join(' · '), `config:${filas.map(f => f[0]).sort().join(',')}`);
  }
}

/* ---------- Celdas del presupuesto ---------- */
const periodos = () => todas<Periodo>('SELECT * FROM periodos ORDER BY orden');

export async function guardarCelda(b: { rubroId: number; periodoId: string; valor?: number; auto?: boolean; propagar?: boolean }) {
  const lista = await periodos();
  const idx = lista.findIndex(p => p.id === b.periodoId);
  if (idx < 0) throw new Error('Mes no encontrado');
  const objetivo = b.propagar ? lista.slice(idx) : [lista[idx]];
  await insertarVarios('valores', ['rubro_id', 'periodo_id', 'valor', 'auto'],
    objetivo.map(p => [Number(b.rubroId), p.id, monto(b.valor), b.auto ? 1 : 0]), UPSERT_VALOR);
  const r = await rubroConSeccion(Number(b.rubroId));
  if (r) {
    const valor = b.auto ? 'automático (TRM)' : cop(monto(b.valor));
    await registrar(tipoDeSeccion(r.seccion), `cambió «${r.nombre}» en ${lista[idx].etiqueta}`,
      b.propagar && objetivo.length > 1 ? `${valor} de ${lista[idx].etiqueta} en adelante` : valor, `celda:${b.rubroId}:${b.periodoId}`);
  }
}

/** Reemplaza todos los valores de un rubro (los meses que no vienen quedan en 0). */
async function escribirValores(rubroId: number, valores: Record<string, unknown>, autos: unknown) {
  const auto = new Set(Array.isArray(autos) ? autos.map(String) : []);
  const lista = await periodos();
  if (!lista.length) return;
  await insertarVarios('valores', ['rubro_id', 'periodo_id', 'valor', 'auto'],
    lista.map(p => [rubroId, p.id, monto(valores[p.id]), auto.has(p.id) ? 1 : 0]), UPSERT_VALOR);
}

/** "Usa el cupo de" otra deuda: valida que exista y, si esa también comparte, apunta a la principal. */
async function cupoCompartido(id: number | null, v: unknown): Promise<number | null> {
  const n = Number(v) || 0;
  if (!n || n === id) return null;
  const r = await una<{ cupo_de: number | null }>('SELECT cupo_de FROM rubros WHERE id = ?', n);
  if (!r) throw new Error('Tarjeta no encontrada');
  const raiz = r.cupo_de ?? n;
  return raiz === id ? null : raiz;
}

/* ---------- Rubros (incluye deudas, eventos y aportes) ---------- */
export async function crearRubro(b: DatosRubro & Fila): Promise<number> {
  let categoria = Number(b.categoria_id ?? b.categoriaId);
  return transaccion(async () => {
    // Sin categoría pero con sección (p. ej. la primera deuda tras "Borrar todo"): usa o crea una.
    if (!categoria && SECCIONES.includes(b.seccion as Categoria['seccion'])) categoria = await categoriaDeSeccion(b.seccion as Categoria['seccion']);
    const cat = await una<{ seccion: string }>('SELECT seccion FROM categorias WHERE id = ?', categoria || 0);
    if (!cat) throw new Error('Categoría no encontrada');
    // Viajes, eventos y deudas son de unos meses; lo demás se repite salvo que se diga lo contrario.
    const recurrente = 'recurrente' in b ? !!b.recurrente : !['evento', 'deuda'].includes(cat.seccion);
    const comparte = await cupoCompartido(null, b.cupo_de);
    const id = await insertar('INSERT INTO rubros (categoria_id, nombre, orden, saldo, saldo_usd, tasa, cupo, cupo_de, recurrente, icono, dia_corte, dia_pago) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      categoria, texto(b.nombre, 120) || 'Nuevo rubro', await siguienteOrden('rubros'), montoONulo(b.saldo), montoONulo(b.saldo_usd), montoONulo(b.tasa),
      comparte ? null : montoONulo(b.cupo), comparte, recurrente ? 1 : 0, icono(b.icono), diaDelMes(b.dia_corte), diaDelMes(b.dia_pago));
    await escribirValores(id, (b.valores as Record<string, unknown>) ?? {}, b.autos);
    await registrar(tipoDeSeccion(cat.seccion), `agregó ${ARTICULO[cat.seccion] ?? 'el rubro'} «${texto(b.nombre, 120) || 'Nuevo rubro'}»`);
    return id;
  });
}

export async function actualizarRubro(id: number, b: DatosRubro & Fila) {
  await transaccion(async () => {
    if (b.nombre !== undefined) await ejecutar('UPDATE rubros SET nombre = ? WHERE id = ?', texto(b.nombre, 120) || 'Rubro', id);
    if (b.categoria_id !== undefined) {
      if (!(await una('SELECT 1 FROM categorias WHERE id = ?', Number(b.categoria_id) || 0))) throw new Error('Categoría no encontrada');
      await ejecutar('UPDATE rubros SET categoria_id = ? WHERE id = ?', Number(b.categoria_id), id);
    }
    for (const k of ['dia_corte', 'dia_pago'] as const) {
      if (k in b) await ejecutar(`UPDATE rubros SET ${k} = ? WHERE id = ?`, diaDelMes(b[k]), id);
    }
    for (const k of ['saldo', 'saldo_usd', 'tasa', 'cupo'] as const) {
      if (k in b) await ejecutar(`UPDATE rubros SET ${k} = ? WHERE id = ?`, montoONulo(b[k]), id);
    }
    if ('cupo_de' in b) {
      const comparte = await cupoCompartido(id, b.cupo_de);
      // Una deuda que usa el cupo de otra no tiene cupo propio; y las que usaban el suyo pasan a la principal.
      if (comparte) {
        await ejecutar('UPDATE rubros SET cupo_de = ?, cupo = NULL WHERE id = ?', comparte, id);
        await ejecutar('UPDATE rubros SET cupo_de = ? WHERE cupo_de = ?', comparte, id);
      } else {
        await ejecutar('UPDATE rubros SET cupo_de = NULL WHERE id = ?', id);
      }
    }
    if ('recurrente' in b) await ejecutar('UPDATE rubros SET recurrente = ? WHERE id = ?', b.recurrente ? 1 : 0, id);
    if ('icono' in b) await ejecutar('UPDATE rubros SET icono = ? WHERE id = ?', icono(b.icono), id);
    if (b.valores) await escribirValores(id, b.valores as Record<string, unknown>, b.autos);
    const r = await rubroConSeccion(id);
    const NOMBRES: Record<string, string> = {
      nombre: 'nombre', categoria_id: 'categoría', saldo: 'saldo', saldo_usd: 'saldo en dólares', tasa: 'interés', cupo: 'cupo',
      cupo_de: 'cupo compartido', dia_corte: 'día de corte', dia_pago: 'día de pago', recurrente: 'frecuencia', icono: 'ícono', valores: 'montos',
    };
    const cambios = Object.keys(NOMBRES).filter(k => k in b && (b as Fila)[k] !== undefined).map(k => NOMBRES[k]);
    if (r) await registrar(tipoDeSeccion(r.seccion), `editó ${ARTICULO[r.seccion] ?? 'el rubro'} «${r.nombre}»`, cambios.length ? `Cambió: ${cambios.join(', ')}` : '', `rubro:${id}`);
  });
}

/** Borra un rubro (sin dejar constancia: lo usan otras acciones que ya la dejan). */
export async function borrarRubro(id: number) {
  await ejecutar('DELETE FROM rubros WHERE id = ?', id);
}

/** Borra un rubro pedido por alguien desde la app. */
export async function eliminarRubro(id: number) {
  const r = await rubroConSeccion(id);
  await borrarRubro(id);
  if (r) await registrar(tipoDeSeccion(r.seccion), `eliminó ${ARTICULO[r.seccion] ?? 'el rubro'} «${r.nombre}»`);
}

/* ---------- Categorías ---------- */
export async function crearCategoria(b: Fila) {
  const seccion = String(b.seccion);
  if (!SECCIONES.includes(seccion as Categoria['seccion'])) throw new Error('Sección no válida');
  const nombre = texto(b.nombre, 80);
  if (!nombre) throw new Error('Escribe un nombre');
  if (await una('SELECT 1 FROM categorias WHERE nombre = ?', nombre)) throw new Error('Ya existe una categoría con ese nombre');
  await ejecutar('INSERT INTO categorias (nombre, seccion, control, orden, icono) VALUES (?, ?, ?, ?, ?)',
    nombre, seccion, b.control ? texto(b.control, 20) : null, await siguienteOrden('categorias'), icono(b.icono));
  await registrar(tipoDeSeccion(seccion), `creó la categoría «${nombre}»`);
}

export async function actualizarCategoria(id: number, b: Fila) {
  await transaccion(async () => {
    if (b.nombre !== undefined) {
      const nombre = texto(b.nombre, 80);
      if (!nombre) throw new Error('Escribe un nombre');
      if (await una('SELECT 1 FROM categorias WHERE nombre = ? AND id <> ?', nombre, id)) throw new Error('Ya existe una categoría con ese nombre');
      const anterior = (await una<{ nombre: string }>('SELECT nombre FROM categorias WHERE id = ?', id))?.nombre;
      await ejecutar('UPDATE categorias SET nombre = ? WHERE id = ?', nombre, id);
      // Los movimientos guardan el nombre de la categoría: se renombran con ella para no perderlos del "plan vs real".
      if (anterior && anterior !== nombre) await ejecutar('UPDATE movimientos SET categoria = ? WHERE categoria = ?', nombre, anterior);
    }
    if ('control' in b) await ejecutar('UPDATE categorias SET control = ? WHERE id = ?', b.control ? texto(b.control, 20) : null, id);
    if ('icono' in b) await ejecutar('UPDATE categorias SET icono = ? WHERE id = ?', icono(b.icono), id);
    const c = await una<{ nombre: string; seccion: string }>('SELECT nombre, seccion FROM categorias WHERE id = ?', id);
    if (c) await registrar(tipoDeSeccion(c.seccion), `editó la categoría «${c.nombre}»`, '', `categoria:${id}`);
  });
}

export async function borrarCategoria(id: number) {
  const c = await una<{ nombre: string; seccion: string }>('SELECT nombre, seccion FROM categorias WHERE id = ?', id);
  await ejecutar('DELETE FROM categorias WHERE id = ?', id); // borra sus rubros en cascada
  if (c) await registrar(tipoDeSeccion(c.seccion), `eliminó la categoría «${c.nombre}» y sus rubros`);
}

/* ---------- Metas ---------- */
function datosMeta(b: Fila) {
  const modo = b.modo === 'caja' ? 'caja' : 'aportes';
  // El mes objetivo puede ser cualquiera (también después del plan, p. ej. una casa en 2030).
  const per = b.periodo_objetivo ? String(b.periodo_objetivo) : null;
  if (per && !esMes(per)) throw new Error('Mes objetivo no válido');
  return {
    nombre: texto(b.nombre, 80) || 'Meta',
    detalle: texto(b.detalle, 120),
    objetivo: monto(b.objetivo),
    periodo_objetivo: per,
    modo,
    ahorrado: monto(b.ahorrado),
    icono: icono(b.icono),
  };
}

/** Crea o actualiza el rubro de aportes de una meta (sección ahorro). */
async function sincronizarAportes(metaId: number, nombre: string, modo: string, aportes: unknown) {
  const actual = (await una<{ rubro_id: number | null }>('SELECT rubro_id FROM metas WHERE id = ?', metaId))?.rubro_id ?? null;
  if (modo === 'caja') {
    if (actual) await borrarRubro(actual); // ya no se ahorra con aportes: se quitan del presupuesto
    return;
  }
  let rubro = actual && (await una('SELECT 1 FROM rubros WHERE id = ?', actual)) ? actual : null;
  if (!rubro) {
    rubro = await insertar('INSERT INTO rubros (categoria_id, nombre, orden) VALUES (?, ?, ?)',
      await categoriaAhorro(), `Ahorro · ${nombre}`, await siguienteOrden('rubros'));
    await ejecutar('UPDATE metas SET rubro_id = ? WHERE id = ?', rubro, metaId);
    await escribirValores(rubro, {}, []);
  } else {
    await ejecutar('UPDATE rubros SET nombre = ? WHERE id = ?', `Ahorro · ${nombre}`, rubro);
  }
  if (aportes && typeof aportes === 'object') await escribirValores(rubro, aportes as Record<string, unknown>, []);
}

export async function crearMeta(b: Fila) {
  const m = datosMeta(b);
  await transaccion(async () => {
    const id = await insertar('INSERT INTO metas (nombre, detalle, objetivo, periodo_objetivo, modo, ahorrado, orden, icono) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      m.nombre, m.detalle, m.objetivo, m.periodo_objetivo, m.modo, m.ahorrado, await siguienteOrden('metas'), m.icono);
    await sincronizarAportes(id, m.nombre, m.modo, b.aportes);
    await registrar('meta', `creó la meta «${m.nombre}»`, `${cop(m.objetivo)}${m.periodo_objetivo ? ` para ${etiquetaMes(m.periodo_objetivo)}` : ''}`);
  });
}

export async function actualizarMeta(id: number, b: Fila) {
  const m = datosMeta(b);
  await transaccion(async () => {
    await ejecutar('UPDATE metas SET nombre = ?, detalle = ?, objetivo = ?, periodo_objetivo = ?, modo = ?, ahorrado = ?, icono = ? WHERE id = ?',
      m.nombre, m.detalle, m.objetivo, m.periodo_objetivo, m.modo, m.ahorrado, m.icono, id);
    await sincronizarAportes(id, m.nombre, m.modo, b.aportes);
    await registrar('meta', `editó la meta «${m.nombre}»`, `${cop(m.objetivo)}${m.periodo_objetivo ? ` para ${etiquetaMes(m.periodo_objetivo)}` : ''}`, `meta:${id}`);
  });
}

/**
 * Pausa una meta desde un mes: sus aportes de ese mes en adelante quedan en 0 (se libera esa plata
 * en el presupuesto) y, si es "con lo que sobra", deja de reservar caja. Lo ahorrado se conserva.
 */
export async function pausarMeta(id: number, b: Fila) {
  const desde = String(b.desde ?? '');
  if (!esMes(desde)) throw new Error('Mes no válido');
  const m = await una<{ nombre: string; rubro_id: number | null; pausada_desde: string | null }>('SELECT nombre, rubro_id, pausada_desde FROM metas WHERE id = ?', id);
  if (!m) throw new Error('Meta no encontrada');
  if (m.pausada_desde) return;
  await transaccion(async () => {
    let aporte = 0;
    if (m.rubro_id) {
      aporte = (await una<{ valor: number }>('SELECT valor FROM valores WHERE rubro_id = ? AND periodo_id >= ? AND valor > 0 ORDER BY periodo_id LIMIT 1', m.rubro_id, desde))?.valor
        ?? (await una<{ valor: number }>('SELECT valor FROM valores WHERE rubro_id = ? AND valor > 0 ORDER BY periodo_id DESC LIMIT 1', m.rubro_id))?.valor ?? 0;
      await ejecutar('UPDATE valores SET valor = 0, auto = 0 WHERE rubro_id = ? AND periodo_id >= ?', m.rubro_id, desde);
    }
    await ejecutar('UPDATE metas SET pausada_desde = ?, aporte_pausado = ? WHERE id = ?', desde, aporte || null, id);
    await registrar('meta', `pausó la meta «${m.nombre}»`, `Desde ${etiquetaMes(desde)}`);
  });
}

/** Reanuda una meta: vuelve a programar el aporte mensual desde un mes hasta el mes objetivo. */
export async function reanudarMeta(id: number, b: Fila) {
  const desde = String(b.desde ?? '');
  if (!esMes(desde)) throw new Error('Mes no válido');
  const m = await una<{ nombre: string; modo: string; periodo_objetivo: string | null; rubro_id: number | null }>(
    'SELECT nombre, modo, periodo_objetivo, rubro_id FROM metas WHERE id = ?', id);
  if (!m) throw new Error('Meta no encontrada');
  await transaccion(async () => {
    await ejecutar('UPDATE metas SET pausada_desde = NULL, aporte_pausado = NULL WHERE id = ?', id);
    const aporte = Math.round(monto(b.aporte));
    await registrar('meta', `reanudó la meta «${m.nombre}»`, m.modo === 'aportes' ? `${cop(aporte)}/mes desde ${etiquetaMes(desde)}` : '');
    if (m.modo !== 'aportes') return;
    // Los meses anteriores a "desde" conservan lo que tenían; de "desde" al objetivo, el aporte nuevo.
    const previos: Record<string, number> = {};
    if (m.rubro_id) {
      for (const v of await todas<{ periodo_id: string; valor: number }>('SELECT periodo_id, valor FROM valores WHERE rubro_id = ?', m.rubro_id)) previos[v.periodo_id] = v.valor;
    }
    const aportes = Object.fromEntries((await periodos()).map(p => [p.id,
      p.id < desde ? previos[p.id] ?? 0 : (!m.periodo_objetivo || p.id <= m.periodo_objetivo ? aporte : 0)]));
    await sincronizarAportes(id, m.nombre, m.modo, aportes);
  });
}

export async function borrarMeta(id: number) {
  await transaccion(async () => {
    const m = await una<{ nombre: string; rubro_id: number | null }>('SELECT nombre, rubro_id FROM metas WHERE id = ?', id);
    await ejecutar('DELETE FROM metas WHERE id = ?', id);
    if (m?.rubro_id) await borrarRubro(m.rubro_id);
    if (m) await registrar('meta', `eliminó la meta «${m.nombre}»`);
  });
}

/* ---------- Listas de compras ---------- */
async function datosLista(b: Fila) {
  const rubro = b.rubro_id ? Number(b.rubro_id) : null;
  if (rubro && !(await una('SELECT 1 FROM rubros WHERE id = ?', rubro))) throw new Error('Rubro no encontrado');
  return { nombre: texto(b.nombre, 80) || 'Lista', rubro_id: rubro, presupuesto: rubro ? 0 : monto(b.presupuesto), icono: icono(b.icono) };
}
const nombreLista = async (id: number) => (await una<{ nombre: string }>('SELECT nombre FROM listas WHERE id = ?', id))?.nombre ?? 'la lista';

export async function crearLista(b: Fila, conRegistro = true): Promise<number> {
  const l = await datosLista(b);
  const id = await insertar('INSERT INTO listas (nombre, rubro_id, presupuesto, orden, icono) VALUES (?, ?, ?, ?, ?)',
    l.nombre, l.rubro_id, l.presupuesto, await siguienteOrden('listas'), l.icono);
  if (conRegistro) await registrar('lista', `creó la lista «${l.nombre}»`);
  return id;
}
export async function actualizarLista(id: number, b: Fila) {
  const l = await datosLista(b);
  await ejecutar('UPDATE listas SET nombre = ?, rubro_id = ?, presupuesto = ?, icono = ? WHERE id = ?', l.nombre, l.rubro_id, l.presupuesto, l.icono, id);
  await registrar('lista', `editó la lista «${l.nombre}»`, '', `lista:${id}`);
}
export async function borrarLista(id: number) {
  const nombre = await nombreLista(id);
  await ejecutar('DELETE FROM listas WHERE id = ?', id); // borra sus productos en cascada
  await registrar('lista', `eliminó la lista «${nombre}»`);
}
export async function reiniciarLista(id: number) {
  await ejecutar(`UPDATE items SET estado = 'Pendiente' WHERE lista_id = ?`, id);
  await registrar('lista', `empezó de nuevo la lista «${await nombreLista(id)}»`, 'Todos los productos quedaron pendientes');
}

/* Grupos de una lista ("Proteínas y Lácteos"): son la categoría de texto de sus productos. */
export async function renombrarGrupo(listaId: number, de: unknown, a: unknown) {
  const nuevo = texto(a);
  if (!nuevo) throw new Error('Escribe el nombre del grupo');
  if (!(await una('SELECT 1 FROM listas WHERE id = ?', listaId))) throw new Error('Lista no encontrada');
  // Si ya existe un grupo con ese nombre, los productos se unen a él.
  await ejecutar('UPDATE items SET categoria = ? WHERE lista_id = ? AND categoria = ?', nuevo, listaId, String(de ?? ''));
  await registrar('lista', `renombró el grupo «${String(de ?? '')}» a «${nuevo}»`, await nombreLista(listaId));
}
export async function borrarGrupo(listaId: number, nombre: unknown) {
  const n = await ejecutar('DELETE FROM items WHERE lista_id = ? AND categoria = ?', listaId, String(nombre ?? ''));
  await registrar('lista', `eliminó el grupo «${String(nombre ?? '')}»`, `${await nombreLista(listaId)} · ${n} ${n === 1 ? 'producto' : 'productos'}`);
}

/* ---------- Tablas simples: movimientos e ítems de listas ---------- */
const TABLAS = {
  movimientos: {
    cols: ['fecha', 'tipo', 'descripcion', 'categoria', 'medio', 'valor', 'tarjeta_id', 'rubro_id'],
    async validar(r: Fila) {
      if ('tipo' in r && r.tipo !== 'ingreso' && r.tipo !== 'egreso') throw new Error('Tipo no válido');
      if ('fecha' in r && !/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha))) throw new Error('Fecha no válida');
      if (r.tarjeta_id != null && !(await una('SELECT 1 FROM rubros WHERE id = ?', Number(r.tarjeta_id)))) throw new Error('Tarjeta no encontrada');
      if (r.rubro_id != null && !(await una('SELECT 1 FROM rubros WHERE id = ?', Number(r.rubro_id)))) throw new Error('Ítem del presupuesto no encontrado');
    },
  },
  items: {
    cols: ['lista_id', 'categoria', 'producto', 'cantidad', 'precio', 'estado', 'orden'],
    async validar(r: Fila) {
      if ('estado' in r && !ESTADOS_COMPRA.includes(r.estado as ItemLista['estado'])) throw new Error('Estado no válido');
      if ('lista_id' in r && !(await una('SELECT 1 FROM listas WHERE id = ?', Number(r.lista_id)))) throw new Error('Lista no encontrada');
    },
  },
} as const;
export type TablaSimple = keyof typeof TABLAS;

async function limpiar(t: TablaSimple, body: Fila) {
  const def = TABLAS[t];
  const r = Object.fromEntries(
    Object.entries(body ?? {}).filter(([k]) => (def.cols as readonly string[]).includes(k)),
  ) as Record<string, Param>;
  for (const k of ['valor', 'cantidad', 'precio', 'lista_id']) if (k in r) r[k] = monto(r[k]);
  if ('orden' in r) r.orden = Math.round(monto(r.orden));
  // Sin tarjeta (o medio distinto de tarjeta de crédito) = nulo
  if ('tarjeta_id' in r) r.tarjeta_id = Number(r.tarjeta_id) > 0 ? Number(r.tarjeta_id) : null;
  if ('rubro_id' in r) r.rubro_id = Number(r.rubro_id) > 0 ? Number(r.rubro_id) : null;
  for (const k of ['descripcion', 'categoria', 'producto', 'medio', 'fecha', 'tipo', 'estado']) if (k in r) r[k] = texto(r[k]);
  await def.validar(r);
  return r;
}

const ESTADO_TEXTO: Record<string, string> = { Comprado: 'comprado', Pendiente: 'pendiente', Ajustar: 'por ajustar' };
const tipoMov = (tipo: unknown) => (tipo === 'ingreso' ? 'ingreso' : 'egreso');

export async function crear(t: TablaSimple, body: Fila, conRegistro = true) {
  const r = await limpiar(t, body);
  if (t === 'items') {
    if (!r.lista_id) throw new Error('Falta la lista');
    if (!r.producto) throw new Error('Escribe el producto');
    if (!('orden' in r)) r.orden = await siguienteOrden('items');
  }
  if (!Object.keys(r).length) throw new Error('Faltan datos');
  // Quién lo registró
  const q = quien();
  if (q) r.creado_por = q.id;
  const cols = Object.keys(r);
  await ejecutar(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...Object.values(r));
  if (!conRegistro) return;
  if (t === 'movimientos') {
    await registrar('movimiento', `registró un ${tipoMov(r.tipo)} de ${cop(Number(r.valor) || 0)}`, [r.descripcion, r.categoria].filter(Boolean).join(' · '));
  } else {
    await registrar('lista', `agregó «${r.producto}»`, await nombreLista(Number(r.lista_id)));
  }
}
export async function actualizar(t: TablaSimple, id: number, body: Fila) {
  const r = await limpiar(t, body);
  if (!Object.keys(r).length) throw new Error('Faltan datos');
  const soloEstado = t === 'items' && Object.keys(r).every(k => k === 'estado' || k === 'orden');
  // Quién lo editó por última vez
  const q = quien();
  if (q) r.editado_por = q.id;
  const cols = Object.keys(r);
  const marcaFecha = t === 'movimientos' ? ', editado = now()' : '';
  const fila = await una<Fila>(`UPDATE ${t} SET ${cols.map(c => `${c} = ?`).join(', ')}${marcaFecha} WHERE id = ? RETURNING *`, ...Object.values(r), id);
  if (!fila) return;
  if (t === 'movimientos') {
    await registrar('movimiento', `editó el ${tipoMov(fila.tipo)} «${fila.descripcion}»`,
      `${cop(Number(fila.valor) || 0)} · ${fila.categoria} · ${String(fila.fecha)}`, `movimiento:${id}`);
  } else if (soloEstado && 'estado' in r) {
    await registrar('lista', `marcó «${fila.producto}» como ${ESTADO_TEXTO[String(fila.estado)] ?? fila.estado}`, await nombreLista(Number(fila.lista_id)), `item:${id}`);
  } else if (!soloEstado) {
    await registrar('lista', `editó «${fila.producto}»`, await nombreLista(Number(fila.lista_id)), `item:${id}`);
  }
}
export async function borrar(t: TablaSimple, id: number) {
  const fila = await una<Fila>(`DELETE FROM ${t} WHERE id = ? RETURNING *`, id);
  if (!fila) return;
  if (t === 'movimientos') {
    await registrar('movimiento', `eliminó el ${tipoMov(fila.tipo)} «${fila.descripcion}» de ${cop(Number(fila.valor) || 0)}`, String(fila.fecha));
  } else {
    await registrar('lista', `quitó «${fila.producto}»`, await nombreLista(Number(fila.lista_id)));
  }
}

/* ---------- Periodos ---------- */
/**
 * Agrega un mes al plan.
 * - siguiente: después del último. Copia los ingresos, gastos y aportes que se repiten cada mes
 *   (no los de solo algunos meses, ni viajes o eventos, ni aportes de metas ya vencidas).
 *   Las deudas con saldo siguen con su cuota hasta liquidarse.
 * - anterior: antes del primero (p. ej. el mes en curso), con todos los valores en $ 0.
 */
export async function agregarPeriodo(posicion: 'anterior' | 'siguiente' = 'siguiente') {
  await transaccion(async () => {
    const primero = await una<Periodo>('SELECT * FROM periodos ORDER BY orden LIMIT 1');
    const ultimo = await una<Periodo>('SELECT * FROM periodos ORDER BY orden DESC LIMIT 1');
    if (!primero || !ultimo) throw new Error('No hay meses');

    if (posicion === 'anterior') {
      const id = mesAnterior(primero.id);
      await ejecutar('UPDATE periodos SET orden = orden + 1');
      await ejecutar('INSERT INTO periodos (id, etiqueta, cobro, orden) VALUES (?, ?, ?, 0)', id, etiquetaMes(id), cobroDe(id));
      await ejecutar('INSERT INTO valores (rubro_id, periodo_id, valor, auto) SELECT id, ?::text, 0, 0 FROM rubros', id);
      await registrar('plan', `agregó ${etiquetaMes(id)} al inicio del plan`);
      return;
    }

    // Cuota de cada deuda en el mes nuevo: la misma del último mes, sin pasarse de lo que queda (con intereses).
    const e = await leerEstado();
    const cuotas = planDeudas(e, ultimo.id)
      .filter(x => x.saldoInicial != null && x.restante > 0.5)
      .map(x => {
        const c = e.valores[`${x.rubro.id}:${ultimo.id}`];
        const previa = c && !c.auto ? valorCelda(e, x.rubro, ultimo.id) : 0;
        return { rubro: x.rubro.id, valor: Math.round(Math.min(previa, x.restante * (1 + (x.rubro.tasa ?? 0) / 100))) };
      })
      .filter(x => x.valor > 0);

    const id = mesSiguiente(ultimo.id);
    await ejecutar('INSERT INTO periodos (id, etiqueta, cobro, orden) VALUES (?, ?, ?, ?)', id, etiquetaMes(id), cobroDe(id), ultimo.orden + 1);
    await ejecutar(`
      INSERT INTO valores (rubro_id, periodo_id, valor, auto)
      SELECT r.id, ?::text, CASE
        WHEN r.recurrente = 1 AND c.seccion IN ('ingreso', 'operativo', 'ahorro') AND COALESCE(v.auto, 0) = 0
         AND NOT EXISTS (SELECT 1 FROM metas m WHERE m.rubro_id = r.id AND m.periodo_objetivo IS NOT NULL AND m.periodo_objetivo < ?::text)
        THEN COALESCE(v.valor, 0) ELSE 0 END, 0
      FROM rubros r
      JOIN categorias c ON c.id = r.categoria_id
      LEFT JOIN valores v ON v.rubro_id = r.id AND v.periodo_id = ?::text
    `, id, id, ultimo.id);
    for (const c of cuotas) await ejecutar('UPDATE valores SET valor = ? WHERE rubro_id = ? AND periodo_id = ?', c.valor, c.rubro, id);
    await registrar('plan', `agregó ${etiquetaMes(id)} al final del plan`);
  });
}

/**
 * Copia los valores de un mes a otro, solo para los rubros de las secciones indicadas.
 * Reemplaza lo que tenga el mes destino en esas secciones. No copia las celdas automáticas
 * (deuda en USD: duplicarían el pago) ni los ingresos o gastos de solo algunos meses (primas, bonos).
 */
export async function copiarMes(desde: string, hacia: string, secciones: string[]) {
  if (desde === hacia) throw new Error('Elige un mes distinto');
  for (const id of [desde, hacia]) if (!(await una('SELECT 1 FROM periodos WHERE id = ?', id))) throw new Error('Mes no encontrado');
  const validas = secciones.filter(s => SECCIONES.includes(s as Categoria['seccion']));
  if (!validas.length) throw new Error('Elige al menos una sección');
  await ejecutar(`
    INSERT INTO valores (rubro_id, periodo_id, valor, auto)
    SELECT v.rubro_id, ?::text, CASE WHEN v.auto = 1 THEN 0 ELSE v.valor END, 0
    FROM valores v
    JOIN rubros r ON r.id = v.rubro_id
    JOIN categorias c ON c.id = r.categoria_id
    WHERE v.periodo_id = ? AND c.seccion IN (${validas.map(() => '?').join(',')})
      AND (r.recurrente = 1 OR c.seccion IN ('deuda', 'evento'))
    ON CONFLICT (rubro_id, periodo_id) DO UPDATE SET valor = excluded.valor, auto = 0
  `, hacia, desde, ...validas);
  await registrar('presupuesto', `copió ${await etiquetaDe(desde)} en ${await etiquetaDe(hacia)}`, `Secciones: ${validas.map(x => ARTICULO[x]?.replace(/^(el|la) /, '') ?? x).join(', ')}`);
}

/** Quita el primer o el último mes del plan (con sus valores). */
export async function borrarPeriodo(cual: 'primero' | 'ultimo' = 'ultimo') {
  const { n } = (await una<{ n: number }>('SELECT COUNT(*)::int AS n FROM periodos'))!;
  if (n <= 1) throw new Error('Debe quedar al menos un mes');
  // Las metas conservan su fecha: puede quedar después del plan y se proyecta.
  const id = (await una<{ id: string }>(`SELECT id FROM periodos ORDER BY orden ${cual === 'primero' ? 'ASC' : 'DESC'} LIMIT 1`))!.id;
  await ejecutar('DELETE FROM periodos WHERE id = ?', id);
  await registrar('plan', `quitó ${etiquetaMes(id)} del plan`);
}

/* ---------- Restablecer e importar ---------- */
export async function restablecer(modo: ModoRestablecer, conservarMovimientos: boolean) {
  await restablecerDb(modo, conservarMovimientos);
  const QUE: Record<ModoRestablecer, string> = { ceros: 'dejó todos los montos en $ 0', vacio: 'borró el presupuesto, las deudas, las metas y las listas', excel: 'cargó los datos del Excel de ejemplo' };
  await registrar('ajustes', QUE[modo], conservarMovimientos ? 'Conservó los movimientos' : 'Sin conservar los movimientos');
}

/**
 * Carga una plantilla de Excel ya leída: reemplaza los meses, el presupuesto, las deudas, los viajes,
 * las metas y la configuración. Conserva las listas de compras (se reconectan a su rubro por nombre)
 * y los íconos de lo que se llame igual. Los movimientos se conservan si se pide.
 */
export async function aplicarPlantilla(p: DatosPlantilla, conservarMovimientos: boolean) {
  const previo = await leerEstado();
  const clave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const iconoCat = new Map(previo.categorias.map(c => [clave(c.nombre), c]));
  const iconoRub = new Map(previo.rubros.map(r => [clave(r.nombre), r.icono]));
  const iconoMet = new Map(previo.metas.map(m => [clave(m.nombre), m.icono]));
  const listas = previo.listas.map(l => ({ id: l.id, rubro: l.rubro_id ? previo.rubros.find(r => r.id === l.rubro_id)?.nombre ?? null : null }));
  // Compras con tarjeta: se reconectan a la tarjeta por su nombre
  const tarjetas = previo.movimientos.filter(m => m.tarjeta_id)
    .map(m => ({ id: m.id, rubro: previo.rubros.find(r => r.id === m.tarjeta_id)?.nombre ?? null }));

  await transaccion(async () => {
    await ejecutar('UPDATE listas SET rubro_id = NULL');
    if (!conservarMovimientos) await ejecutar('DELETE FROM movimientos');
    for (const t of ['metas', 'valores', 'rubros', 'categorias', 'periodos']) await ejecutar(`DELETE FROM ${t}`);

    await guardarConfig(p.config as Fila, false);
    await insertarVarios('periodos', ['id', 'etiqueta', 'cobro', 'orden'], p.meses.map((m, i) => [m, etiquetaMes(m), cobroDe(m), i]));

    // Categorías en el orden en que aparecen; sin nombre = la de la sección por defecto
    const idCat = new Map<string, number>();
    const categoria = async (nombre: string, seccion: Categoria['seccion']) => {
      const n = nombre || NOMBRE_POR_SECCION[seccion];
      const k = clave(n);
      if (!idCat.has(k)) {
        const antes = iconoCat.get(k);
        const control = antes?.seccion === seccion ? antes.control : seccion === 'operativo' ? 'Fijo' : null;
        idCat.set(k, await insertar('INSERT INTO categorias (nombre, seccion, control, orden, icono) VALUES (?, ?, ?, ?, ?)',
          n, seccion, control, idCat.size, antes?.icono ?? null));
      }
      return idCat.get(k)!;
    };
    for (const c of p.categorias) await categoria(c.nombre, c.seccion); // orden de la plantilla, también las vacías

    const idRub = new Map<string, number>();
    const valores: Param[][] = [];
    for (const [i, r] of p.rubros.entries()) {
      const id = await insertar('INSERT INTO rubros (categoria_id, nombre, orden, saldo, saldo_usd, tasa, cupo, recurrente, icono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        await categoria(r.categoria, r.seccion), r.nombre, i, r.saldo, r.saldo_usd, r.tasa, r.cupo, r.recurrente ? 1 : 0, iconoRub.get(clave(r.nombre)) ?? null);
      idRub.set(clave(r.nombre), id);
      for (const m of p.meses) valores.push([id, m, r.valores[m] ?? 0, r.autos.includes(m) ? 1 : 0]);
    }
    await insertarVarios('valores', ['rubro_id', 'periodo_id', 'valor', 'auto'], valores);
    await categoriaAhorro();

    // Deudas que usan el cupo de otra (misma tarjeta): se enlazan por nombre
    for (const r of p.rubros) {
      const padre = r.cupoDe ? idRub.get(clave(r.cupoDe)) : undefined;
      const hijo = idRub.get(clave(r.nombre));
      if (padre && hijo && padre !== hijo) await ejecutar('UPDATE rubros SET cupo_de = ?, cupo = NULL WHERE id = ?', padre, hijo);
    }

    // Metas: las de aporte mensual se conectan a su fila "Ahorro · <meta>" si existe; si no, se crea en $ 0.
    const deAhorro = p.rubros.filter(r => r.seccion === 'ahorro');
    for (const [i, m] of p.metas.entries()) {
      const fila = m.modo === 'aportes'
        ? deAhorro.find(r => clave(r.nombre).replace(/^ahorro\s*[·\-:|]\s*/, '') === clave(m.nombre))
        : undefined;
      const rubro = fila ? idRub.get(clave(fila.nombre)) ?? null : null;
      const id = await insertar('INSERT INTO metas (nombre, detalle, objetivo, periodo_objetivo, modo, ahorrado, orden, icono, rubro_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        m.nombre, m.detalle, m.objetivo, m.periodo_objetivo, m.modo, m.ahorrado, i, iconoMet.get(clave(m.nombre)) ?? null, rubro);
      if (m.modo === 'aportes' && !rubro) await sincronizarAportes(id, m.nombre, 'aportes', null);
    }

    for (const l of listas) {
      const r = l.rubro ? idRub.get(clave(l.rubro)) : undefined;
      if (r) await ejecutar('UPDATE listas SET rubro_id = ? WHERE id = ?', r, l.id);
    }
    if (conservarMovimientos) {
      for (const m of tarjetas) {
        const r = m.rubro ? idRub.get(clave(m.rubro)) : undefined;
        if (r) await ejecutar('UPDATE movimientos SET tarjeta_id = ? WHERE id = ?', r, m.id);
      }
    }
    await registrar('ajustes', 'cargó una plantilla de Excel',
      `${p.meses.length} meses · ${p.rubros.length} rubros · ${p.metas.length} metas${conservarMovimientos ? ' · conservó los movimientos' : ''}`);
  });
}

/**
 * Reemplaza los datos del cuaderno con una copia exportada desde la app (JSON del estado).
 * Los ids de la copia se cambian por ids nuevos (los ids son únicos en toda la base, entre cuadernos).
 */
export async function importar(e: Estado & { mercado?: Omit<ItemLista, 'lista_id'>[] }) {
  if (!e || !Array.isArray(e.periodos) || !Array.isArray(e.rubros) || !e.config) throw new Error('Archivo no válido');
  await transaccion(async () => {
    for (const t of ['items', 'listas', 'metas', 'movimientos', 'valores', 'rubros', 'categorias', 'periodos']) await ejecutar(`DELETE FROM ${t}`);
    await guardarConfig(e.config as unknown as Fila, false);
    const meses = new Set(e.periodos.map(x => String(x.id)));
    await insertarVarios('periodos', ['id', 'etiqueta', 'cobro', 'orden'], e.periodos.map((x, i) => [String(x.id), String(x.etiqueta), String(x.cobro ?? ''), i]));

    // id de la copia → id nuevo
    const cat = new Map<number, number>(), rub = new Map<number, number>(), lis = new Map<number, number>();
    for (const [i, x] of (e.categorias ?? []).entries()) {
      cat.set(Number(x.id), await insertar('INSERT INTO categorias (nombre, seccion, control, orden, icono) VALUES (?, ?, ?, ?, ?)',
        texto(x.nombre, 80), x.seccion, x.control ?? null, i, icono(x.icono)));
    }
    for (const [i, x] of e.rubros.entries()) {
      const c = cat.get(Number(x.categoria_id));
      if (!c) continue;
      rub.set(Number(x.id), await insertar('INSERT INTO rubros (categoria_id, nombre, orden, saldo_usd, saldo, tasa, cupo, recurrente, icono, dia_corte, dia_pago) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        c, texto(x.nombre, 120), i, montoONulo(x.saldo_usd), montoONulo(x.saldo), montoONulo(x.tasa), montoONulo(x.cupo), x.recurrente === false ? 0 : 1, icono(x.icono),
        diaDelMes(x.dia_corte), diaDelMes(x.dia_pago)));
    }
    // El cupo compartido se enlaza después: la deuda principal puede venir más abajo
    for (const x of e.rubros) {
      const hijo = rub.get(Number(x.id)), padre = x.cupo_de ? rub.get(Number(x.cupo_de)) : undefined;
      if (hijo && padre && hijo !== padre) await ejecutar('UPDATE rubros SET cupo_de = ? WHERE id = ?', padre, hijo);
    }
    // Copias de versiones anteriores no traen la marca de "solo algunos meses": se deduce de los valores.
    const sinMarca = e.rubros.some(x => x.recurrente === undefined);
    await insertarVarios('valores', ['rubro_id', 'periodo_id', 'valor', 'auto'],
      Object.entries(e.valores ?? {}).flatMap(([k, cel]) => {
        const [rid, pid] = k.split(':');
        const nuevo = rub.get(Number(rid));
        return nuevo && meses.has(pid) ? [[nuevo, pid, monto(cel.valor), cel.auto ? 1 : 0]] : [];
      }));
    if (sinMarca) await marcarPuntuales();
    for (const [i, x] of (e.metas ?? []).entries()) {
      await ejecutar('INSERT INTO metas (nombre, detalle, objetivo, periodo_objetivo, modo, ahorrado, rubro_id, orden, icono, pausada_desde, aporte_pausado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        texto(x.nombre, 80), texto(x.detalle, 120), monto(x.objetivo), esMes(x.periodo_objetivo) ? x.periodo_objetivo : null,
        x.modo === 'caja' ? 'caja' : 'aportes', monto(x.ahorrado), x.rubro_id ? rub.get(Number(x.rubro_id)) ?? null : null, i, icono(x.icono),
        esMes(x.pausada_desde) ? x.pausada_desde : null, montoONulo(x.aporte_pausado));
    }
    for (const [i, x] of (e.listas ?? []).entries()) {
      lis.set(Number(x.id), await insertar('INSERT INTO listas (nombre, rubro_id, presupuesto, orden, icono) VALUES (?, ?, ?, ?, ?)',
        texto(x.nombre, 80), x.rubro_id ? rub.get(Number(x.rubro_id)) ?? null : null, monto(x.presupuesto), i, icono(x.icono)));
    }
    for (const it of e.items ?? []) {
      const lista = lis.get(Number(it.lista_id));
      if (lista) await crear('items', { ...it, lista_id: lista } as unknown as Fila, false);
    }
    if (e.mercado?.length && !e.listas?.length) {
      const id = await crearLista({ nombre: 'Mercado del mes' }, false);
      for (const it of e.mercado) await crear('items', { ...it, lista_id: id }, false);
    }
    for (const mv of e.movimientos ?? []) {
      await crear('movimientos', {
        ...mv, tarjeta_id: mv.tarjeta_id ? rub.get(Number(mv.tarjeta_id)) ?? null : null, rubro_id: mv.rubro_id ? rub.get(Number(mv.rubro_id)) ?? null : null,
      } as unknown as Fila, false);
    }
    await categoriaAhorro();
    await registrar('ajustes', 'restauró una copia de seguridad', `${e.periodos.length} meses · ${e.rubros.length} rubros · ${(e.movimientos ?? []).length} movimientos`);
  });
}
