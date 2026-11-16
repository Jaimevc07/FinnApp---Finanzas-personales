// Utilidades de meses del plan (ids AAAA-MM). Compartidas por el servidor y el cliente.
import type { Estado } from './tipos';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const partes = (id: string) => id.split('-').map(Number) as [number, number];
const armar = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`;

/** "2026-11" → "Nov 2026" */
export function etiquetaMes(id: string): string {
  const [a, m] = partes(id);
  return `${MESES[m - 1]} ${a}`;
}

export function mesAnterior(id: string): string {
  const [a, m] = partes(id);
  return m === 1 ? armar(a - 1, 12) : armar(a, m - 1);
}

export function mesSiguiente(id: string): string {
  const [a, m] = partes(id);
  return m === 12 ? armar(a + 1, 1) : armar(a, m + 1);
}

/** Esquema a mes vencido: el mes se paga con el sueldo del día 30 del mes anterior ("Cobro 30 Oct"). */
export function cobroDe(id: string): string {
  const previo = mesAnterior(id);
  const [a, m] = partes(previo);
  const dias = new Date(a, m, 0).getDate();
  return `Cobro ${Math.min(30, dias)} ${MESES[m - 1]}`;
}

/** "Cobro 30 Oct" → "30 Oct": el día del sueldo con que se cubre el mes (para textos claros). */
export const diaSueldo = (cobro: string) => cobro.replace(/^Cobro\s+/i, '');

export function mesActual(hoy = new Date()): string {
  return armar(hoy.getFullYear(), hoy.getMonth() + 1);
}

/** Cuántos meses hay de "desde" a "hasta" (negativo si "hasta" es antes). */
export function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = partes(desde), [a2, m2] = partes(hasta);
  return (a2 - a1) * 12 + (m2 - m1);
}

export function sumarMeses(id: string, n: number): string {
  const [a, m] = partes(id);
  const total = a * 12 + (m - 1) + n;
  return armar(Math.floor(total / 12), (total % 12) + 1);
}

export const esMes = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Días que quedan del mes, contando hoy. */
export function diasRestantes(hoy = new Date()): number {
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return fin - hoy.getDate() + 1;
}

/** Si un mes queda justo antes o justo después del plan, se puede agregar con un toque. */
export function posicionParaAgregar(e: Pick<Estado, 'periodos'>, id: string): 'anterior' | 'siguiente' | null {
  const primero = e.periodos[0]?.id, ultimo = e.periodos.at(-1)?.id;
  if (!primero || !ultimo || e.periodos.some(p => p.id === id)) return null;
  if (mesAnterior(primero) === id) return 'anterior';
  if (mesSiguiente(ultimo) === id) return 'siguiente';
  return null;
}

/** Meses con movimientos registrados que no están en el plan, con cuántos movimientos tiene cada uno. */
export function mesesFueraDelPlan(e: Pick<Estado, 'periodos' | 'movimientos'>): { id: string; cantidad: number }[] {
  const enPlan = new Set(e.periodos.map(p => p.id));
  const cuenta = new Map<string, number>();
  for (const m of e.movimientos) {
    const id = m.fecha.slice(0, 7);
    if (!enPlan.has(id)) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  }
  return [...cuenta.entries()].map(([id, cantidad]) => ({ id, cantidad })).sort((a, b) => a.id.localeCompare(b.id));
}
