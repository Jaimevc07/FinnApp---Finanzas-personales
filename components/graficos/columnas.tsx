'use client';
// Columnas de una sola serie (p. ej. caja acumulada por mes). Columna seleccionada en naranja,
// el resto en gris; negativos crecen hacia abajo en rojo. Tooltip al pasar o tocar.
import { useEffect, useRef, useState } from 'react';
import { cop, copCorto } from '@/lib/formato';

export type DatoColumna = { id: string; etiqueta: string; corta: string; valor: number };

function pasoLimpio(rango: number, divisiones: number) {
  const bruto = rango / divisiones;
  const mag = 10 ** Math.floor(Math.log10(bruto || 1));
  const n = bruto / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

export function Columnas({
  datos, seleccionado, onSeleccionar, alto = 210, titulo,
}: { datos: DatoColumna[]; seleccionado?: string; onSeleccionar?: (id: string) => void; alto?: number; titulo: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const vacio = datos.every(d => Math.round(d.valor) === 0);

  // Se reconecta al cambiar entre el estado vacío y el gráfico (son elementos distintos).
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [vacio]);

  const izq = 46, arriba = 22, abajo = 26;
  const anchoUtil = Math.max(0, ancho - izq);
  const altoUtil = alto - arriba - abajo;
  const valores = datos.map(d => d.valor);
  const max = Math.max(0, ...valores), min = Math.min(0, ...valores);
  const paso = pasoLimpio(max - min || 1, 4);
  const techo = Math.ceil(max / paso) * paso || paso;
  const piso = Math.floor(min / paso) * paso;
  const y = (v: number) => arriba + ((techo - v) / (techo - piso)) * altoUtil;
  const ticks: number[] = [];
  for (let t = piso; t <= techo + paso / 2; t += paso) ticks.push(t);
  const banda = datos.length ? anchoUtil / datos.length : 0;
  const barra = Math.min(24, banda * 0.62);
  const saltoEtiqueta = banda < 26 ? 2 : 1;
  const activo = hover ?? datos.findIndex(d => d.id === seleccionado);
  const base = y(0);

  if (vacio) {
    return (
      <div ref={caja} className="grid h-[140px] place-items-center rounded-2xl bg-surface-2 px-6 text-center text-[13px] text-muted">
        Sin datos todavía: el gráfico aparece cuando el presupuesto tenga ingresos o gastos.
      </div>
    );
  }

  return (
    <div ref={caja} className="relative w-full select-none">
      {ancho > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label={titulo} className="block overflow-visible">
          {ticks.map(t => (
            <g key={t}>
              <line x1={izq} x2={ancho} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={izq - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular-nums">
                {t === 0 ? '0' : copCorto(t).replace(/\s(mil)$/, 'k')}
              </text>
            </g>
          ))}
          <line x1={izq} x2={ancho} y1={base} y2={base} stroke="var(--muted)" strokeOpacity={0.5} strokeWidth={1} />
          {datos.map((d, i) => {
            const cx = izq + banda * i + banda / 2;
            const h = Math.abs(y(d.valor) - base);
            const r = Math.min(4, h, barra / 2);
            const sel = d.id === seleccionado;
            const color = d.valor < 0 ? 'var(--neg)' : sel ? 'var(--accent)' : 'color-mix(in oklab, var(--ink) 22%, var(--surface))';
            const x0 = cx - barra / 2, x1 = cx + barra / 2;
            // Extremo de dato redondeado, base recta en la línea cero.
            const camino = d.valor >= 0
              ? `M${x0},${base} V${base - h + r} Q${x0},${base - h} ${x0 + r},${base - h} H${x1 - r} Q${x1},${base - h} ${x1},${base - h + r} V${base} Z`
              : `M${x0},${base} V${base + h - r} Q${x0},${base + h} ${x0 + r},${base + h} H${x1 - r} Q${x1},${base + h} ${x1},${base + h - r} V${base} Z`;
            return (
              <g key={d.id}>
                {h > 0.5 && <path d={camino} fill={color} opacity={activo >= 0 && activo !== i && !sel && hover !== null ? 0.6 : 1} />}
                {i % saltoEtiqueta === 0 || sel ? (
                  <text x={cx} y={alto - 8} textAnchor="middle" className={sel ? 'fill-ink text-[10px] font-bold' : 'fill-muted text-[10px]'}>
                    {d.corta}
                  </text>
                ) : null}
                <rect
                  x={izq + banda * i} y={arriba} width={banda} height={altoUtil} fill="transparent"
                  className={onSeleccionar ? 'cursor-pointer' : undefined}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => onSeleccionar?.(d.id)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {ancho > 0 && activo >= 0 && datos[activo] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-ink px-2.5 py-1.5 text-[11px] text-on-ink shadow-card"
          style={{
            left: Math.min(Math.max(izq + banda * activo + banda / 2, izq + 56), ancho - 60),
            top: Math.min(y(datos[activo].valor), base) - 6,
          }}
        >
          <span className="opacity-70">{datos[activo].etiqueta}</span> · <b className="font-semibold">{cop(datos[activo].valor)}</b>
        </div>
      )}
      <table className="sr-only">
        <caption>{titulo}</caption>
        <tbody>
          {datos.map(d => (
            <tr key={d.id}><th scope="row">{d.etiqueta}</th><td>{cop(d.valor)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
