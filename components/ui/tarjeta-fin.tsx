// Tarjeta oscura tipo crédito de Inicio: lo que ingresó, lo que se espera gastar y lo que se lleva gastado
// en el mes (real, con los movimientos registrados), y cuánto queda por gastar.
import { ArrowDownLeft, ArrowUpRight, Target } from 'lucide-react';
import { conSigno, cop, numero } from '@/lib/formato';
import { diaSueldo } from '@/lib/meses';
import { cx } from './botones';
import { Marca } from './marca';

export function TarjetaFin({ titular, mes, cobro, ingresosPlan, egresosPlan, ingresosReal, egresosReal, porGastar, fueraDelPlan, className }: {
  titular: string;
  /** "Nov 2026" */
  mes: string;
  /** "Cobro 30 Oct": con qué sueldo se paga el mes (esquema a mes vencido) */
  cobro: string;
  /** Lo del presupuesto del mes */
  ingresosPlan: number;
  egresosPlan: number;
  /** Lo registrado en movimientos del mes */
  ingresosReal: number;
  egresosReal: number;
  /** Lo que falta por gastar de cada ítem del plan */
  porGastar: number;
  /** Gastos sin ítem del presupuesto o que pasan el tope de su ítem */
  fueraDelPlan: number;
  className?: string;
}) {
  const queda = porGastar;
  const pasado = Math.round(fueraDelPlan) > 0;
  const cierre = egresosReal + porGastar;
  const enPlan = egresosReal - fueraDelPlan;
  const pctGasto = egresosPlan > 0 ? enPlan / egresosPlan : 0;
  const escala = Math.max(1, cierre, egresosPlan);
  const sobra = ingresosPlan - cierre;
  const sueldo = diaSueldo(cobro);

  return (
    <div
      role="group"
      aria-label={`${mes}: ingresó ${numero(ingresosReal)} pesos, se espera gastar ${numero(egresosPlan)}, llevan gastado ${numero(egresosReal)}`}
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
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fin-muted">{mes}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold tracking-tight">
          <Marca className="size-5" claro /> fin
        </span>
      </div>

      <div className="mt-5">
        <p className="text-[12px] font-medium text-fin-muted">Falta por gastar en {mes}</p>
        <p className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">
          <span className="mr-0.5 align-top text-[0.6em] leading-[1.4]">$</span>
          {numero(Math.max(0, queda))}
        </p>
        <p className="mt-0.5 text-[12px] text-fin-muted">
          {pasado
            ? <><b className="font-semibold text-fin-neg">−{cop(fueraDelPlan)} fuera del plan</b> · el mes cerraría en {cop(cierre)}</>
            : egresosPlan > 0
              ? `Llevan el ${Math.round(pctGasto * 100)} % de lo que esperan gastar`
              : 'Aún no hay gastos en el plan de este mes'}
        </p>
      </div>

      {/* Gastado en el plan (blanco) · falta por gastar (naranja) · fuera del plan (rojo) */}
      <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-fin-track" aria-hidden>
        {enPlan > 0 && <div className="h-full shrink-0 rounded-full bg-fin-ink" style={{ width: `${(enPlan / escala) * 100}%` }} />}
        {porGastar > 0 && <div className="h-full shrink-0 rounded-full bg-accent" style={{ width: `${(porGastar / escala) * 100}%` }} />}
        {fueraDelPlan > 0 && <div className="h-full shrink-0 rounded-full bg-fin-neg" style={{ width: `${(fueraDelPlan / escala) * 100}%` }} />}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-medium text-fin-muted"><ArrowDownLeft className="size-3.5 shrink-0" /> Ingresó</p>
          <p className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-fin-pos">{conSigno(ingresosReal, 'ingreso')}</p>
          <p className="truncate text-[10px] text-fin-muted">de {cop(ingresosPlan)}</p>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-medium text-fin-muted"><Target className="size-3.5 shrink-0" /> Se espera gastar</p>
          <p className="mt-0.5 truncate text-[13px] font-bold tabular-nums">{cop(egresosPlan)}</p>
          <p className="truncate text-[10px] text-fin-muted">según el plan</p>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-medium text-fin-muted"><ArrowUpRight className="size-3.5 shrink-0" /> Gastado real</p>
          <p className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-fin-neg">{conSigno(egresosReal, 'egreso')}</p>
          <p className="truncate text-[10px] text-fin-muted">registrado</p>
        </div>
      </div>

      <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-fin-muted">
        {pasado ? 'Con lo gastado de más les' : 'Según el plan les'} {Math.round(sobra) < 0 ? 'falta' : 'sobra'} <b className={cx('font-semibold', Math.round(sobra) < 0 ? 'text-fin-neg' : 'text-fin-ink')}>{cop(Math.abs(sobra))}</b> en el mes
        · se cubre con el sueldo del <b className="font-semibold text-fin-ink">{sueldo}</b>
      </p>
    </div>
  );
}
