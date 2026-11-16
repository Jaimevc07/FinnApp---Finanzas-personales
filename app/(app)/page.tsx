'use client';
import { ArrowDownLeft, ArrowRight, BookOpen, Calculator, CalendarClock, CircleAlert, Coins, History, Landmark, Plus, Settings, ShoppingBasket, SlidersHorizontal, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Columnas } from '@/components/graficos/columnas';
import { BarrasHorizontales } from '@/components/graficos/barras-h';
import { AvisoMesFuera } from '@/components/aviso-mes';
import { FilaMeta } from '@/components/metas';
import { ActividadReciente } from '@/components/actividad';
import { MovimientosDelMes, ParaRevisar, SaludFinanciera } from '@/components/resumen-inicio';
import { BarraMes, Leyenda } from '@/components/plan-vs-real';
import { diaSueldo, diasRestantes, etiquetaMes, mesActual } from '@/lib/meses';
import { useDatos } from '@/components/proveedor';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { ConDatos } from '@/components/shell';
import { AccionCircular, BotonAcento, BotonCircular, BotonPrimario, PastillaSuave, cx } from '@/components/ui/botones';
import { Estadistica, Insignia, MontoHeroe } from '@/components/ui/datos';
import { EncabezadoPantalla, Tarjeta } from '@/components/ui/estructura';
import { TarjetaFin } from '@/components/ui/tarjeta-fin';
import { calcularMetas, planVsReal, tablero } from '@/lib/calculos';
import { cop, copCorto, delta, deltaCompacto, usd } from '@/lib/formato';

export default function Inicio() {
  return (
    <ConDatos>
      <Tablero />
    </ConDatos>
  );
}

