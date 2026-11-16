// Cálculos del tablero: réplica de las fórmulas del Excel "Visual Board Financiero",
// ampliada con varias deudas, metas y listas. Funciones puras (cliente y servidor).
import { cobroDe, diaSueldo, etiquetaMes, mesesEntre, mesSiguiente } from './meses';
import {
  claveCelda, OTROS_GASTOS, OTROS_INGRESOS,
  type Categoria, type Config, type Estado, type ItemLista, type Lista, type Meta, type Movimiento, type Periodo, type Rubro, type Seccion,
} from './tipos';

/** Valor efectivo de una celda. Las celdas "auto" de una deuda en USD toman el saldo restante
 *  (saldo USD × TRM − lo pagado en los demás meses), como la fórmula =$D$3-C44 del Excel. */
export function valorCelda(e: Estado, rubro: Rubro, periodoId: string): number {
  const c = e.valores[claveCelda(rubro.id, periodoId)];
  if (!c) return 0;
  if (!c.auto) return c.valor;
  const totalCop = (rubro.saldo_usd ?? 0) * e.config.trm;
  const pagado = e.periodos.reduce((s, p) => {
    const otra = e.valores[claveCelda(rubro.id, p.id)];
    return otra && !otra.auto ? s + otra.valor : s;
  }, 0);
  return Math.max(0, totalCop - pagado);
}

export const seccionDe = (e: Estado, rubro: Rubro): Seccion =>
  e.categorias.find(c => c.id === rubro.categoria_id)?.seccion ?? 'operativo';

/** Un rubro se muestra en un mes si se repite cada mes o si tiene valor en ese mes. */
export function rubroVisible(e: Estado, rubro: Rubro, periodoId: string): boolean {
  if (rubro.recurrente) return true;
  const c = e.valores[claveCelda(rubro.id, periodoId)];
  return !!c && (c.auto || c.valor > 0);
}

/** Meses del plan en los que el rubro tiene valor. */
export const mesesConValor = (e: Estado, rubro: Rubro): Periodo[] =>
  e.periodos.filter(p => valorCelda(e, rubro, p.id) > 0);

/** Flujo libre mensual después del plan (bloque "Proyección después del plan"). */
export const flujoLibre = (c: Config) => (c.ingreso_2028 || 0) - (c.operativo_2028 || 0) - (c.cuota_carro_2028 || 0);

export type ResumenPeriodo = {
  periodo: Periodo;
  ingresos: number;
  operativo: number;
  eventos: number;
  deudas: number;
  /** Aportes a metas (sección ahorro) */
  ahorro: number;
  /** Deudas + viajes + eventos (sección 3 del Excel) */
  compromisos: number;
  egresos: number;
  flujo: number;
  caja: number;
  porCategoria: Record<number, number>;
};

/** Una fila por mes con totales y caja acumulada (filas 11, 38, 49, 52, 53 y 54 del Excel). */
export function serie(e: Estado): ResumenPeriodo[] {
  const cat = new Map(e.categorias.map(c => [c.id, c]));
  let caja = e.config.saldo_inicial || 0;
  return e.periodos.map(p => {
    const r: ResumenPeriodo = {
      periodo: p, ingresos: 0, operativo: 0, eventos: 0, deudas: 0, ahorro: 0,
      compromisos: 0, egresos: 0, flujo: 0, caja: 0, porCategoria: {},
    };
    for (const rubro of e.rubros) {
      const v = valorCelda(e, rubro, p.id);
      if (!v) continue;
      const sec = cat.get(rubro.categoria_id)?.seccion ?? 'operativo';
      r.porCategoria[rubro.categoria_id] = (r.porCategoria[rubro.categoria_id] ?? 0) + v;
      if (sec === 'ingreso') r.ingresos += v;
      else if (sec === 'operativo') r.operativo += v;
      else if (sec === 'evento') r.eventos += v;
      else if (sec === 'ahorro') r.ahorro += v;
      else r.deudas += v;
    }
    r.compromisos = r.eventos + r.deudas;
    r.egresos = r.operativo + r.compromisos + r.ahorro;
    r.flujo = r.ingresos - r.egresos;
    caja += r.flujo;
    r.caja = caja;
    return r;
  });
}

export type FilaDistribucion = { categoria: Categoria; promedio: number; peso: number };

