// Formato único del dinero y las fechas en toda la app (ver skill diseno-fin-tech).

const MENOS = '−';
/** Espacio que no se parte: "$ 689.000" nunca queda con el "$" en una línea y el número en otra. */
const SP = ' ';
/** Une el signo al monto: no se parte entre "−" y "$". */
const WJ = '⁠';
const PESOS = `$${SP}`;

const fmtCop = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const fmtDec = (d: number) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: d });

/** $ 7.765.770  ·  −$ 45.000 */
export function cop(v: number): string {
  const n = Math.round(v || 0);
  return (n < 0 ? MENOS + WJ : '') + PESOS + fmtCop.format(Math.abs(n));
}

/** Solo el número, sin símbolo: 7.765.770 */
export function numero(v: number): string {
  return fmtCop.format(Math.round(Math.abs(v || 0)));
}

/** $9,75 M  ·  $750 mil  ·  $900 */
export function copCorto(v: number): string {
  const n = Math.abs(v || 0);
  const signo = v < 0 ? MENOS + WJ : '';
  if (n >= 1e6) return `${signo}$${fmtDec(n >= 1e7 ? 1 : 2).format(n / 1e6)}${SP}M`;
  if (n >= 1e3) return `${signo}$${fmtDec(0).format(n / 1e3)}${SP}mil`;
  return `${signo}$${fmtCop.format(n)}`;
}

/** +$ 120.000 para ingresos, −$ 45.000 para egresos */
export function conSigno(v: number, tipo: 'ingreso' | 'egreso'): string {
  return (tipo === 'ingreso' ? '+' : MENOS) + WJ + PESOS + numero(v);
}

/** Signo según el valor: +$ 1.000 / −$ 1.000 */
export function delta(v: number): string {
  if (Math.round(v) === 0) return `${PESOS}0`;
  return (v > 0 ? '+' : MENOS) + WJ + PESOS + numero(v);
}

/** Igual que delta pero sin espacio tras el "$" (cifras de KPI): +$1.000 */
export const deltaCompacto = (v: number) => delta(v).replace(PESOS, '$');

export function pct(parte: number, total: number, decimales = 0): string {
  if (!total) return `0${SP}%`;
  return `${fmtDec(decimales).format((parte / total) * 100)}${SP}%`;
}

/** 2.1 → "2,1 % mes" */
export function tasaMes(t: number): string {
  return `${fmtDec(2).format(t)}${SP}% mes`;
}

/** Interés mensual → efectivo anual: 2.1 → "28,3 % E.A." */
export function tasaEA(mensual: number): string {
  return `${fmtDec(1).format((Math.pow(1 + mensual / 100, 12) - 1) * 100)}${SP}% E.A.`;
}

export function usd(v: number): string {
  return `US$${SP}${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(v || 0)}`;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** 2026-12-05 -> "5 dic" */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

/** 2026-12-05 -> "Sábado 5 dic" */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = DIAS[new Date(a, m - 1, d).getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d} ${MESES_CORTOS[m - 1]}`;
}

export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convierte lo que escribe el usuario ("1.250.000", "1250000", "$ 1.250") en número */
export function leerMonto(texto: string): number {
  const limpio = String(texto).replace(/[^\d,-]/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}
