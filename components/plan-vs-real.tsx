'use client';
// "Cómo va el mes": por categoría y por ítem, lo gastado dentro del plan, lo que falta por gastar y lo
// que se gastó fuera del plan (gastos sin ítem del presupuesto o que pasan el tope de su ítem).
import { Check, ChevronDown, CircleAlert, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useDatos } from './proveedor';
import { cx } from './ui/botones';
import { Insignia } from './ui/datos';
import { Tarjeta } from './ui/estructura';
import { planVsReal, type ItemPlanReal, type PlanVsReal } from '@/lib/calculos';
import { cop, fechaCorta, numero } from '@/lib/formato';

type Resultado = ReturnType<typeof planVsReal>;

/** Barra apilada: gastado en el plan (negro) · falta por gastar (naranja) · fuera del plan (rojo, después del plan). */
export function BarraMes({ enPlan, pendiente, fuera, escala, alto = 'h-2' }: { enPlan: number; pendiente: number; fuera: number; escala: number; alto?: string }) {
  const w = (v: number) => `${Math.max(0, (v / Math.max(1, escala)) * 100)}%`;
  return (
    <div className={cx('flex w-full gap-0.5 overflow-hidden rounded-full bg-surface-2', alto)} aria-hidden>
      {enPlan > 0 && <div className="h-full shrink-0 rounded-full bg-ink" style={{ width: w(enPlan) }} />}
      {pendiente > 0 && <div className="h-full shrink-0 rounded-full bg-accent" style={{ width: w(pendiente) }} />}
      {fuera > 0 && <div className="h-full shrink-0 rounded-full bg-neg" style={{ width: w(fuera) }} />}
    </div>
  );
}

export function Leyenda({ color, etiqueta, valor, tono }: { color: string; etiqueta: string; valor: string; tono?: 'neg' }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <span className={cx('size-2 shrink-0 rounded-full', color)} aria-hidden /> {etiqueta}
      </p>
      <p className={cx('mt-0.5 truncate text-[14px] font-bold tabular-nums', tono === 'neg' ? 'text-neg-text' : 'text-ink')}>{valor}</p>
    </div>
  );
}

/** Si un ítem del presupuesto ya se pagó: "Pagado", "Pagado · $X de más" o lo que falta. */
export function EstadoPago({ x, sinPagar }: { x: ItemPlanReal; sinPagar?: boolean }) {
  if (x.plan > 0 && x.exceso > 0) return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <Insignia tono="neg"><CircleCheck className="size-3" /> Pagado</Insignia>
      <span className="text-[12px] font-semibold text-neg-text">{cop(x.exceso)} de más</span>
    </span>
  );
  if (x.plan > 0 && x.pendiente === 0) return <Insignia tono="pos"><CircleCheck className="size-3" /> Pagado</Insignia>;
  if (x.exceso > 0) return <span className="text-[12px] font-semibold text-neg-text">Sin presupuesto este mes</span>;
  if (x.real > 0) return <span className="text-[12px] text-muted">Pagado {cop(x.real)} · faltan <b className="font-semibold text-ink-2">{cop(x.pendiente)}</b></span>;
  return sinPagar ? <span className="text-[12px] text-muted">Sin pagar</span> : null;
}

/** Si todos los ítems de una categoría ya se pagaron (y si se gastó de más). */
export function EstadoCategoria({ f, corto }: { f: PlanVsReal; corto?: boolean }) {
  if (!(f.plan > 0 && Math.round(f.pendiente) === 0)) return null;
  return Math.round(f.fueraDelPlan) > 0
    ? <Insignia tono="neg"><CircleCheck className="size-3" /> Todo pagado{corto ? '' : ` · ${cop(f.fueraDelPlan)} de más`}</Insignia>
    : <Insignia tono="pos"><CircleCheck className="size-3" /> Todo pagado</Insignia>;
}