/** Indicadores del Visual Board (fila 5-7 y bloque 2). */
export function tablero(e: Estado, filas = serie(e)) {
  const meses = filas.length || 1;
  const cajaFinal = filas.at(-1)?.caja ?? 0;
  const usdTotal = e.rubros.reduce((s, r) => s + (r.saldo_usd ?? 0), 0);

  const totalPorRubro = (r: Rubro) => e.periodos.reduce((s, p) => s + valorCelda(e, r, p.id), 0);
  const deudaExtinta = e.rubros
    .filter(r => seccionDe(e, r) === 'deuda')
    .reduce((s, r) => s + totalPorRubro(r), 0);

  const operativas = e.categorias.filter(c => c.seccion === 'operativo');
  const promedios = operativas.map(c => ({
    categoria: c,
    promedio: filas.reduce((s, f) => s + (f.porCategoria[c.id] ?? 0), 0) / meses,
  }));
  const promedioOperativo = promedios.reduce((s, x) => s + x.promedio, 0);
  const distribucion: FilaDistribucion[] = promedios
    .map(x => ({ ...x, peso: promedioOperativo ? x.promedio / promedioOperativo : 0 }))
    .sort((a, b) => b.promedio - a.promedio);

  // Las metas "con caja" se pagan con lo que sobra: lo demás se puede gastar.
  const comprometidoEnMetas = e.metas.filter(m => m.modo === 'caja' && !m.pausada_desde).reduce((s, m) => s + Math.max(0, m.objetivo - m.ahorrado), 0);
  const vacio = filas.every(f => !f.ingresos && !f.egresos);

  return {
    cajaFinal,
    deudaExtinta,
    usdTotal,
    /** (TRM de referencia − TRM actual) × USD adeudados */
    ahorroCambiario: (e.config.trm_referencia - e.config.trm) * usdTotal,
    /** Caja final − metas pagadas con caja: lo que sobra (+) o falta (−) frente al plan */
    simulador: cajaFinal - comprometidoEnMetas,
    hayMetasCaja: e.metas.some(m => m.modo === 'caja' && !m.pausada_desde),
    distribucion,
    promedioOperativo,
    flujo2028: flujoLibre(e.config),
    /** El presupuesto está todo en $0 (recién restablecido) */
    vacio,
  };
}

/* ---------------- Metas ---------------- */
/** Mes objetivo de una meta: el elegido o, si no tiene, el último del plan. */
export const objetivoDe = (e: Estado, m: Meta): string => m.periodo_objetivo ?? e.periodos.at(-1)?.id ?? '';

/** Aporte del último mes del plan: después del plan se asume que sigue igual hasta el mes objetivo. */
function aporteFinal(e: Estado, m: Meta): number {
  const r = e.rubros.find(x => x.id === m.rubro_id);
  const ultimo = e.periodos.at(-1);
  return r && ultimo ? valorCelda(e, r, ultimo.id) : 0;
}

/**
 * Caja acumulada en cualquier mes. Dentro del plan es la del presupuesto; después del plan
 * crece con el flujo libre mensual ("Proyección después del plan") menos los aportes a metas que siguen.
 */
export function proyectarCaja(e: Estado, filas: ResumenPeriodo[]): (mes: string) => number {
  const primero = e.periodos[0]?.id, ultimo = e.periodos.at(-1)?.id;
  const cajaFinal = filas.at(-1)?.caja ?? 0;
  const libre = flujoLibre(e.config);
  const siguen = ultimo
    ? e.metas.filter(m => m.modo === 'aportes' && !m.pausada_desde && objetivoDe(e, m) > ultimo).map(m => ({ hasta: objetivoDe(e, m), aporte: aporteFinal(e, m) }))
    : [];
  return mes => {
    if (!primero || !ultimo || mes < primero) return e.config.saldo_inicial || 0;
    if (mes <= ultimo) {
      let i = 0;
      while (i + 1 < e.periodos.length && e.periodos[i + 1].id <= mes) i++;
      return filas[i]?.caja ?? 0;
    }
    const n = mesesEntre(ultimo, mes);
    let caja = cajaFinal + libre * n;
    for (const s of siguen) caja -= s.aporte * Math.min(n, mesesEntre(ultimo, s.hasta));
    return caja;
  };
}