function Tablero() {
  const { estado, fila, filas, periodoId, setPeriodoId, abrirRegistro, puedeEditar } = useDatos();
  const t = tablero(estado, filas);
  const metas = calcularMetas(estado, filas, periodoId);
  const hoy = mesActual();
  const real = planVsReal(estado, periodoId, fila);
  const ultimo = estado.periodos.at(-1);
  const c = estado.config;
  if (!fila) return null;

  const iniciales = c.hogar.replace(/^Hogar\s+/i, '').split(/\s*&\s*|\s+y\s+/).map(x => x[0]).join('&').slice(0, 3);
  // En el mes en curso: cuánto falta por gastar por día hasta fin de mes.
  const dias = periodoId === hoy ? diasRestantes() : 0;

  return (
    <>
      <EncabezadoPantalla
        izquierda={
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-on-ink" aria-hidden>
            {iniciales || 'FH'}
          </span>
        }
        titulo={estado.cuaderno?.nombre ?? c.hogar}
        subtitulo={<>Plan de <b className="font-semibold text-ink">{estado.periodos[0]?.etiqueta} a {ultimo?.etiqueta}</b></>}
        derecha={
          <>
            <BotonCircular etiqueta="Cambiar de cuaderno" href="/cuadernos" className="lg:hidden"><BookOpen /></BotonCircular>
            <BotonCircular etiqueta="Movimientos" href="/movimientos"><History /></BotonCircular>
            <BotonCircular etiqueta="Ajustes" href="/ajustes" className="lg:hidden"><Settings /></BotonCircular>
          </>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        {/* Columna principal: lo que se ve primero en el celular */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-5">
          <section className="flex flex-col items-center gap-5 lg:rounded-3xl lg:bg-surface lg:p-6 lg:shadow-card">
            <SelectorPeriodo />
            <MontoHeroe
              centrado
              etiqueta={`En la cuenta al cierre de ${fila.periodo.etiqueta}`}
              valor={fila.caja}
              detalle={c.saldo_inicial
                ? <>Saldo inicial de {cop(c.saldo_inicial)} + lo que sobra cada mes hasta {fila.periodo.etiqueta}, si se cumple el plan</>
                : <>Lo que sobra cada mes, sumado hasta {fila.periodo.etiqueta}, si se cumple el plan</>}
            />
            <TarjetaFin
              titular={estado.cuaderno?.nombre ?? c.hogar}
              mes={fila.periodo.etiqueta}
              cobro={fila.periodo.cobro}
              ingresosPlan={fila.ingresos}
              egresosPlan={fila.egresos}
              ingresosReal={real.ingresos}
              egresosReal={real.egresos}
              porGastar={real.pendiente}
              fueraDelPlan={real.fueraDelPlan}
            />
            {puedeEditar && (
              <BotonPrimario onClick={() => abrirRegistro()} className="min-w-[220px] lg:hidden">
                <Plus strokeWidth={2.4} /> Registrar movimiento
              </BotonPrimario>
            )}
            <div className="flex justify-center gap-4">
              <AccionCircular etiqueta="Presupuesto" icono={Calculator} href="/presupuesto" />
              <AccionCircular etiqueta="Listas" icono={ShoppingBasket} href="/listas" />
              <AccionCircular etiqueta="Deudas y metas" icono={Target} href="/plan" />
            </div>
          </section>

          <Tarjeta titulo="Lo real del mes" subtitulo={`Movimientos registrados frente al plan de ${fila.periodo.etiqueta}`}>
            <BarraMes enPlan={real.enPlan} pendiente={real.pendiente} fuera={real.fueraDelPlan} escala={Math.max(real.cierre, fila.egresos)} alto="h-2.5" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Leyenda color="bg-ink" etiqueta="Gastado en el plan" valor={cop(real.enPlan)} />
              <Leyenda color="bg-accent" etiqueta="Falta por gastar" valor={cop(real.pendiente)} />
              <Leyenda color="bg-neg" etiqueta="Fuera del plan" valor={real.fueraDelPlan > 0 ? `−${cop(real.fueraDelPlan)}` : cop(0)} tono={real.fueraDelPlan > 0 ? 'neg' : undefined} />
            </div>
            {real.fueraDelPlan > 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-neg-soft px-4 py-3 text-[13px] text-ink-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-neg-text" />
                <span className="min-w-0">
                  Gastaron <b className="font-semibold text-neg-text">{cop(real.fueraDelPlan)}</b> fuera del plan. Para cerrar el mes en {cop(fila.egresos)}, recorten eso de lo que falta por gastar.
                </span>
              </p>
            )}
            {dias > 0 && real.pendiente > 0 && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
                <CalendarClock className="size-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  Quedan {dias} {dias === 1 ? 'día' : 'días'} del mes: lo que falta por gastar son <b className="font-semibold text-ink">{cop(real.pendiente / dias)} por día</b>
                </span>
              </p>
            )}
            <Link href="/movimientos" className="foco mt-4 flex items-center justify-between gap-3 rounded-2xl bg-pos-soft px-4 py-3 transition hover:brightness-95">
              <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
                <ArrowDownLeft className="size-4 shrink-0 text-pos-text" />
                <span className="truncate">Ingresos registrados <span className="text-muted">· plan {cop(fila.ingresos)}</span></span>
              </span>
              <span className="shrink-0 text-[14px] font-bold text-pos-text tabular-nums">+{cop(real.ingresos)}</span>
            </Link>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
              <div className="min-w-0">
                <p className="text-[12px] text-muted">Egresos planeados / mes</p>
                <p className="text-[16px] font-bold tracking-tight">{cop(fila.egresos)}</p>
              </div>
              <PastillaSuave icono={SlidersHorizontal} href="/presupuesto">Editar plan</PastillaSuave>
            </div>
          </Tarjeta>

          <MovimientosDelMes />
          <ActividadReciente />
        </div>

        {/* Columna de análisis */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {!estado.periodos.some(p => p.id === hoy) && (
            <AvisoMesFuera
              mesId={hoy}
              titulo={`Estamos en ${etiquetaMes(hoy)} y no está en el plan`}
              texto={`El plan va de ${estado.periodos[0]?.etiqueta} a ${ultimo?.etiqueta}. Agrégalo para presupuestar el mes en curso y que cuenten los movimientos que registres.`}
            />
          )}
          {t.vacio && (
            <section className="flex items-start gap-4 rounded-3xl bg-surface p-5 shadow-card lg:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
                <Calculator className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">Tu presupuesto está en $ 0</p>
                <p className="mt-1 text-[13px] text-muted">Empieza por los ingresos y los gastos fijos del mes; luego agrega deudas y metas.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <BotonAcento href="/presupuesto" className="h-10 px-4 text-[14px]">Armar presupuesto</BotonAcento>
                  <Link href="/plan" className="foco inline-flex h-10 items-center rounded-2xl px-3 text-[14px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
                    Deudas y metas <ArrowRight className="ml-1 size-4" />
                  </Link>
                </div>
              </div>
            </section>
          )}
          {!t.vacio && <ParaRevisar />}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <Estadistica icono={Landmark} etiqueta="Deuda total extinta" valor={copCorto(t.deudaExtinta)} detalle="Pagos de tarjetas y créditos en el plan" />
            <Estadistica icono={Coins} etiqueta="Ahorro cambiario" valor={copCorto(t.ahorroCambiario)} tono={t.ahorroCambiario >= 0 ? 'pos' : 'neg'}
              detalle={<>TRM {cop(c.trm)} vs {cop(c.trm_referencia)} · {usd(t.usdTotal)}</>} />
            <Estadistica icono={TrendingUp} etiqueta={`En la cuenta al final · ${ultimo?.etiqueta}`} valor={copCorto(t.cajaFinal)} tono={t.cajaFinal >= 0 ? 'neutro' : 'neg'} detalle="Lo que queda al terminar el plan" />
            <Estadistica icono={ArrowDownLeft} etiqueta="¿Cuánto puedo gastar extra?" valor={deltaCompacto(t.simulador)} tono={t.simulador >= 0 ? 'pos' : 'neg'}
              detalle={t.hayMetasCaja
                ? (t.simulador >= 0 ? 'Queda libre al final, después de pagar las metas' : 'Falta al final para pagar las metas')
                : 'Queda libre al final del plan'} />
          </div>

          <SaludFinanciera fila={fila} gastoPromedio={t.promedioOperativo} />

          <Tarjeta
            titulo="Metas"
            subtitulo={metas.length ? `${metas.filter(m => m.cumplida).length} de ${metas.length} se cumplen con el plan${metas.some(m => m.pausada) ? ` · ${metas.filter(m => m.pausada).length} en pausa` : ''}` : 'Ahorra con un propósito'}
            accion={<PastillaSuave icono={metas.length ? ArrowRight : Plus} href="/plan">{metas.length ? 'Ver todas' : 'Crear'}</PastillaSuave>}
          >
            {metas.length ? (
              <ul className="flex flex-col gap-3">
                {metas.slice(0, 3).map(m => <FilaMeta key={m.meta.id} m={m} />)}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Crea metas como el carro, un viaje o el fondo de emergencias y la app calcula cuánto ahorrar cada mes.</p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Plata en la cuenta mes a mes" subtitulo="Si se cumple el plan · toca una columna para ver ese mes">
            <Columnas
              titulo="Plata en la cuenta mes a mes"
              datos={filas.map(f => ({ id: f.periodo.id, etiqueta: f.periodo.etiqueta, corta: f.periodo.etiqueta.slice(0, 3), valor: f.caja }))}
              seleccionado={periodoId}
              onSeleccionar={setPeriodoId}
            />
          </Tarjeta>

          <Tarjeta titulo={`Resumen de ${fila.periodo.etiqueta}`} subtitulo={`Se cubre con el sueldo del ${diaSueldo(fila.periodo.cobro)}`} accion={<SelectorCompacto />}>
            <ul className="flex flex-col text-[14px]">
              <FilaResumen nombre="Ingresos disponibles" valor={fila.ingresos} tipo="ingreso" />
              {estado.categorias.filter(x => x.seccion === 'operativo').map(x => (
                <FilaResumen key={x.id} nombre={x.nombre} valor={fila.porCategoria[x.id] ?? 0} tipo="egreso" />
              ))}
              <FilaResumen nombre="Pago de deudas, viajes y eventos" valor={fila.compromisos} tipo="egreso" />
              {fila.ahorro > 0 && <FilaResumen nombre="Aportes a metas" valor={fila.ahorro} tipo="egreso" />}
              <li className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="font-semibold">{fila.flujo < 0 ? 'Falta en el mes' : 'Sobra en el mes'} <span className="font-normal text-muted">(entra − sale)</span></span>
                <span className={cx('font-bold tabular-nums', fila.flujo < 0 ? 'text-neg-text' : 'text-ink')}>{delta(fila.flujo)}</span>
              </li>
              <li className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-on-ink">
                <span className="font-semibold">En la cuenta al cierre</span>
                <span className="font-bold tabular-nums">{cop(fila.caja)}</span>
              </li>
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Distribución del gasto operativo" subtitulo={`Promedio mensual de ${filas.length} meses · ${cop(t.promedioOperativo)}`}>
            {t.promedioOperativo === 0 ? (
              <p className="text-[13px] text-muted">Cuando agregues gastos del hogar en el presupuesto, aquí verás en qué se va la plata.</p>
            ) : (
            <BarrasHorizontales
              total={t.promedioOperativo}
              filas={t.distribucion.map(d => ({
                id: d.categoria.id,
                nombre: d.categoria.nombre,
                valor: d.promedio,
                extra: d.categoria.control ? (
                  <Insignia tono={d.categoria.control === 'Flexible' ? 'accent' : 'neutro'}>{d.categoria.control}</Insignia>
                ) : null,
              }))}
            />
            )}
            <p className="mt-4 text-[12px] text-muted">
              <b className="font-semibold text-accent-strong">Flexible</b> son las palancas para ahorrar: ocio, salidas y cuidado personal.
            </p>
          </Tarjeta>

          <Tarjeta titulo="Flujo libre después del plan" subtitulo={c.nota_2028 || 'Con los gastos que vienen'}>
            <div className="flex items-end justify-between gap-3">
              <p className={cx('text-[28px] font-bold leading-none tracking-tight', t.flujo2028 < 0 && 'text-neg-text')}>{cop(t.flujo2028)}</p>
              <Link href="/plan" className="foco inline-flex items-center gap-1 rounded-full text-[13px] font-semibold text-accent-strong">
                Ajustar <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="mt-2 text-[12px] text-muted">
              {cop(c.ingreso_2028)} ingresos − {cop(c.operativo_2028)} operativos − {cop(c.cuota_carro_2028)} nuevas cuotas
            </p>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

function FilaResumen({ nombre, valor, tipo }: { nombre: string; valor: number; tipo: 'ingreso' | 'egreso' }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-ink-2">
        <span className={cx('mr-2 inline-block w-3 text-center font-bold', tipo === 'ingreso' ? 'text-pos-text' : 'text-neg-text')} aria-hidden>
          {tipo === 'ingreso' ? '+' : '−'}
        </span>
        {nombre}
      </span>
      <span className={cx('shrink-0 tabular-nums', tipo === 'ingreso' ? 'font-semibold text-pos-text' : valor ? 'text-ink' : 'text-muted')}>
        {cop(valor)}
      </span>
    </li>
  );
}

function SelectorCompacto() {
  const { estado, periodoId, setPeriodoId } = useDatos();
  return (
    <select
      aria-label="Mes a inspeccionar"
      value={periodoId}
      onChange={e => setPeriodoId(e.target.value)}
      className="foco h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold"
    >
      {estado.periodos.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
    </select>
  );
}
