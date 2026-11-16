// Tarjeta oscura de Inicio (dos tarjetas apiladas): lo que entró frente a lo que salió en el mes, con los
// movimientos registrados. Debajo, en pequeño, lo que falta por gastar del plan y lo gastado fuera del plan.
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { conSigno, cop, numero } from '@/lib/formato';
import { diaSueldo } from '@/lib/meses';
import { cx } from './botones';
import { Marca } from './marca';

export function TarjetaFin({ titular, mes, cobro, ingresosPlan, ingresosReal, egresosReal, porGastar, fueraDelPlan, className }: {
  titular: string;
  /** "Nov 2026" */
  mes: string;
  /** "Cobro 30 Oct": con qué sueldo se paga el mes (esquema a mes vencido) */
  cobro: string;
  /** Ingresos del presupuesto del mes */
  ingresosPlan: number;
  /** Lo registrado en movimientos del mes */
  ingresosReal: number;
  egresosReal: number;
  /** Lo que falta por gastar de cada ítem del plan */
  porGastar: number;
  /** Gastos sin ítem del presupuesto o que pasan el tope de su ítem */
  fueraDelPlan: number;
  className?: string;
}) {
  const balance = ingresosReal - egresosReal;
  const negativo = Math.round(balance) < 0;
  const escala = Math.max(1, ingresosReal, egresosReal);
  const pct = ingresosReal > 0 ? Math.round((egresosReal / ingresosReal) * 100) : null;
  const sueldo = diaSueldo(cobro);

  return (
    <div className={cx('relative isolate w-full max-w-[340px] pb-3', className)}>
      {/* La tarjeta de atrás: asoma por debajo */}
      <div aria-hidden className="absolute inset-x-4 top-4 bottom-0 -z-10 rounded-[20px] shadow-fin" style={{ background: 'var(--fin-atras)' }} />

      <div
        role="group"
        aria-label={`${mes}: ingresó ${numero(ingresosReal)} pesos y gastaron ${numero(egresosReal)}. ${negativo ? 'Faltan' : 'Quedan'} ${numero(Math.abs(balance))}`}
        className="relative overflow-hidden rounded-[20px] p-5 text-fin-ink shadow-fin"
        style={{ background: 'radial-gradient(120% 90% at 100% 0%, var(--fin-glow) 0%, transparent 55%), linear-gradient(145deg, var(--fin-from), var(--fin-to))' }}
      >
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
          <p className="text-[12px] font-medium text-fin-muted">{negativo ? 'Gastaron más de lo que entró' : 'Les queda de lo que entró'}</p>
          <p className={cx('mt-0.5 text-[28px] font-bold leading-tight tracking-tight', negativo && 'text-fin-neg')}>
            {negativo && <span aria-hidden>−</span>}
            <span className="mr-0.5 align-top text-[0.6em] leading-[1.4]">$</span>
            {numero(Math.abs(balance))}
          </p>
          <p className="mt-0.5 text-[12px] text-fin-muted">
            {pct === null ? `Aún no registran ingresos de ${mes}` : `Gastaron el ${pct} % de lo que entró`}
          </p>
        </div>

        {/* Entró frente a salió, en la misma escala */}
        <div className="mt-4 flex flex-col gap-3">
          <Fila icono={<ArrowDownLeft className="size-3.5" />} etiqueta="Entró" valor={conSigno(ingresosReal, 'ingreso')} tono="text-fin-pos"
            ancho={ingresosReal / escala} barra="bg-fin-pos" nota={`de ${cop(ingresosPlan)} esperados`} />
          <Fila icono={<ArrowUpRight className="size-3.5" />} etiqueta="Salió" valor={conSigno(egresosReal, 'egreso')} tono="text-fin-neg"
            ancho={egresosReal / escala} barra="bg-fin-neg" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px] text-fin-muted">
          <p className="min-w-0">Falta por gastar<b className="mt-0.5 block truncate text-[12px] font-semibold text-fin-ink tabular-nums">{cop(porGastar)}</b></p>
          <p className="min-w-0">Fuera del plan<b className={cx('mt-0.5 block truncate text-[12px] font-semibold tabular-nums', fueraDelPlan > 0 ? 'text-fin-neg' : 'text-fin-ink')}>{fueraDelPlan > 0 ? `−${cop(fueraDelPlan)}` : cop(0)}</b></p>
        </div>
        <p className="mt-2 text-[10px] text-fin-muted">Se paga con el sueldo del {sueldo}</p>
      </div>
    </div>
  );
}

function Fila({ icono, etiqueta, valor, tono, ancho, barra, nota }: {
  icono: React.ReactNode; etiqueta: string; valor: string; tono: string; ancho: number; barra: string; nota?: string;
}) {
  return (
    <div>
      <p className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-fin-muted">{icono} {etiqueta}</span>
        <span className="min-w-0 truncate text-right">
          <b className={cx('text-[14px] font-bold tabular-nums', tono)}>{valor}</b>
          {nota && <span className="ml-1.5 text-[10px] text-fin-muted">{nota}</span>}
        </span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fin-track" aria-hidden>
        {ancho > 0 && <div className={cx('h-full rounded-full', barra)} style={{ width: `${Math.min(1, ancho) * 100}%` }} />}
      </div>
    </div>
  );
}