export type EstadoMeta = {
  meta: Meta;
  /** Mes objetivo (AAAA-MM) y su etiqueta ("Dic 2030") */
  mesObjetivo: string;
  etiquetaObjetivo: string;
  /** El mes objetivo es posterior al último mes del plan: el resultado es una proyección */
  despuesDelPlan: boolean;
  /** Ahorrado (o cubierto por la caja) hasta el mes seleccionado */
  actual: number;
  /** Lo que habrá en el mes objetivo según el plan (y la proyección después del plan) */
  proyectado: number;
  pct: number;
  cumplida: boolean;
  falta: number;
  /** Aporte mensual extra necesario desde el mes seleccionado hasta el objetivo */
  aporteSugerido: number;
  /** Aporte mensual que tiene el presupuesto (el del mes seleccionado o el primero con valor) */
  aporteActual: number;
  /** En pausa: no se aporta ni reserva caja desde pausadaDesde */
  pausada: boolean;
  pausadaDesde: string | null;
};

/** Progreso de cada meta. Las metas "caja" se reparten la caja acumulada en orden de prioridad. */
export function calcularMetas(e: Estado, filas: ResumenPeriodo[], periodoId: string): EstadoMeta[] {
  const sel = e.periodos.some(p => p.id === periodoId) ? periodoId : (e.periodos[0]?.id ?? periodoId);
  const ultimo = e.periodos.at(-1)?.id ?? sel;
  const cajaEn = proyectarCaja(e, filas);
  const menor = (a: string, b: string) => (a < b ? a : b);

  const aportesHasta = (m: Meta, hasta: string) => {
    const r = e.rubros.find(x => x.id === m.rubro_id);
    if (!r) return 0;
    let s = 0;
    for (const p of e.periodos) if (p.id <= hasta) s += valorCelda(e, r, p.id);
    if (hasta > ultimo && !m.pausada_desde) s += aporteFinal(e, m) * mesesEntre(ultimo, hasta);
    return s;
  };

  const caja = new Map<number, { actual: number; proyectado: number }>();
  let usadoAct = 0, usadoProy = 0;
  // Una meta en pausa no se lleva caja: solo cuenta lo que ya tenía ahorrado.
  for (const m of e.metas.filter(x => x.modo === 'caja')) {
    if (m.pausada_desde) { caja.set(m.id, { actual: m.ahorrado, proyectado: m.ahorrado }); continue; }
    const obj = objetivoDe(e, m);
    const necesita = Math.max(0, m.objetivo - m.ahorrado);
    const proy = Math.min(necesita, Math.max(0, cajaEn(obj) - usadoProy));
    const act = Math.min(necesita, Math.max(0, cajaEn(menor(sel, obj)) - usadoAct));
    usadoProy += proy;
    usadoAct += act;
    caja.set(m.id, { actual: m.ahorrado + act, proyectado: m.ahorrado + proy });
  }

  return e.metas.map(m => {
    const obj = objetivoDe(e, m);
    const { actual, proyectado } = m.modo === 'caja'
      ? caja.get(m.id)!
      : { actual: m.ahorrado + aportesHasta(m, menor(sel, obj)), proyectado: m.ahorrado + aportesHasta(m, obj) };
    const falta = Math.max(0, m.objetivo - proyectado);
    const mesesRestantes = Math.max(1, mesesEntre(sel, obj) + 1);
    const r = e.rubros.find(x => x.id === m.rubro_id);
    const aporteActual = m.pausada_desde ? 0 : r ? (valorCelda(e, r, sel) || e.periodos.map(p => valorCelda(e, r, p.id)).find(v => v > 0) || 0) : 0;
    return {
      meta: m,
      mesObjetivo: obj,
      etiquetaObjetivo: obj ? etiquetaMes(obj) : '',
      despuesDelPlan: !!obj && obj > ultimo,
      actual,
      proyectado,
      pct: m.objetivo > 0 ? Math.min(1, actual / m.objetivo) : 0,
      cumplida: m.objetivo > 0 && proyectado >= m.objetivo,
      falta,
      aporteSugerido: falta / mesesRestantes,
      aporteActual,
      pausada: !!m.pausada_desde,
      pausadaDesde: m.pausada_desde ?? null,
    };
  });
}

/** Aportes iguales cada mes del plan desde "desde" hasta el mes objetivo (incluidos; puede ser después del plan). */
export function planAportes(e: Estado, aporte: number, desde: string, hasta: string | null): Record<string, number> {
  return Object.fromEntries(e.periodos.map(p => [p.id, p.id >= desde && (!hasta || p.id <= hasta) ? Math.round(aporte) : 0]));
}