/** Gastos del mes que no tienen ítem del presupuesto: van al final de la categoría, solo en ese mes. */
export function GastosExtra({ f, mes, className }: { f: PlanVsReal; mes: string; className?: string }) {
  const { abrirRegistro, puedeEditar } = useDatos();
  if (!f.movsSinItem.length) return null;
  return (
    <div className={cx('rounded-2xl bg-neg-soft p-3', className)}>
      <p className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="flex items-center gap-1.5 font-semibold text-neg-text"><CircleAlert className="size-3.5" /> Gasto extra · solo {mes}</span>
        <b className="font-semibold tabular-nums text-neg-text">−{cop(f.sinItem)}</b>
      </p>
      <p className="mt-0.5 text-[11px] text-ink-2">
        No estaba en el presupuesto.{puedeEditar && f.items.length > 0 ? ' Si era de un ítem, tócalo y elígelo.' : ''}
      </p>
      <ul className="mt-1 flex flex-col">
        {f.movsSinItem.map(m => (
          <li key={m.id}>
            <button type="button" onClick={() => abrirRegistro(m)}
              className="foco flex min-h-11 w-full items-center gap-2 rounded-xl px-1 text-left hover:brightness-95">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{m.descripcion || m.categoria}</span>
                <span className="block text-[11px] text-ink-2">{fechaCorta(m.fecha)}</span>
              </span>
              <span className="shrink-0 text-[13px] font-bold tabular-nums text-neg-text">−{cop(m.valor)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Héroe de Inicio: lo gastado en el mes frente a lo presupuestado. */
export function GastadoVsPresupuesto({ mes, plan, gastado, caja }: { mes: string; plan: number; gastado: number; caja: number }) {
  const pasado = Math.round(gastado - plan) > 0;
  const escala = Math.max(1, plan, gastado);
  const pct = plan > 0 ? Math.round((gastado / plan) * 100) : null;
  return (
    <div className="w-full text-center" role="group" aria-label={`Gastado en ${mes}: ${cop(gastado)} de ${cop(plan)} presupuestados`}>
      <p className="text-[13px] font-medium text-muted">Gastado en {mes}</p>
      <p className="mt-1 text-[40px] font-bold leading-none tracking-tight lg:text-[48px]">
        <span className="mr-1 align-top text-[0.6em] leading-[1.25]">$</span>{numero(gastado)}
      </p>
      <p className="mt-2 text-[13px] text-muted">de <b className="font-semibold text-ink">{cop(plan)}</b> presupuestado</p>
      <div className="mx-auto mt-3 flex h-2 max-w-[300px] gap-0.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {Math.min(gastado, plan) > 0 && <div className="h-full shrink-0 rounded-full bg-ink" style={{ width: `${(Math.min(gastado, plan) / escala) * 100}%` }} />}
        {pasado && <div className="h-full shrink-0 rounded-full bg-neg" style={{ width: `${((gastado - plan) / escala) * 100}%` }} />}
      </div>
      <p className="mt-2 text-[13px]">
        {pasado
          ? <span className="inline-flex items-center gap-1 font-semibold text-neg-text"><CircleAlert className="size-3.5" /> Se pasaron {cop(gastado - plan)}{pct !== null ? ` · ${pct} %` : ''}</span>
          : <span className="text-ink-2">Quedan <b className="font-semibold text-ink">{cop(plan - gastado)}</b> del presupuesto{pct !== null ? <span className="text-muted"> · {pct} % usado</span> : null}</span>}
      </p>
      <p className="mt-3 text-[12px] text-muted">
        En la cuenta al cierre, si se cumple el plan: <b className={cx('font-semibold', Math.round(caja) < 0 ? 'text-neg-text' : 'text-ink-2')}>{cop(caja)}</b>
      </p>
    </div>
  );
}

export function ComoVaElMes({ r, mes }: { r: Resultado; mes: string }) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const filas = [...r.filas].sort((a, b) => b.fueraDelPlan - a.fueraDelPlan || b.real - a.real || b.plan - a.plan);
  const escala = Math.max(1, ...filas.map(f => f.cierre));
  const pasado = Math.round(r.fueraDelPlan) > 0;
  const alternar = (k: string) => setAbiertas(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <Tarjeta titulo={`Cómo va ${mes}`} subtitulo="Cada gasto cuenta contra su ítem del presupuesto. Lo que no tiene ítem es gasto fuera del plan">
      {filas.length === 0 ? (
        <p className="text-[13px] text-muted">Sin presupuesto ni movimientos este mes.</p>
      ) : (
        <>
          <div
            className="rounded-2xl bg-surface-2 p-4"
            role="group"
            aria-label={`El mes cerraría en ${cop(r.cierre)} de ${cop(r.plan)} planeados. Gastado en el plan ${cop(r.enPlan)}, falta por gastar ${cop(r.pendiente)}, fuera del plan ${cop(r.fueraDelPlan)}`}
          >
            <p className="text-[12px] font-medium text-muted">Si gastan lo que falta, el mes cerraría en</p>
            <p className={cx('mt-0.5 text-[24px] font-bold leading-tight tracking-tight', pasado && 'text-neg-text')}>{cop(r.cierre)}</p>
            <p className="text-[12px] text-muted">
              {pasado
                ? <>de {cop(r.plan)} planeados · <b className="font-semibold text-neg-text">{cop(r.fueraDelPlan)} de más</b></>
                : <>de {cop(r.plan)} planeados · sin gastos fuera del plan</>}
            </p>
            <div className="mt-3">
              <BarraMes enPlan={r.enPlan} pendiente={r.pendiente} fuera={r.fueraDelPlan} escala={Math.max(r.cierre, r.plan)} alto="h-2.5" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Leyenda color="bg-ink" etiqueta="Gastado en el plan" valor={cop(r.enPlan)} />
              <Leyenda color="bg-accent" etiqueta="Falta por gastar" valor={cop(r.pendiente)} />
              <Leyenda color="bg-neg" etiqueta="Fuera del plan" valor={r.fueraDelPlan > 0 ? `−${cop(r.fueraDelPlan)}` : cop(0)} tono={r.fueraDelPlan > 0 ? 'neg' : undefined} />
            </div>
          </div>

          <ul className="mt-4 flex flex-col divide-y divide-line">
            {filas.map(f => {
              const k = String(f.id ?? f.nombre);
              const abierta = abiertas.has(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => alternar(k)}
                    aria-expanded={abierta}
                    className="foco -mx-2 flex w-[calc(100%+1rem)] flex-col gap-1.5 rounded-2xl px-2 py-3 text-left transition hover:bg-surface-2"
                  >
                    <span className="flex w-full items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[13px] font-semibold">{f.nombre}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[13px] tabular-nums">
                        <b className="font-semibold">{cop(f.real)}</b>
                        <span className="text-muted">de {cop(f.plan)}</span>
                        <ChevronDown className={cx('size-4 text-muted transition-transform', abierta && 'rotate-180')} />
                      </span>
                    </span>
                    <BarraMes enPlan={f.enPlan} pendiente={f.pendiente} fuera={f.fueraDelPlan} escala={escala} />
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                      <EstadoCategoria f={f} corto />
                      {f.plan > 0 && f.pendiente > 0 && <span>Faltan <b className="font-semibold text-ink-2">{cop(f.pendiente)}</b> por gastar</span>}
                      {f.fueraDelPlan > 0 && <span className="font-semibold text-neg-text">−{cop(f.fueraDelPlan)} fuera del plan</span>}
                      {f.fueraDelPlan > 0 && f.plan > 0 && <span>cerraría en {cop(f.cierre)}</span>}
                    </span>
                  </button>
                  {abierta && <DetalleCategoria f={f} mes={mes} />}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}

function DetalleCategoria({ f, mes }: { f: PlanVsReal; mes: string }) {
  const items = [...f.items].sort((a, b) => b.exceso - a.exceso || b.pendiente - a.pendiente || b.real - a.real);
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-line p-3">
      {items.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {items.map(x => <FilaItem key={x.rubro.id} x={x} />)}
        </ul>
      )}
      <GastosExtra f={f} mes={mes} />
      {items.length === 0 && f.movsSinItem.length === 0 && <p className="text-[12px] text-muted">Sin ítems ni gastos este mes.</p>}
    </div>
  );
}

function FilaItem({ x }: { x: ItemPlanReal }) {
  const pagado = x.plan > 0 && x.pendiente === 0;
  return (
    <li className="flex gap-2.5">
      <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', pagado ? (x.exceso > 0 ? 'bg-neg text-white' : 'bg-pos text-white') : 'border-2 border-line')} aria-hidden>
        {pagado && <Check className="size-3" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className={cx('min-w-0 truncate font-medium', pagado && 'text-ink-2')}>{x.rubro.nombre}</span>
          <span className="shrink-0 tabular-nums"><b className="font-semibold">{cop(x.real)}</b> <span className="text-muted">de {cop(x.plan)}</span></span>
        </p>
        {!pagado && (
          <div className="mt-1">
            <BarraMes enPlan={Math.min(x.real, x.plan)} pendiente={x.pendiente} fuera={x.exceso} escala={Math.max(x.plan, x.real)} alto="h-1.5" />
          </div>
        )}
        <div className="mt-1"><EstadoPago x={x} sinPagar /></div>
      </div>
    </li>
  );
}
