'use client';
// Tarjetas de Inicio: movimientos del mes, salud financiera y alertas para revisar.
import {
  ArrowRight, ChevronDown, ChevronRight, CircleAlert, CircleCheck, CreditCard, Landmark, PiggyBank, Plus, ReceiptText, Target, TrendingDown,
  TriangleAlert, Umbrella, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { useDatos } from './proveedor';
import { BotonPrimario, PastillaSuave, cx } from './ui/botones';
import { FilaMovimiento, Insignia } from './ui/datos';
import { Tarjeta, Vacio } from './ui/estructura';
import {
  calcularMetas, cuposTarjetas, movimientosDe, planDeudas, planVsReal, saludFinanciera, type Indicador, type NivelSalud, type ResumenPeriodo,
} from '@/lib/calculos';
import { cop, delta, fechaCorta, pct } from '@/lib/formato';
import { iconoDe } from '@/lib/iconos';
import { OTROS_GASTOS, type Estado } from '@/lib/tipos';
import { quienFue } from '@/lib/miembros';

const VISIBLES = 10;

/** Todos los movimientos del mes seleccionado, en Inicio. */
export function MovimientosDelMes() {
  const { estado, periodoId, fila, abrirRegistro, puedeEditar } = useDatos();
  const [todos, setTodos] = useState(false);
  const movs = movimientosDe(estado, periodoId);
  const balance = movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.valor : -m.valor), 0);
  const lista = todos ? movs : movs.slice(0, VISIBLES);
  const mes = fila?.periodo.etiqueta ?? '';

  return (
    <Tarjeta
      titulo={`Movimientos de ${mes}`}
      subtitulo={movs.length ? `${movs.length} ${movs.length === 1 ? 'registrado' : 'registrados'} · balance ${delta(balance)}` : 'Lo que realmente entra y sale'}
      accion={puedeEditar ? <PastillaSuave icono={Plus} onClick={() => abrirRegistro()}>Registrar</PastillaSuave> : undefined}
    >
      {movs.length === 0 ? (
        <Vacio
          icono={ReceiptText}
          titulo={`Aún no hay movimientos en ${mes}`}
          texto="Registren cada compra, pago o ingreso: así ven si el mes va como lo planearon."
          accion={puedeEditar ? <BotonPrimario onClick={() => abrirRegistro()}><Plus /> Registrar el primero</BotonPrimario> : undefined}
        />
      ) : (
        <>
          <ul className="-mx-2 flex flex-col">
            {lista.map(m => (
              <li key={m.id}>
                <FilaMovimiento
                  titulo={m.descripcion}
                  subtitulo={[fechaCorta(m.fecha), estado.rubros.find(r => r.id === m.rubro_id)?.nombre ?? m.categoria, estado.rubros.find(r => r.id === m.tarjeta_id)?.nombre ?? m.medio, quienFue(estado, m.creado_por)].filter(Boolean).join(' · ')}
                  valor={m.valor}
                  tipo={m.tipo}
                  icono={m.tipo === 'egreso' ? iconoDe(m.categoria, estado.categorias) : undefined}
                  onClick={() => abrirRegistro(m)}
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            {movs.length > VISIBLES ? (
              <button type="button" onClick={() => setTodos(t => !t)} aria-expanded={todos}
                className="foco inline-flex h-10 items-center rounded-full px-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
                {todos ? 'Ver menos' : `Ver los ${movs.length} movimientos`}
              </button>
            ) : <span />}
            <Link href="/movimientos" className="foco inline-flex h-10 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-accent-strong">
              Plan vs real <ArrowRight className="size-4" />
            </Link>
          </div>
        </>
      )}
    </Tarjeta>
  );
}

/* ---------------- Salud financiera ---------------- */
const fmt1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const porcentaje = (v: number) => `${v < 0 ? '−' : ''}${Math.round(Math.abs(v) * 100)} %`;

const NIVEL: Record<NivelSalud, { tono: 'pos' | 'warn' | 'neg'; icono: LucideIcon }> = {
  bien: { tono: 'pos', icono: CircleCheck },
  atencion: { tono: 'warn', icono: TriangleAlert },
  mal: { tono: 'neg', icono: CircleAlert },
};

function describir(x: Indicador, fila: ResumenPeriodo) {
  switch (x.clave) {
    case 'ahorro':
      return {
        icono: PiggyBank, nombre: 'Tasa de ahorro', valor: porcentaje(x.valor), meta: 'Lo que sobra más los aportes a metas · sano desde 20 %',
        estado: x.nivel === 'bien' ? 'Saludable' : x.nivel === 'atencion' ? 'Mejorable' : x.valor < 0 ? 'En déficit' : 'Baja',
      };
    case 'deuda':
      return {
        icono: Landmark, nombre: 'Pago de deudas', valor: porcentaje(x.valor), meta: 'De los ingresos del mes · sano hasta 30 %',
        estado: fila.deudas === 0 ? 'Sin pagos' : x.nivel === 'bien' ? 'Saludable' : x.nivel === 'atencion' ? 'Cuidado' : 'Alto',
      };
    case 'colchon':
      return {
        icono: Umbrella, nombre: 'Colchón', valor: `${fmt1.format(x.valor)} ${x.valor >= 0.95 && x.valor < 1.05 ? 'mes' : 'meses'}`,
        meta: 'Meses de gastos del hogar que cubre la plata en cuenta · ideal 3 a 6',
        estado: x.nivel === 'bien' ? 'Saludable' : x.nivel === 'atencion' ? 'Bajo' : 'Crítico',
      };
  }
}

export function SaludFinanciera({ fila, gastoPromedio }: { fila: ResumenPeriodo; gastoPromedio: number }) {
  const indicadores = saludFinanciera(fila, fila.operativo || gastoPromedio);
  return (
    <Tarjeta titulo="Salud financiera" subtitulo={`Según el plan de ${fila.periodo.etiqueta}`}>
      {fila.ingresos === 0 ? (
        <p className="text-[13px] text-muted">Cuando el mes tenga ingresos en el presupuesto, aquí verás la tasa de ahorro, el peso de las deudas y el colchón.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {indicadores.map(x => {
            const d = describir(x, fila);
            const n = NIVEL[x.nivel];
            return (
              <li key={x.clave} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-2"><d.icono className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug">{d.nombre}</p>
                  <p className="text-[12px] leading-snug text-muted">{d.meta}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[16px] font-bold tracking-tight tabular-nums">{d.valor}</span>
                  <Insignia tono={n.tono}><n.icono className="size-3" /> {d.estado}</Insignia>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ---------------- Para revisar ---------------- */
type Alerta = { tono: 'neg' | 'warn'; icono: LucideIcon; titulo: string; texto: string; href: string };

function armarAlertas(e: Estado, filas: ResumenPeriodo[], periodoId: string, fila: ResumenPeriodo): Alerta[] {
  const out: Alerta[] = [];
  const mes = fila.periodo.etiqueta;

  const negativo = filas.find(f => f.caja < 0);
  if (negativo) {
    out.push({
      tono: 'neg', icono: TrendingDown, href: '/presupuesto',
      titulo: `En ${negativo.periodo.etiqueta} la cuenta queda en ${cop(negativo.caja)}`,
      texto: 'Hasta ese mes el plan gasta más de lo que entra. Ajusten gastos, muevan un pago o sumen el saldo inicial.',
    });
  }

  const pvr = planVsReal(e, periodoId, fila);
  for (const f of pvr.filas) {
    if (f.plan > 0 && f.fueraDelPlan > 0) {
      out.push({
        tono: 'neg', icono: CircleAlert, href: '/movimientos', titulo: `${cop(f.fueraDelPlan)} fuera del plan en ${f.nombre}`,
        texto: f.pendiente > 0
          ? `Con los ${cop(f.pendiente)} que faltan por gastar, ${f.nombre} cerraría en ${cop(f.cierre)} de ${cop(f.plan)} planeados en ${mes}.`
          : `${cop(f.real)} gastados de ${cop(f.plan)} planeados en ${mes}.`,
      });
    } else if (f.plan > 0 && f.real >= f.plan * 0.85) {
      out.push({ tono: 'warn', icono: TriangleAlert, href: '/movimientos', titulo: `${f.nombre}: van en ${pct(f.real, f.plan)}`, texto: `Faltan ${cop(f.pendiente)} por gastar en el resto de ${mes}.` });
    } else if (f.plan === 0 && f.real > 0 && f.nombre !== OTROS_GASTOS) {
      out.push({ tono: 'warn', icono: TriangleAlert, href: '/presupuesto', titulo: `${f.nombre} no tiene presupuesto en ${mes}`, texto: `Ya llevan ${cop(f.real)}. Agreguen un rubro para que el plan lo cuente.` });
    }
  }

  const tarjeta = pvr.movs.filter(m => m.tipo === 'egreso' && m.medio === 'Tarjeta de crédito').reduce((s, m) => s + m.valor, 0);
  if (tarjeta > 0) {
    out.push({ tono: 'warn', icono: CreditCard, href: '/movimientos', titulo: `${cop(tarjeta)} con tarjeta de crédito en ${mes}`, texto: 'Mientras se liquidan las tarjetas, mejor pagar con débito o efectivo.' });
  }

  for (const c of cuposTarjetas(e, periodoId)) {
    if (c.disponible < 0) {
      out.push({ tono: 'neg', icono: CreditCard, href: '/plan', titulo: `${c.rubro.nombre}: se pasaron del cupo por ${cop(-c.disponible)}`, texto: `Usado ${cop(c.usado)} de un cupo de ${cop(c.cupo)}.` });
    } else if (c.disponible < c.cupo * 0.1) {
      out.push({ tono: 'warn', icono: CreditCard, href: '/plan', titulo: `${c.rubro.nombre}: quedan ${cop(c.disponible)} de cupo`, texto: `Ya usan el ${pct(c.usado, c.cupo)} del cupo de ${cop(c.cupo)}.` });
    }
  }

  for (const d of planDeudas(e, periodoId)) {
    if (d.faltaProgramar > 0.5) {
      out.push({ tono: 'warn', icono: Landmark, href: '/plan', titulo: `${d.rubro.nombre}: faltan ${cop(d.faltaProgramar)} por programar`, texto: 'Al terminar el plan todavía se debería eso. Definan la cuota en Deudas y metas.' });
    }
  }

  for (const m of calcularMetas(e, filas, periodoId)) {
    if (m.meta.objetivo > 0 && !m.cumplida && !m.pausada) {
      out.push({
        tono: 'warn', icono: Target, href: '/plan',
        titulo: `${m.meta.nombre}: faltan ${cop(m.falta)} para ${m.etiquetaObjetivo}`,
        texto: m.meta.modo === 'aportes' ? `Suban el aporte ${cop(m.aporteSugerido)}/mes para llegar a tiempo.` : 'La plata que habrá en la cuenta no alcanza para esta meta.',
      });
    }
  }

  return out.sort((a, b) => (a.tono === b.tono ? 0 : a.tono === 'neg' ? -1 : 1));
}

const CLAVE_REVISAR = 'fh-revisar-abierta';

/** Una alerta: tile de color con ícono (el color dice qué tan urgente es), título y qué hacer. */
function FilaAlerta({ a }: { a: Alerta }) {
  return (
    <li>
      <Link href={a.href} className="foco -mx-2 flex items-start gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-surface-2">
        <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', a.tono === 'neg' ? 'bg-neg-soft text-neg-text' : 'bg-warn-soft text-warn-text')}>
          <a.icono className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug font-semibold text-ink">{a.titulo}</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-muted">{a.texto}</span>
        </span>
        <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** Avisos del plan y del mes, en un acordeón que se puede cerrar (se recuerda en este equipo). */
export function ParaRevisar() {
  const { estado, filas, periodoId, fila } = useDatos();
  const [abierta, setAbierta] = useState(true);
  const [todas, setTodas] = useState(false);
  const idCuerpo = useId();
  useEffect(() => {
    try { if (localStorage.getItem(CLAVE_REVISAR) === '0') setAbierta(false); } catch { /* sin almacenamiento */ }
  }, []);
  if (!fila) return null;
  const alertas = armarAlertas(estado, filas, periodoId, fila);

  if (!alertas.length) {
    return (
      <section className="flex items-center gap-3 rounded-3xl bg-pos-soft p-4">
        <CircleCheck className="size-5 shrink-0 text-pos-text" />
        <p className="text-[13px] text-ink-2"><b className="font-semibold text-pos-text">Todo en orden en {fila.periodo.etiqueta}.</b> Sin excesos, deudas sin programar ni metas en riesgo.</p>
      </section>
    );
  }

  const urgentes = alertas.filter(a => a.tono === 'neg');
  const avisos = alertas.filter(a => a.tono !== 'neg');
  // Con "Ver menos" se muestran 4: primero las urgentes
  const MAX = 4;
  const verUrg = todas ? urgentes : urgentes.slice(0, MAX);
  const verAvi = todas ? avisos : avisos.slice(0, Math.max(0, MAX - verUrg.length));
  const ocultas = alertas.length - verUrg.length - verAvi.length;

  function alternar() {
    setAbierta(v => {
      try { localStorage.setItem(CLAVE_REVISAR, v ? '0' : '1'); } catch { /* sin almacenamiento */ }
      return !v;
    });
  }

  const grupo = (titulo: string, tono: 'neg' | 'warn', lista: Alerta[], total: number) => lista.length > 0 && (
    <div>
      <p className="mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        <span className={cx('size-2 rounded-full', tono === 'neg' ? 'bg-neg' : 'bg-warn')} aria-hidden />
        {titulo} · {total}
      </p>
      <ul className="flex flex-col">{lista.map((a, i) => <FilaAlerta key={i} a={a} />)}</ul>
    </div>
  );

  return (
    <section className="min-w-0 rounded-3xl bg-surface shadow-card">
      <button type="button" onClick={alternar} aria-expanded={abierta} aria-controls={idCuerpo}
        className="foco flex w-full items-start gap-3 rounded-3xl p-5 text-left lg:p-6">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-tight">Para revisar</span>
          <span className="mt-0.5 block text-[12px] text-muted">
            {alertas.length} {alertas.length === 1 ? 'aviso' : 'avisos'} del plan y de {fila.periodo.etiqueta}
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {urgentes.length > 0 && (
              <Insignia tono="neg"><CircleAlert className="size-3" /> {urgentes.length} {urgentes.length === 1 ? 'urgente' : 'urgentes'}</Insignia>
            )}
            {avisos.length > 0 && (
              <Insignia tono="warn"><TriangleAlert className="size-3" /> {avisos.length} para revisar</Insignia>
            )}
          </span>
        </span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
          <ChevronDown className={cx('size-5 transition-transform duration-200 motion-reduce:transition-none', abierta && 'rotate-180')} />
          <span className="sr-only">{abierta ? 'Cerrar avisos' : 'Abrir avisos'}</span>
        </span>
      </button>

      <div id={idCuerpo} className={cx('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', abierta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden" inert={!abierta}>
          <div className="flex flex-col gap-3 px-5 pb-4 lg:px-6">
            <div className="h-px bg-line" />
            {grupo('Atender ya', 'neg', verUrg, urgentes.length)}
            {grupo('Para revisar', 'warn', verAvi, avisos.length)}
            {(ocultas > 0 || todas) && alertas.length > MAX && (
              <button type="button" onClick={() => setTodas(t => !t)} aria-expanded={todas}
                className="foco inline-flex h-10 items-center gap-1 self-start rounded-full px-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
                {todas ? 'Ver menos' : `Ver ${ocultas} más`}
                <ArrowRight className={cx('size-3.5 transition-transform', todas ? '-rotate-90' : 'rotate-90')} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