/* ---------------- Deudas ---------------- */
export type TipoPlan = 'cuota' | 'unico';

/** Genera los pagos mes a mes de una deuda (con interés mensual compuesto desde el primer mes). */
export function planPagos(e: Estado, o: { saldo: number; tasa: number; tipo: TipoPlan; cuota?: number; desde?: string; mes?: string }) {
  const t = (o.tasa || 0) / 100;
  const iDesde = Math.max(0, e.periodos.findIndex(p => p.id === o.desde));
  const iMes = Math.max(0, e.periodos.findIndex(p => p.id === o.mes));
  let bal = o.saldo;
  let total = 0;
  let liquidaEn: Periodo | undefined;
  const valores: Record<string, number> = {};
  e.periodos.forEach((p, i) => {
    bal += bal * t;
    let pago = 0;
    if (o.tipo === 'cuota' && i >= iDesde) pago = Math.min(o.cuota ?? 0, bal);
    if (o.tipo === 'unico' && i === iMes) pago = bal;
    pago = Math.round(pago);
    bal = Math.max(0, bal - pago);
    if (bal < 1) bal = 0;
    if (pago > 0 && bal === 0 && !liquidaEn) liquidaEn = p;
    total += pago;
    valores[p.id] = pago;
  });
  return { valores, total, intereses: Math.max(0, total - o.saldo + bal), restante: bal, liquidaEn };
}

export type Deuda = {
  rubro: Rubro;
  categoria: string;
  /** Saldo en pesos al inicio del plan (USD × TRM si es en dólares). Nulo = solo lo programado. */
  saldoInicial: number | null;
  /** Suma de todos los pagos programados */
  programado: number;
  /** Pagado hasta el mes seleccionado */
  pagado: number;
  /** Lo que se debe después del mes seleccionado (con intereses) */
  restante: number;
  /** Lo que quedaría debiendo al terminar el plan */
  faltaProgramar: number;
  pagos: { periodo: Periodo; valor: number; hecho: boolean }[];
  liquidada: boolean;
};

/** Plan de pagos de deudas, simulando intereses si la deuda tiene saldo y tasa. */
export function planDeudas(e: Estado, periodoActual: string): Deuda[] {
  const iSel = Math.max(0, e.periodos.findIndex(p => p.id === periodoActual));
  return e.rubros
    .filter(r => seccionDe(e, r) === 'deuda')
    .map(r => {
      const valores = e.periodos.map(p => valorCelda(e, r, p.id));
      const programado = valores.reduce((s, v) => s + v, 0);
      const pagado = valores.slice(0, iSel + 1).reduce((s, v) => s + v, 0);
      const saldoInicial = r.saldo ?? (r.saldo_usd != null ? r.saldo_usd * e.config.trm : null);
      let restante: number, faltaProgramar: number;
      if (saldoInicial == null) {
        restante = programado - pagado;
        faltaProgramar = 0;
      } else {
        const t = (r.tasa ?? 0) / 100;
        let bal = saldoInicial;
        let enSel = saldoInicial;
        valores.forEach((v, i) => {
          bal = Math.max(0, bal + bal * t - v);
          if (bal < 1) bal = 0;
          if (i === iSel) enSel = bal;
        });
        restante = enSel;
        faltaProgramar = bal;
      }
      return {
        rubro: r,
        categoria: e.categorias.find(c => c.id === r.categoria_id)?.nombre ?? '',
        saldoInicial,
        programado,
        pagado,
        restante,
        faltaProgramar,
        pagos: valores.map((valor, i) => ({ periodo: e.periodos[i], valor, hecho: i <= iSel })).filter(x => x.valor > 0),
        liquidada: (saldoInicial ?? programado) > 0 && restante <= 0.5,
      };
    });
}

export function eventosPlaneados(e: Estado) {
  return e.rubros
    .filter(r => seccionDe(e, r) === 'evento')
    .flatMap(r => e.periodos.map(p => ({ rubro: r, periodo: p, valor: valorCelda(e, r, p.id) })))
    .filter(x => x.valor > 0)
    .sort((a, b) => a.periodo.orden - b.periodo.orden);
}

