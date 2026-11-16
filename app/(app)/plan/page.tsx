'use client';
import { Check, CircleCheck, Coins, CreditCard, Ellipsis, Lightbulb, Plane, Plus, Target, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { HojaDeuda, HojaEvento, type EventoSel } from '@/components/deudas';
import { FilaMeta, HojaMeta } from '@/components/metas';
import { useDatos } from '@/components/proveedor';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { ConDatos } from '@/components/shell';
import { PastillaSuave, cx } from '@/components/ui/botones';
import { Campo, Entrada, EntradaDinero } from '@/components/ui/campos';
import { Insignia, Medidor, MontoHeroe } from '@/components/ui/datos';
import { EncabezadoPantalla, Tarjeta, Vacio } from '@/components/ui/estructura';
import { calcularMetas, cuposTarjetas, eventosPlaneados, planDeudas, tablero, tarjetaPrincipal, type CupoTarjeta, type Deuda } from '@/lib/calculos';
import type { LucideIcon } from 'lucide-react';
import { cop, copCorto, pct, tasaEA, tasaMes, usd } from '@/lib/formato';
import { iconoRubro } from '@/lib/iconos';
import { diaSueldo } from '@/lib/meses';
import type { Meta, Rubro } from '@/lib/tipos';

export default function Plan() {
  return (
    <ConDatos>
      <VistaPlan />
    </ConDatos>
  );
}

function VistaPlan() {
  const { estado, filas, periodoId, setConfig } = useDatos();
  const [deuda, setDeuda] = useState<{ abierta: boolean; rubro: Rubro | null }>({ abierta: false, rubro: null });
  const [evento, setEvento] = useState<{ abierta: boolean; sel: EventoSel }>({ abierta: false, sel: null });
  const [meta, setMeta] = useState<{ abierta: boolean; meta: Meta | null }>({ abierta: false, meta: null });

  const t = tablero(estado, filas);
  const deudas = planDeudas(estado, periodoId);
  const eventos = eventosPlaneados(estado);
  const metas = calcularMetas(estado, filas, periodoId);
  const pagado = deudas.reduce((s, d) => s + d.pagado, 0);
  const pendiente = deudas.reduce((s, d) => s + d.restante, 0);
  const periodo = estado.periodos.find(p => p.id === periodoId);
  const idxActual = estado.periodos.findIndex(p => p.id === periodoId);
  const c = estado.config;
  const categoriaDe = (r: Rubro) => estado.categorias.find(x => x.id === r.categoria_id);
  // Método avalancha: si sobra plata, abonar primero a la deuda activa con el interés más alto.
  const activas = deudas.filter(d => !d.liquidada && d.restante > 0.5 && (d.rubro.tasa ?? 0) > 0)
    .sort((a, b) => (b.rubro.tasa ?? 0) - (a.rubro.tasa ?? 0));
  const prioridad = activas.length >= 2 ? activas[0] : null;
  const cupos = cuposTarjetas(estado, periodoId);
  // Deudas agrupadas por tarjeta: las que usan el cupo de otra van en la misma ficha (la principal primero)
  const grupos: Deuda[][] = [];
  for (const d of deudas) {
    const id = tarjetaPrincipal(estado, d.rubro).id;
    const g = grupos.find(x => tarjetaPrincipal(estado, x[0].rubro).id === id);
    if (!g) grupos.push([d]);
    else if (d.rubro.id === id) g.unshift(d);
    else g.push(d);
  }

  return (
    <>
      <EncabezadoPantalla titulo="Deudas y metas" subtitulo={<>Plan de pagos · <b className="font-semibold text-ink">metas de ahorro</b></>} />

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <section className="flex flex-col items-center gap-5 lg:rounded-3xl lg:bg-surface lg:p-6 lg:shadow-card">
            <SelectorPeriodo />
            <MontoHeroe centrado etiqueta={`Deuda pendiente al cierre de ${periodo?.etiqueta ?? ''}`} valor={pendiente}
              detalle={<>Pagado hasta ese mes: <b className="font-semibold text-ink">{cop(pagado)}</b> · Pagos en el plan: {cop(t.deudaExtinta)}</>} />
            <Medidor className="max-w-sm" valor={pagado + pendiente ? pagado / (pagado + pendiente) : 0} tono={pendiente <= 0.5 && pagado > 0 ? 'pos' : 'ink'} etiqueta="Avance del plan de deudas" />
          </section>

          <Tarjeta
            titulo="Deudas"
            subtitulo="Marcado como pagado hasta el mes seleccionado"
            accion={<PastillaSuave icono={Plus} onClick={() => setDeuda({ abierta: true, rubro: null })}>Agregar</PastillaSuave>}
          >
            {prioridad && (
              <p className="mb-3 flex items-start gap-2.5 rounded-2xl bg-surface-2 p-3 text-[12px] text-ink-2">
                <Lightbulb className="mt-px size-4 shrink-0 text-accent-strong" />
                <span>
                  Si les sobra plata, abonen primero a <b className="font-semibold text-ink">{prioridad.rubro.nombre}</b>: es la de mayor
                  interés ({tasaMes(prioridad.rubro.tasa ?? 0)} ≈ {tasaEA(prioridad.rubro.tasa ?? 0)}). Así pagan menos intereses en total.
                </span>
              </p>
            )}
            {deudas.length === 0 ? (
              <Vacio icono={CreditCard} titulo="Sin deudas en el plan" texto="Agrega tarjetas, créditos o préstamos con su saldo y la cuota que pueden pagar." />
            ) : (
              <ul className="flex flex-col gap-3">
                {grupos.filter(g => g.length > 1).map(g => (
                  <TarjetaCompartida key={g[0].rubro.id} partes={g} cupo={cupos.find(x => x.rubro.id === g[0].rubro.id)}
                    icono={iconoRubro(g[0].rubro, categoriaDe(g[0].rubro))} trm={c.trm} onEditar={r => setDeuda({ abierta: true, rubro: r })} />
                ))}
                {grupos.filter(g => g.length === 1).map(g => g[0]).map(d => {
                  const Icono = iconoRubro(d.rubro, categoriaDe(d.rubro));
                  const enCurso = d.pagado > 0 && !d.liquidada;
                  const base = d.pagado + d.restante;
                  return (
                    <li key={d.rubro.id} className="rounded-2xl border border-line p-4">
                      <div className="flex items-start gap-3">
                        <span className={cx('grid size-10 shrink-0 place-items-center rounded-2xl', d.liquidada ? 'bg-pos-soft text-pos-text' : 'bg-surface-2 text-ink-2')}>
                          {d.liquidada ? <CircleCheck className="size-5" /> : <Icono className="size-5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold leading-snug">{d.rubro.nombre}</p>
                          <p className="text-[12px] text-muted">
                            {[
                              d.categoria,
                              d.rubro.saldo_usd ? `${usd(d.rubro.saldo_usd)} a TRM ${cop(c.trm)}` : d.saldoInicial ? `Saldo ${cop(d.saldoInicial)}` : null,
                              d.rubro.tasa ? `${tasaMes(d.rubro.tasa)} (${tasaEA(d.rubro.tasa)})` : null,
                            ].filter(Boolean).join(' · ')}
                          </p>
                          <Insignia className="mt-1.5" tono={d.liquidada ? 'pos' : enCurso ? 'accent' : 'neutro'}>
                            {d.liquidada ? <><Check className="size-3" /> Liquidada</> : enCurso ? 'En curso' : 'Pendiente'}
                          </Insignia>
                        </div>
                        <button type="button" onClick={() => setDeuda({ abierta: true, rubro: d.rubro })} aria-label={`Editar ${d.rubro.nombre}`}
                          className="foco -mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                          <Ellipsis className="size-5" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-baseline justify-between text-[13px]">
                        <span className="text-muted">Pagado {cop(d.pagado)} · debe {cop(d.restante)}</span>
                        <span className="font-semibold tabular-nums">{pct(d.pagado, base)}</span>
                      </div>
                      <Medidor className="mt-1.5" valor={base ? d.pagado / base : 0} tono={d.liquidada ? 'pos' : 'ink'} etiqueta={`Avance ${d.rubro.nombre}`} />
                      {cupos.find(x => x.rubro.id === d.rubro.id) && <BloqueCupo c={cupos.find(x => x.rubro.id === d.rubro.id)!} />}
                      <FaltaProgramar d={d} />
                      <PagosDeuda d={d} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Viajes y eventos"
            subtitulo="Gastos grandes reservados en el presupuesto"
            accion={<PastillaSuave icono={Plus} onClick={() => setEvento({ abierta: true, sel: null })}>Agregar</PastillaSuave>}
          >
            {eventos.length ? (
              <ol className="relative flex flex-col gap-1 border-l border-line pl-4">
                {eventos.map((ev, i) => {
                  const pasado = estado.periodos.findIndex(p => p.id === ev.periodo.id) <= idxActual;
                  const IconoEv = iconoRubro(ev.rubro, categoriaDe(ev.rubro));
                  return (
                    <li key={i} className="relative">
                      <span className={cx('absolute top-4 -left-[23px] size-3.5 rounded-full ring-4 ring-surface', pasado ? 'bg-ink' : 'bg-accent')} />
                      <button type="button" onClick={() => setEvento({ abierta: true, sel: { rubro: ev.rubro, periodoId: ev.periodo.id } })}
                        className="foco flex w-full items-start justify-between gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-surface-2">
                        <span className="flex min-w-0 items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><IconoEv className="size-4" /></span>
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold">{ev.rubro.nombre}</span>
                            <span className="block text-[12px] text-muted">{ev.periodo.etiqueta} · con el sueldo del {diaSueldo(ev.periodo.cobro)}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-[14px] font-semibold tabular-nums">{cop(ev.valor)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Vacio icono={Plane} titulo="Sin viajes ni eventos" texto="Reserva con tiempo los gastos grandes: viajes, matrículas, celebraciones." />
            )}
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-5">
          <Tarjeta
            titulo="Metas"
            subtitulo={`Avance a ${periodo?.etiqueta ?? ''}`}
            accion={<PastillaSuave icono={Plus} onClick={() => setMeta({ abierta: true, meta: null })}>Agregar</PastillaSuave>}
          >
            {metas.length ? (
              <>
                <ul className="flex flex-col gap-3">
                  {metas.map(m => <FilaMeta key={m.meta.id} m={m} onEditar={() => setMeta({ abierta: true, meta: m.meta })} />)}
                </ul>
                {t.hayMetasCaja && (
                  <p className="mt-3 text-[12px] text-muted">
                    Lo que se puede gastar extra sin tocar las metas que se pagan con lo que sobra:<b className={cx('font-semibold', t.simulador < 0 ? 'text-neg-text' : 'text-ink')}>{cop(t.simulador)}</b>
                  </p>
                )}
              </>
            ) : (
              <Vacio icono={Target} titulo="Sin metas todavía" texto="Crea una meta (carro, viaje, fondo de emergencias) y la app te dice cuánto ahorrar cada mes." />
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Dólar y ahorro cambiario"
            subtitulo={t.usdTotal ? `Deudas en USD: ${usd(t.usdTotal)} = ${cop(t.usdTotal * c.trm)}` : 'Sin deudas en dólares'}
            accion={<span className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2"><Coins className="size-5" /></span>}
          >
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="TRM actual" htmlFor="trm">
                <EntradaDinero id="trm" valor={c.trm} onValor={v => setConfig({ trm: v })} />
              </Campo>
              <Campo etiqueta="TRM de referencia" htmlFor="trm-ref">
                <EntradaDinero id="trm-ref" valor={c.trm_referencia} onValor={v => setConfig({ trm_referencia: v })} />
              </Campo>
            </div>
            {t.usdTotal > 0 && (
              <div className={cx('mt-4 rounded-2xl p-4', t.ahorroCambiario >= 0 ? 'bg-pos-soft' : 'bg-neg-soft')}>
                <p className="text-[12px] text-ink-2">{t.ahorroCambiario >= 0 ? 'Ahorro' : 'Sobrecosto'} por pagar con la TRM actual</p>
                <p className={cx('text-[22px] font-bold tracking-tight', t.ahorroCambiario >= 0 ? 'text-pos-text' : 'text-neg-text')}>
                  {t.ahorroCambiario >= 0 ? '+' : '−'}{cop(Math.abs(t.ahorroCambiario))}
                </p>
              </div>
            )}
            <p className="mt-3 text-[12px] text-muted">Cambiar la TRM recalcula los pagos automáticos de las deudas en dólares.</p>
          </Tarjeta>

          <Tarjeta titulo="Proyección después del plan"
            subtitulo={`Flujo libre mensual después de ${estado.periodos.at(-1)?.etiqueta ?? 'el plan'}. Con él se proyectan las metas de fechas posteriores.`}>
            <p className={cx('text-[28px] font-bold leading-tight tracking-tight', t.flujo2028 < 0 && 'text-neg-text')}>{cop(t.flujo2028)}</p>
            <div className="mt-4 grid gap-3">
              <Campo etiqueta="Ingresos mensuales" htmlFor="p-ing">
                <EntradaDinero id="p-ing" valor={c.ingreso_2028} onValor={v => setConfig({ ingreso_2028: v })} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Gasto operativo" htmlFor="p-op">
                  <EntradaDinero id="p-op" valor={c.operativo_2028} onValor={v => setConfig({ operativo_2028: v })} />
                </Campo>
                <Campo etiqueta="Nuevas cuotas" htmlFor="p-carro">
                  <EntradaDinero id="p-carro" valor={c.cuota_carro_2028} onValor={v => setConfig({ cuota_carro_2028: v })} />
                </Campo>
              </div>
              <Campo etiqueta="Nota" htmlFor="p-nota">
                <Entrada id="p-nota" value={c.nota_2028} onChange={e => setConfig({ nota_2028: e.target.value })} placeholder="Ej: cuota del carro + gasolina" />
              </Campo>
            </div>
          </Tarjeta>
        </div>
      </div>

      <HojaDeuda deuda={deuda.rubro} abierta={deuda.abierta} onCerrar={() => setDeuda(d => ({ ...d, abierta: false }))} />
      <HojaEvento evento={evento.sel} abierta={evento.abierta} onCerrar={() => setEvento(e => ({ ...e, abierta: false }))} />
      <HojaMeta meta={meta.meta} abierta={meta.abierta} onCerrar={() => setMeta(m => ({ ...m, abierta: false }))} />
    </>
  );
}

/* ---------------- Piezas de las deudas ---------------- */
function BloqueCupo({ c }: { c: CupoTarjeta }) {
  const bajo = c.disponible < c.cupo * 0.1;
  return (
    <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-[12px]">
      <p className="flex items-baseline justify-between gap-2">
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-ink-2"><CreditCard className="size-3.5" /> Cupo disponible</span>
        <b className={cx('min-w-0 text-right font-semibold tabular-nums', c.disponible < 0 ? 'text-neg-text' : bajo ? 'text-warn-text' : 'text-ink')}>
          {cop(c.disponible)} de {cop(c.cupo)}
        </b>
      </p>
      <Medidor className="mt-2 bg-surface!" valor={c.cupo ? c.usado / c.cupo : 0} tono={c.disponible < 0 ? 'neg' : 'ink'} etiqueta={`Cupo usado de ${c.rubro.nombre}`} />
      <p className="mt-1.5 text-muted">
        Usado {cop(c.usado)}{c.compras > 0 ? `: deuda del plan ${cop(c.deudaPlan)} + compras registradas ${cop(c.compras)}` : ''}
      </p>
    </div>
  );
}

function FaltaProgramar({ d }: { d: Deuda }) {
  if (d.faltaProgramar <= 0.5) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-warn-text">
      <TriangleAlert className="size-3.5 shrink-0" /> Faltan {cop(d.faltaProgramar)} por programar al final del plan
    </p>
  );
}

function PagosDeuda({ d }: { d: Deuda }) {
  if (!d.pagos.length) return <p className="mt-2 text-[12px] text-muted">Sin pagos programados. Toca ⋯ para definir la cuota.</p>;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {d.pagos.map(p => (
        <Insignia key={p.periodo.id} tono={p.hecho ? 'pos' : 'neutro'}>
          {p.hecho && <Check className="size-3" />}
          {p.periodo.etiqueta} · {copCorto(p.valor)}
        </Insignia>
      ))}
    </div>
  );
}

/** Nombre común de la tarjeta: "TC 1 Bancolombia Clásica (Deuda USD)" → "TC 1 Bancolombia Clásica". */
const nombreTarjeta = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '').trim() || n;
const detalleParte = (n: string) => n.match(/\(([^)]*)\)\s*$/)?.[1] ?? '';

/** Una tarjeta con varias deudas (p. ej. una parte en pesos y otra en dólares) que comparten cupo. */
function TarjetaCompartida({ partes, cupo, icono: Icono, trm, onEditar }: {
  partes: Deuda[]; cupo?: CupoTarjeta; icono: LucideIcon; trm: number; onEditar: (r: Rubro) => void;
}) {
  const pagado = partes.reduce((s, d) => s + d.pagado, 0);
  const debe = partes.reduce((s, d) => s + d.restante, 0);
  const base = pagado + debe;
  const liquidada = partes.every(d => d.liquidada);
  const enCurso = !liquidada && pagado > 0;
  const nombre = nombreTarjeta(partes[0].rubro.nombre);
  const monedas = [...new Set(partes.map(d => (d.rubro.saldo_usd ? 'dólares' : 'pesos')))];

  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-2xl', liquidada ? 'bg-pos-soft text-pos-text' : 'bg-surface-2 text-ink-2')}>
          {liquidada ? <CircleCheck className="size-5" /> : <Icono className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug">{nombre}</p>
          <p className="text-[12px] text-muted">{partes[0].categoria} · {partes.length} partes{monedas.length > 1 ? ': pesos y dólares' : ''}</p>
          <Insignia className="mt-1.5" tono={liquidada ? 'pos' : enCurso ? 'accent' : 'neutro'}>
            {liquidada ? <><Check className="size-3" /> Liquidada</> : enCurso ? 'En curso' : 'Pendiente'}
          </Insignia>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between text-[13px]">
        <span className="text-muted">Pagado {cop(pagado)} · debe {cop(debe)}</span>
        <span className="font-semibold tabular-nums">{pct(pagado, base)}</span>
      </div>
      <Medidor className="mt-1.5" valor={base ? pagado / base : 0} tono={liquidada ? 'pos' : 'ink'} etiqueta={`Avance ${nombre}`} />
      {cupo && <BloqueCupo c={cupo} />}

      <ul className="mt-3 flex flex-col divide-y divide-line border-t border-line">
        {partes.map(d => {
          const r = d.rubro;
          const detalle = [
            detalleParte(r.nombre),
            r.saldo_usd ? `${usd(r.saldo_usd)} a TRM ${cop(trm)}` : d.saldoInicial ? `Saldo ${cop(d.saldoInicial)}` : null,
            r.tasa ? tasaMes(r.tasa) : null,
          ].filter(Boolean).join(' · ');
          return (
            <li key={r.id} className="py-3 last:pb-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                    {r.saldo_usd ? 'En dólares' : 'En pesos'}
                    {d.liquidada && <Insignia tono="pos"><Check className="size-3" /> Liquidada</Insignia>}
                  </p>
                  {detalle && <p className="text-[12px] text-muted">{detalle}</p>}
                </div>
                <span className="shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums">debe {cop(d.restante)}</span>
                <button type="button" onClick={() => onEditar(r)} aria-label={`Editar ${r.nombre}`}
                  className="foco -mt-2 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                  <Ellipsis className="size-5" />
                </button>
              </div>
              <FaltaProgramar d={d} />
              <PagosDeuda d={d} />
            </li>
          );
        })}
      </ul>
    </li>
  );
}
