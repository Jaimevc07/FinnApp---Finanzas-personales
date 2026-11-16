// Tarjeta oscura tipo crédito de Inicio: cuánto entra, cuánto sale y cuánto sobra en el mes.
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { conSigno, numero } from '@/lib/formato';
import { diaSueldo } from '@/lib/meses';
import { cx } from './botones';
import { Marca } from './marca';

export function TarjetaFin({ titular, mes, cobro, ingresos, egresos, className }: {
  titular: string;
  /** "Nov 2026" */
  mes: string;
  /** "Cobro 30 Oct": con qué sueldo se paga el mes (esquema a mes vencido) */
  cobro: string;
  ingresos: number;
  egresos: number;
  className?: string;
}) {
  const sobra = ingresos - egresos;
  const falta = Math.round(sobra) < 0;
  const pctGasto = ingresos > 0 ? egresos / ingresos : egresos > 0 ? 1 : 0;
  const anchoGasto = Math.min(100, pctGasto * 100);
  const sueldo = diaSueldo(cobro);

  return (
    <div
      role="group"
      aria-label={`${mes}: entran ${numero(ingresos)} pesos, salen ${numero(egresos)}, ${falta ? 'faltan' : 'sobran'} ${numero(sobra)}`}
      className={cx('relative isolate w-full max-w-[340px] overflow-hidden rounded-[20px] p-5 text-fin-ink shadow-fin', className)}
      style={{
        background:
          'radial-gradient(120% 90% at 100% 0%, var(--fin-glow) 0%, transparent 55%), linear-gradient(145deg, var(--fin-from), var(--fin-to))',
      }}
    >
      {/* Textura sutil de líneas para dar profundidad */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 14px)' }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{titular}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fin-muted">Plan de {mes}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold tracking-tight">
          <Marca className="size-5" claro /> fin
        </span>
      </div>

      <div className="mt-5">
        <p className="text-[12px] font-medium text-fin-muted">{falta ? `Les falta en ${mes}` : `Les sobra en ${mes}`}</p>
        <p className={cx('mt-0.5 text-[28px] font-bold leading-tight tracking-tight', falta && 'text-fin-neg')}>
          {falta ? '−' : ''}
          <span className="mr-0.5 align-top text-[0.6em] leading-[1.4]">$</span>
          {numero(sobra)}
        </p>
        <p className="mt-0.5 text-[12px] text-fin-muted">
          {ingresos > 0
            ? falta
              ? `Sale más de lo que entra: gastan el ${Math.round(pctGasto * 100)} %`
              : `Gastan el ${Math.round(pctGasto * 100)} % de lo que entra`
            : 'Este mes no tiene ingresos en el plan'}
        </p>
      </div>

      {/* Qué parte de lo que entra se va (blanco) y qué parte sobra (naranja) */}
      <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-fin-track" aria-hidden>
        {anchoGasto > 0 && <div className={cx('h-full rounded-full', falta ? 'bg-fin-neg' : 'bg-fin-ink')} style={{ width: `${anchoGasto}%` }} />}
        {!falta && anchoGasto < 100 && <div className="h-full flex-1 rounded-full bg-accent" />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-medium text-fin-muted"><ArrowDownLeft className="size-3.5" /> Entra</p>
          <p className="mt-0.5 truncate text-[14px] font-bold tabular-nums text-fin-pos">{conSigno(ingresos, 'ingreso')}</p>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-medium text-fin-muted"><ArrowUpRight className="size-3.5" /> Sale</p>
          <p className="mt-0.5 truncate text-[14px] font-bold tabular-nums text-fin-neg">{conSigno(egresos, 'egreso')}</p>
        </div>
      </div>

      <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-fin-muted">
        Gastos, deudas y ahorro del mes · se cubren con el sueldo del <b className="font-semibold text-fin-ink">{sueldo}</b>
      </p>
    </div>
  );
}