/* ---------------- Movimientos ---------------- */
/** Movimientos reales registrados en el mes del periodo (AAAA-MM). */
export function movimientosDe(e: Estado, periodoId: string): Movimiento[] {
  return e.movimientos
    .filter(m => m.fecha.startsWith(periodoId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}

/** Un ítem del presupuesto en el mes: lo planeado frente a lo gastado con ese ítem. */
export type ItemPlanReal = { rubro: Rubro; plan: number; real: number; pendiente: number; exceso: number; movs: Movimiento[] };

export type PlanVsReal = {
  /** id de la categoría (null si el gasto trae una categoría que ya no existe, p. ej. "Otros gastos") */
  id: number | null;
  nombre: string;
  plan: number;
  real: number;
  /** Lo gastado que cabe en el presupuesto de cada ítem */
  enPlan: number;
  /** Lo que todavía se espera gastar: lo que falta de cada ítem */
  pendiente: number;
  /** Gastos sin ítem del presupuesto */
  sinItem: number;
  /** Lo que no estaba en el plan: gastos sin ítem + lo que se pasó cada ítem */
  fueraDelPlan: number;
  /** Cómo cerraría el mes: lo gastado + lo que falta por gastar */
  cierre: number;
  items: ItemPlanReal[];
  movsSinItem: Movimiento[];
};

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Lo registrado frente a lo presupuestado, por categoría de egreso y por ítem. Cada gasto cuenta contra el
 * ítem que se eligió al registrarlo (o, si no se eligió, contra el ítem que se llama igual que la
 * descripción). Un gasto sin ítem no estaba en el plan: se suma como "fuera del plan" y no descuenta lo
 * que falta por gastar de los demás ítems.
 */
export function planVsReal(e: Estado, periodoId: string, fila?: ResumenPeriodo) {
  const movs = movimientosDe(e, periodoId);
  const egresosMes = movs.filter(m => m.tipo === 'egreso');
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.valor, 0);
  const egresos = egresosMes.reduce((s, m) => s + m.valor, 0);
  const rubros = new Map(e.rubros.map(r => [r.id, r]));
  const catPorNombre = new Map(e.categorias.map(c => [c.nombre, c]));

  // A qué ítem va cada gasto
  const porRubro = new Map<number, Movimiento[]>();
  const sinItemPor = new Map<string, Movimiento[]>();
  for (const m of egresosMes) {
    let r = m.rubro_id != null ? rubros.get(m.rubro_id) : undefined;
    if (!r) {
      const cat = catPorNombre.get(m.categoria);
      const desc = normalizar(m.descripcion ?? '');
      r = cat && desc ? e.rubros.find(x => x.categoria_id === cat.id && normalizar(x.nombre) === desc) : undefined;
    }
    if (r && seccionDe(e, r) === 'ingreso') r = undefined;
    if (r) porRubro.set(r.id, [...(porRubro.get(r.id) ?? []), m]);
    else sinItemPor.set(m.categoria, [...(sinItemPor.get(m.categoria) ?? []), m]);
  }

  const suma = (xs: Movimiento[]) => xs.reduce((s, m) => s + m.valor, 0);
  const armar = (id: number | null, nombre: string, items: ItemPlanReal[], movsSinItem: Movimiento[]): PlanVsReal => {
    const plan = items.reduce((s, x) => s + x.plan, 0);
    const sinItem = suma(movsSinItem);
    const enPlan = items.reduce((s, x) => s + Math.min(x.real, x.plan), 0);
    const pendiente = items.reduce((s, x) => s + x.pendiente, 0);
    const fueraDelPlan = sinItem + items.reduce((s, x) => s + x.exceso, 0);
    const real = enPlan + fueraDelPlan;
    return { id, nombre, plan, real, enPlan, pendiente, sinItem, fueraDelPlan, cierre: real + pendiente, items, movsSinItem };
  };

  const filas: PlanVsReal[] = e.categorias
    .filter(c => c.seccion !== 'ingreso')
    .map(c => {
      const items = e.rubros
        .filter(r => r.categoria_id === c.id)
        .map(r => {
          const plan = fila ? valorCelda(e, r, periodoId) : 0;
          const ms = porRubro.get(r.id) ?? [];
          const real = suma(ms);
          return { rubro: r, plan, real, pendiente: Math.max(0, plan - real), exceso: Math.max(0, real - plan), movs: ms };
        })
        .filter(x => x.plan > 0 || x.real > 0);
      return armar(c.id, c.nombre, items, sinItemPor.get(c.nombre) ?? []);
    })
    .filter(x => x.plan > 0 || x.real > 0);
  // Gastos con una categoría que no es de egreso o que ya no existe (p. ej. "Otros gastos")
  const conocidas = new Set(e.categorias.filter(c => c.seccion !== 'ingreso').map(c => c.nombre));
  for (const [nombre, ms] of sinItemPor) if (!conocidas.has(nombre)) filas.push(armar(null, nombre || OTROS_GASTOS, [], ms));

  const total = (k: 'plan' | 'enPlan' | 'pendiente' | 'fueraDelPlan' | 'cierre') => filas.reduce((s, f) => s + f[k], 0);
  return {
    movs, ingresos, egresos, filas,
    plan: total('plan'), enPlan: total('enPlan'), pendiente: total('pendiente'), fueraDelPlan: total('fueraDelPlan'), cierre: total('cierre'),
  };
}

/** Si un gasto es flexible (se gasta de a poco) o fijo (se paga completo). Por defecto, como su categoría. */
export function esFlexible(e: Estado, r: Rubro): boolean {
  if (r.control) return r.control === 'flexible';
  return e.categorias.find(c => c.id === r.categoria_id)?.control === 'Flexible';
}

/** Ingresos del mes por ítem del presupuesto: lo planeado frente a lo recibido con ese ítem. */
export function recibidoPorRubro(e: Estado, periodoId: string): Map<number, ItemPlanReal> {
  const catPorNombre = new Map(e.categorias.map(c => [c.nombre, c]));
  const porRubro = new Map<number, Movimiento[]>();
  for (const m of movimientosDe(e, periodoId)) {
    if (m.tipo !== 'ingreso') continue;
    let r = m.rubro_id != null ? e.rubros.find(x => x.id === m.rubro_id) : undefined;
    if (!r) {
      const cat = catPorNombre.get(m.categoria);
      const desc = normalizar(m.descripcion ?? '');
      r = cat && desc ? e.rubros.find(x => x.categoria_id === cat.id && normalizar(x.nombre) === desc) : undefined;
    }
    if (r) porRubro.set(r.id, [...(porRubro.get(r.id) ?? []), m]);
  }
  const res = new Map<number, ItemPlanReal>();
  for (const r of e.rubros) {
    if (seccionDe(e, r) !== 'ingreso') continue;
    const plan = valorCelda(e, r, periodoId);
    const movs = porRubro.get(r.id) ?? [];
    const real = movs.reduce((t, m) => t + m.valor, 0);
    res.set(r.id, { rubro: r, plan, real, pendiente: Math.max(0, plan - real), exceso: Math.max(0, real - plan), movs });
  }
  return res;
}

/** Lo real del mes por nombre de categoría: gastos (por defecto) o ingresos. */
export function realPorCategoria(e: Estado, periodoId: string, tipo: 'egreso' | 'ingreso' = 'egreso'): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of movimientosDe(e, periodoId)) if (x.tipo === tipo) m.set(x.categoria, (m.get(x.categoria) ?? 0) + x.valor);
  return m;
}

