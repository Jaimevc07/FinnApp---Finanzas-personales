'use client';
// "Cómo va el mes": por categoría y por ítem, lo gastado dentro del plan, lo que falta por gastar y lo
// que se gastó fuera del plan (gastos sin ítem del presupuesto o que pasan el tope de su ítem).
import { ChevronDown, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useDatos } from './proveedor';
import { cx } from './ui/botones';
import { Tarjeta } from './ui/estructura';
import { planVsReal, type ItemPlanReal, type PlanVsReal } from '@/lib/calculos';
import { cop, fechaCorta } from '@/lib/formato';
import type { Movimiento } from '@/lib/tipos';

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
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
                      {f.plan > 0 && <span>{f.pendiente > 0 ? <>Faltan <b className="font-semibold text-ink-2">{cop(f.pendiente)}</b> por gastar</> : 'Ya se gastó todo lo del plan'}</span>}
                      {f.fueraDelPlan > 0 && <span className="font-semibold text-neg-text">−{cop(f.fueraDelPlan)} fuera del plan</span>}
                      {f.fueraDelPlan > 0 && f.plan > 0 && <span>cerraría en {cop(f.cierre)}</span>}
                    </span>
                  </button>
                  {abierta && <DetalleCategoria f={f} />}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}

function DetalleCategoria({ f }: { f: PlanVsReal }) {
  const { abrirRegistro, puedeEditar } = useDatos();
  const items = [...f.items].sort((a, b) => b.exceso - a.exceso || b.pendiente - a.pendiente || b.real - a.real);
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-line p-3">
      {items.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {items.map(x => <FilaItem key={x.rubro.id} x={x} />)}
        </ul>
      )}
      {f.movsSinItem.length > 0 && (
        <div className={cx(items.length > 0 && 'border-t border-line pt-3')}>
          <p className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="font-semibold text-ink-2">Sin ítem del presupuesto</span>
            <b className="font-semibold tabular-nums text-neg-text">−{cop(f.sinItem)}</b>
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            No estaban en el plan, así que suman de más.{puedeEditar && f.items.length > 0 ? ' Si corresponden a un ítem, tócalos y elígelo.' : ''}
          </p>
          <ul className="mt-1.5 flex flex-col">
            {f.movsSinItem.map(m => <FilaMov key={m.id} m={m} onClick={() => abrirRegistro(m)} />)}
          </ul>
        </div>
      )}
      {items.length === 0 && f.movsSinItem.length === 0 && <p className="text-[12px] text-muted">Sin ítems ni gastos este mes.</p>}
    </div>
  );
}

function FilaItem({ x }: { x: ItemPlanReal }) {
  const estado =
    x.exceso > 0 ? <span className="font-semibold text-neg-text">{x.plan > 0 ? `se pasó ${cop(x.exceso)}` : 'sin presupuesto este mes'}</span>
    : x.pendiente === 0 ? <span className="inline-flex items-center gap-1"><CircleCheck className="size-3.5" /> completo</span>
    : x.real === 0 ? <span>falta todo</span>
    : <span>quedan <b className="font-semibold text-ink-2">{cop(x.pendiente)}</b></span>;
  return (
    <li>
      <p className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate font-medium">{x.rubro.nombre}</span>
        <span className="shrink-0 tabular-nums"><b className="font-semibold">{cop(x.real)}</b> <span className="text-muted">de {cop(x.plan)}</span></span>
      </p>
      <div className="mt-1">
        <BarraMes enPlan={Math.min(x.real, x.plan)} pendiente={x.pendiente} fuera={x.exceso} escala={Math.max(x.plan, x.real)} alto="h-1.5" />
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{estado}</p>
    </li>
  );
}

function FilaMov({ m, onClick }: { m: Movimiento; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="foco -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-surface-2">
        <span className="min-w-0 flex-1 truncate text-[13px]">{m.descripcion || m.categoria}</span>
        <span className="shrink-0 text-[12px] text-muted">{fechaCorta(m.fecha)}</span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-neg-text">−{cop(m.valor)}</span>
      </button>
    </li>
  );
}