/* ---------------- Tarjetas de crédito ---------------- */
export type CupoTarjeta = {
  rubro: Rubro;
  /** Otras deudas de la misma tarjeta que usan este cupo (p. ej. la parte en dólares) */
  partes: Rubro[];
  cupo: number;
  /** Lo que se debe según el plan al cierre del mes (con intereses y pagos programados) */
  deudaPlan: number;
  /** Compras registradas con esta tarjeta hasta ese mes */
  compras: number;
  usado: number;
  disponible: number;
};

/** Deuda principal de una tarjeta: la que tiene el cupo (sigue "usa el cupo de"). */
export function tarjetaPrincipal(e: Estado, r: Rubro): Rubro {
  let actual = r;
  for (let i = 0; i < 5 && actual.cupo_de; i++) {
    const p = e.rubros.find(x => x.id === actual.cupo_de);
    if (!p) break;
    actual = p;
  }
  return actual;
}

/** Tarjetas con cupo: cuánto se usa y cuánto queda en el mes indicado. Suma todas las partes de la misma tarjeta. */
export function cuposTarjetas(e: Estado, mes: string): CupoTarjeta[] {
  const conCupo = e.rubros.filter(r => (r.cupo ?? 0) > 0 && !r.cupo_de);
  if (!conCupo.length) return [];
  // Si el mes está fuera del plan, se toma el más cercano dentro del plan
  const enPlan = e.periodos.some(p => p.id === mes) ? mes
    : mes < (e.periodos[0]?.id ?? '') ? e.periodos[0]?.id ?? mes : e.periodos.at(-1)?.id ?? mes;
  const deudas = planDeudas(e, enPlan);
  return conCupo.map(r => {
    const partes = e.rubros.filter(x => x.id !== r.id && tarjetaPrincipal(e, x).id === r.id);
    const ids = new Set([r.id, ...partes.map(x => x.id)]);
    const deudaPlan = deudas.filter(d => ids.has(d.rubro.id)).reduce((s, d) => s + Math.max(0, d.restante), 0);
    const compras = e.movimientos
      .filter(m => m.tipo === 'egreso' && m.tarjeta_id != null && ids.has(m.tarjeta_id) && m.fecha.slice(0, 7) <= mes)
      .reduce((s, m) => s + m.valor, 0);
    const usado = deudaPlan + compras;
    return { rubro: r, partes, cupo: r.cupo!, deudaPlan, compras, usado, disponible: r.cupo! - usado };
  });
}

/** Lo real del mes en un ítem del presupuesto (movimientos con ese rubro). */
export function realPorRubro(e: Estado, periodoId: string, rubroId: number, sinMovimiento?: number): number {
  return e.movimientos
    .filter(m => m.rubro_id === rubroId && m.fecha.startsWith(periodoId) && m.id !== sinMovimiento)
    .reduce((s, m) => s + m.valor, 0);
}

/* ---------------- Corte y pago de las tarjetas ---------------- */
export type PagoCompra = {
  /** Fecha de corte del extracto en que entra la compra (AAAA-MM-DD) */
  corte: string;
  /** Fecha límite para pagar ese extracto (AAAA-MM-DD) */
  pago: string;
  /** Mes del plan en que sale la plata (AAAA-MM) */
  mesPago: string;
  /** "30 Nov": el sueldo con que se cubre ese mes (esquema a mes vencido) */
  sueldo: string;
};

const ultimoDia = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(a, m, 0).getDate(); };
const fechaDe = (mes: string, dia: number) => `${mes}-${String(Math.min(dia, ultimoDia(mes))).padStart(2, '0')}`;

/**
 * En qué extracto entra una compra y cuándo se paga. Comprar hasta el día de corte la deja en el
 * extracto de ese mes; después del corte, en el del mes siguiente. Si el día de pago es menor o igual
 * al de corte, el pago cae en el mes siguiente al corte.
 */
export function pagoDeCompra(e: Estado | null, fecha: string, diaCorte?: number | null, diaPago?: number | null): PagoCompra | null {
  if (!diaCorte || !diaPago || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const mes = fecha.slice(0, 7);
  const dia = Number(fecha.slice(8, 10));
  const mesCorte = dia <= Math.min(diaCorte, ultimoDia(mes)) ? mes : mesSiguiente(mes);
  const mesPago = diaPago > diaCorte ? mesCorte : mesSiguiente(mesCorte);
  const periodo = e?.periodos.find(p => p.id === mesPago);
  return { corte: fechaDe(mesCorte, diaCorte), pago: fechaDe(mesPago, diaPago), mesPago, sueldo: diaSueldo(periodo?.cobro ?? cobroDe(mesPago)) };
}

/** Corte y pago de una compra registrada con tarjeta (las fechas son las de la tarjeta principal). */
export function pagoDeMovimiento(e: Estado, m: Pick<Movimiento, 'fecha' | 'tarjeta_id'>): PagoCompra | null {
  const r = m.tarjeta_id ? e.rubros.find(x => x.id === m.tarjeta_id) : undefined;
  if (!r) return null;
  const t = tarjetaPrincipal(e, r);
  return pagoDeCompra(e, m.fecha, t.dia_corte, t.dia_pago);
}

export type ComprasTarjeta = {
  compras: (Movimiento & { pago: PagoCompra | null })[];
  total: number;
  /** Cuánto se paga en cada mes (según el corte) */
  porMesPago: { mesPago: string; sueldo: string; pago: string; total: number; cantidad: number }[];
};

/** Compras con una tarjeta (todas sus partes) registradas en el mes, con el mes en que se pagan. */
export function comprasDeTarjeta(e: Estado, principalId: number, periodoId: string): ComprasTarjeta {
  const ids = new Set(e.rubros.filter(x => tarjetaPrincipal(e, x).id === principalId).map(x => x.id));
  const compras = movimientosDe(e, periodoId)
    .filter(m => m.tipo === 'egreso' && m.tarjeta_id != null && ids.has(m.tarjeta_id))
    .map(m => ({ ...m, pago: pagoDeMovimiento(e, m) }));
  const grupos = new Map<string, { mesPago: string; sueldo: string; pago: string; total: number; cantidad: number }>();
  for (const c of compras) {
    if (!c.pago) continue;
    const g = grupos.get(c.pago.mesPago) ?? { mesPago: c.pago.mesPago, sueldo: c.pago.sueldo, pago: c.pago.pago, total: 0, cantidad: 0 };
    g.total += c.valor;
    g.cantidad += 1;
    grupos.set(c.pago.mesPago, g);
  }
  return { compras, total: compras.reduce((s, c) => s + c.valor, 0), porMesPago: [...grupos.values()].sort((a, b) => a.mesPago.localeCompare(b.mesPago)) };
}

/* ---------------- Salud financiera ---------------- */
export type NivelSalud = 'bien' | 'atencion' | 'mal';
export type Indicador = { clave: 'ahorro' | 'deuda' | 'colchon'; valor: number; nivel: NivelSalud };

/**
 * Tres indicadores clásicos de finanzas personales para el mes:
 * - ahorro: (flujo libre + aportes a metas) / ingresos · sano desde 20 %
 * - deuda: pagos de deudas / ingresos · sano hasta 30 %, alto desde 40 %
 * - colchon: meses de gasto del hogar que cubre la caja acumulada · sano desde 3
 */
export function saludFinanciera(fila: ResumenPeriodo, gastoMensual: number): Indicador[] {
  const ing = fila.ingresos;
  const ahorro = ing > 0 ? (fila.flujo + fila.ahorro) / ing : 0;
  const deuda = ing > 0 ? fila.deudas / ing : fila.deudas > 0 ? 1 : 0;
  const colchon = gastoMensual > 0 ? Math.max(0, fila.caja) / gastoMensual : 0;
  return [
    { clave: 'ahorro', valor: ahorro, nivel: ahorro >= 0.2 ? 'bien' : ahorro >= 0.1 ? 'atencion' : 'mal' },
    { clave: 'deuda', valor: deuda, nivel: deuda <= 0.3 ? 'bien' : deuda <= 0.4 ? 'atencion' : 'mal' },
    { clave: 'colchon', valor: colchon, nivel: colchon >= 3 ? 'bien' : colchon >= 1 ? 'atencion' : 'mal' },
  ];
}

export function categoriasMovimiento(e: Estado, tipo: 'ingreso' | 'egreso'): string[] {
  const lista = e.categorias
    .filter(c => (tipo === 'ingreso' ? c.seccion === 'ingreso' : c.seccion !== 'ingreso'))
    .map(c => c.nombre);
  return [...lista, tipo === 'ingreso' ? OTROS_INGRESOS : OTROS_GASTOS];
}

/* ---------------- Listas de compras ---------------- */
/** Presupuesto de una lista en el mes: el rubro vinculado o el monto fijo. */
export function presupuestoLista(e: Estado, lista: Lista, periodoId: string): number {
  if (lista.rubro_id) {
    const r = e.rubros.find(x => x.id === lista.rubro_id);
    return r ? valorCelda(e, r, periodoId) : 0;
  }
  return lista.presupuesto;
}

export function totalesLista(items: ItemLista[]) {
  const total = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const comprado = items.filter(i => i.estado === 'Comprado').reduce((s, i) => s + i.cantidad * i.precio, 0);
  return { total, comprado, pendiente: total - comprado, cantidad: items.length, comprados: items.filter(i => i.estado === 'Comprado').length };
}

/** Periodo por defecto: el mes actual si existe; si no, el primero que aún no termina. */
export function periodoInicial(periodos: Periodo[], hoy = new Date()): string {
  const actual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  return (periodos.find(p => p.id >= actual) ?? periodos.at(-1) ?? { id: actual }).id;
}
