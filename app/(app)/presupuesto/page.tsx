'use client';
import { ArrowDownLeft, ArrowRight, CalendarDays, CalendarMinus, CalendarPlus, ChevronDown, CircleCheck, Copy, CreditCard, Ellipsis, FolderPlus, Plane, Plus, Repeat, Sparkles, Target, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HojaDeuda, HojaEvento, type EventoSel } from '@/components/deudas';
import { HojaMeta } from '@/components/metas';
import { useDatos } from '@/components/proveedor';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { ConDatos } from '@/components/shell';
import { BotonAcento, BotonSecundario, PastillaSuave, cx } from '@/components/ui/botones';
import { Campo, Entrada, EntradaDinero, Selector } from '@/components/ui/campos';
import { Insignia, Medidor } from '@/components/ui/datos';
import { EncabezadoPantalla, Tarjeta } from '@/components/ui/estructura';
import { Hoja } from '@/components/ui/hoja';
import { Segmentado } from '@/components/ui/segmentado';
import { SelectorIcono } from '@/components/ui/selector-icono';
import { SelectorMeses } from '@/components/ui/selector-meses';
import { calcularMetas, mesesConValor, movimientosDe, planDeudas, realPorCategoria, rubroVisible, valorCelda } from '@/lib/calculos';
import { conSigno, cop, copCorto, delta, fechaCorta, numero, pct } from '@/lib/formato';
import { iconoCategoria } from '@/lib/iconos';
import { diaSueldo, etiquetaMes, mesAnterior, mesSiguiente } from '@/lib/meses';
import { claveCelda, CONTROLES, type Categoria, type DatosRubro, type Meta, type Periodo, type Rubro, type Seccion } from '@/lib/tipos';

type Grupo = 'ingreso' | 'operativo' | 'compromisos' | 'ahorro';
const GRUPOS: { valor: Grupo; etiqueta: string; titulo: string; secciones: Seccion[] }[] = [
  { valor: 'ingreso', etiqueta: 'Ingresos', titulo: 'Ingresos', secciones: ['ingreso'] },
  { valor: 'operativo', etiqueta: 'Gastos', titulo: 'Gastos del hogar', secciones: ['operativo'] },
  { valor: 'compromisos', etiqueta: 'Deudas', titulo: 'Deudas, viajes y eventos', secciones: ['deuda', 'evento'] },
  { valor: 'ahorro', etiqueta: 'Ahorro', titulo: 'Ahorro y metas', secciones: ['ahorro'] },
];
const NOMBRE_SECCION: Record<Seccion, string> = {
  ingreso: 'Ingreso', operativo: 'Gasto del hogar', deuda: 'Pago de deuda', evento: 'Viaje o evento', ahorro: 'Ahorro',
};

export default function Presupuesto() {
  return (
    <ConDatos>
      <VistaPresupuesto />
    </ConDatos>
  );
}

function VistaPresupuesto() {
  const [vista, setVista] = useState<'mes' | 'tabla'>('mes');
  useEffect(() => {
    try { if (localStorage.getItem('fh-vista-presupuesto') === 'tabla' && matchMedia('(min-width: 1024px)').matches) setVista('tabla'); } catch { /* */ }
  }, []);
  const cambiar = (v: 'mes' | 'tabla') => {
    setVista(v);
    try { localStorage.setItem('fh-vista-presupuesto', v); } catch { /* */ }
  };

  return (
    <>
      <EncabezadoPantalla
        titulo="Presupuesto"
        subtitulo={<>Plan mes a mes · <b className="font-semibold text-ink">toca un valor para editarlo</b></>}
        derecha={
          <div className="hidden lg:block">
            <Segmentado
              etiqueta="Vista"
              valor={vista}
              onChange={cambiar}
              opciones={[{ valor: 'mes', etiqueta: 'Por mes' }, { valor: 'tabla', etiqueta: 'Todos los meses' }]}
              className="w-[280px]"
            />
          </div>
        }
      />
      {vista === 'tabla' ? <TablaCompleta /> : <PorMes />}
      <MesesDelPlan />
    </>
  );
}

/* ---------------- Vista por mes ---------------- */
function PorMes() {
  const { estado, periodoId, fila } = useDatos();
  const [grupo, setGrupo] = useState<Grupo>('operativo');
  const [editando, setEditando] = useState<Rubro | null>(null);
  const [nuevoEn, setNuevoEn] = useState<Categoria | null>(null);
  const [categoria, setCategoria] = useState<{ abierta: boolean; cat: Categoria | null }>({ abierta: false, cat: null });
  const [copiando, setCopiando] = useState(false);
  // Categorías donde se despliegan los rubros de otros meses, y rubros que se están editando
  // (no se esconden aunque queden en $ 0 mientras se escribe). Se reinician al cambiar de mes.
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());
  const [retener, setRetener] = useState<Set<number>>(new Set());
  useEffect(() => { setAbiertas(new Set()); setRetener(new Set()); }, [periodoId]);
  if (!fila) return null;
  const g = GRUPOS.find(x => x.valor === grupo)!;
  const cats = estado.categorias.filter(c => g.secciones.includes(c.seccion));
  const mesVacio = fila.ingresos === 0 && fila.egresos === 0;
  const idx = estado.periodos.findIndex(p => p.id === periodoId);
  const sugerido = estado.periodos[idx + 1] ?? estado.periodos[idx - 1];
  const real = realPorCategoria(estado, periodoId);
  const recibido = realPorCategoria(estado, periodoId, 'ingreso');
  const alternar = (id: number) => setAbiertas(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:col-span-4">
        <SelectorPeriodo />
        <Tarjeta>
          <div className="grid grid-cols-2 gap-4">
            <Cifra etiqueta="Ingresos" valor={`+${cop(fila.ingresos)}`} clase="text-pos-text" />
            <Cifra etiqueta="Egresos" valor={`−${cop(fila.egresos)}`} clase="text-neg-text" />
            <Cifra etiqueta={fila.flujo < 0 ? 'Falta en el mes' : 'Sobra en el mes'} valor={delta(fila.flujo)} clase={fila.flujo < 0 ? 'text-neg-text' : ''} />
            <Cifra etiqueta="En la cuenta al cierre" valor={cop(fila.caja)} clase={fila.caja < 0 ? 'text-neg-text' : ''} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3 border-t border-line pt-4 text-[12px]">
            <MiniCifra etiqueta="Gastos del hogar" valor={fila.operativo} />
            <MiniCifra etiqueta="Deudas" valor={fila.deudas} />
            <MiniCifra etiqueta="Viajes y eventos" valor={fila.eventos} />
            <MiniCifra etiqueta="Ahorro y metas" valor={fila.ahorro} />
          </div>
          {!mesVacio && estado.periodos.length > 1 && (
            <PastillaSuave icono={Copy} tono="neutro" className="mt-4" onClick={() => setCopiando(true)}>Copiar de otro mes</PastillaSuave>
          )}
        </Tarjeta>
        {mesVacio && sugerido && (
          <section className="flex items-start gap-4 rounded-3xl bg-surface p-5 shadow-card">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong"><Copy className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{fila.periodo.etiqueta} está en $ 0</p>
              <p className="mt-1 text-[13px] text-muted">Arranca con los ingresos y gastos de otro mes y ajusta lo que cambie.</p>
              <BotonAcento className="mt-4 h-10 px-4 text-[14px]" onClick={() => setCopiando(true)}>
                <Copy /> Copiar de {sugerido.etiqueta}
              </BotonAcento>
            </div>
          </section>
        )}
      </div>
      <HojaCopiarMes abierta={copiando} onCerrar={() => setCopiando(false)} desdeSugerido={sugerido?.id} />

      <div className="flex flex-col gap-4 lg:col-span-8">
        <Segmentado etiqueta="Sección del presupuesto" valor={grupo} onChange={setGrupo} opciones={GRUPOS} />
        {grupo === 'compromisos' && <PestanaDeudas />}
        {grupo === 'ahorro' && <PestanaAhorro onNuevoRubro={setNuevoEn} onEditarRubro={setEditando} />}
        {(grupo === 'ingreso' || grupo === 'operativo') && cats.map(cat => {
          const todos = estado.rubros.filter(r => r.categoria_id === cat.id);
          const abierta = abiertas.has(cat.id);
          const rubros = todos.filter(r => abierta || retener.has(r.id) || rubroVisible(estado, r, periodoId));
          const ocultos = todos.length - rubros.length;
          const Icono = iconoCategoria(cat);
          const plan = fila.porCategoria[cat.id] ?? 0;
          const gastado = cat.seccion === 'operativo' ? (real.get(cat.nombre) ?? 0) : 0;
          const entro = cat.seccion === 'ingreso' ? (recibido.get(cat.nombre) ?? 0) : 0;
          return (
            <Tarjeta
              key={cat.id}
              titulo={
                <span className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><Icono className="size-4" /></span>
                  {cat.nombre}
                  {cat.control && <Insignia tono={cat.control === 'Flexible' ? 'accent' : 'neutro'}>{cat.control}</Insignia>}
                </span>
              }
              subtitulo={gastado > 0 ? (
                <span className={cx(gastado > plan ? 'font-semibold text-neg-text' : gastado >= plan * 0.85 ? 'font-semibold text-warn-text' : '')}>
                  Real del mes: {cop(gastado)}{plan > 0 ? ` · ${pct(gastado, plan)} de lo planeado` : ' · sin presupuesto'}
                </span>
              ) : entro > 0 ? (
                <span>
                  Recibido en {fila.periodo.etiqueta}: <b className="font-semibold text-pos-text">{conSigno(entro, 'ingreso')}</b>
                  {plan > 0 ? ` · ${pct(entro, plan)} de lo planeado` : ' · no estaba en el presupuesto'}
                </span>
              ) : undefined}
              accion={
                <span className="flex items-center gap-1">
                  <span className="text-[14px] font-bold whitespace-nowrap tabular-nums">{cop(fila.porCategoria[cat.id] ?? 0)}</span>
                  <button type="button" onClick={() => setCategoria({ abierta: true, cat })} aria-label={`Opciones de la categoría ${cat.nombre}`}
                    className="foco -mr-2 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                    <Ellipsis className="size-[18px]" />
                  </button>
                </span>
              }
            >
              {rubros.length > 0 ? (
                <ul className="flex flex-col divide-y divide-line">
                  {rubros.map(r => (
                    <FilaRubro key={r.id} rubro={r} periodoId={periodoId} onMas={() => setEditando(r)}
                      onCambio={() => !r.recurrente && setRetener(s => new Set(s).add(r.id))}
                      detalle={!r.recurrente ? <MesesDelRubro rubro={r} /> : undefined} />
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">{todos.length ? `Nada presupuestado para ${fila.periodo.etiqueta} en esta categoría.` : 'Sin rubros todavía.'}</p>
              )}
              {cat.seccion === 'ingreso' && <IngresosRegistrados categoria={cat.nombre} />}
              <div className="mt-3 flex flex-wrap gap-2">
                <PastillaSuave icono={Plus} tono="neutro" onClick={() => setNuevoEn(cat)}>Agregar rubro</PastillaSuave>
                {(ocultos > 0 || abierta) && (
                  <button type="button" onClick={() => alternar(cat.id)} aria-expanded={abierta}
                    className="foco inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-muted hover:text-ink">
                    <ChevronDown className={cx('size-4 transition', abierta && 'rotate-180')} />
                    {abierta ? 'Ocultar los de otros meses' : `${ocultos} de otros meses`}
                  </button>
                )}
              </div>
            </Tarjeta>
          );
        })}
        {grupo !== 'ahorro' && (
          <button type="button" onClick={() => setCategoria({ abierta: true, cat: null })}
            className="foco flex h-14 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-[14px] font-semibold text-muted transition hover:border-ink hover:text-ink">
            <FolderPlus className="size-5" /> Nueva categoría de {grupo === 'compromisos' ? 'deudas o eventos' : g.titulo.toLowerCase()}
          </button>
        )}
      </div>

      <HojaRubro rubro={editando} onCerrar={() => setEditando(null)} />
      <HojaNuevoRubro categoria={nuevoEn} onCerrar={() => setNuevoEn(null)} />
      <HojaCategoria categoria={categoria.cat} abierta={categoria.abierta} secciones={g.secciones}
        onCerrar={() => setCategoria(c => ({ ...c, abierta: false }))} />
    </div>
  );
}

const SECCIONES_COPIA: { valor: Seccion; etiqueta: string; ayuda: string; porDefecto: boolean }[] = [
  { valor: 'ingreso', etiqueta: 'Ingresos', ayuda: 'Sueldos y otros ingresos', porDefecto: true },
  { valor: 'operativo', etiqueta: 'Gastos del hogar', ayuda: 'Vivienda, mercado, transporte, suscripciones…', porDefecto: true },
  { valor: 'ahorro', etiqueta: 'Ahorro y metas', ayuda: 'Aportes mensuales', porDefecto: true },
  { valor: 'deuda', etiqueta: 'Pagos de deudas', ayuda: 'Ojo: duplica el pago si ya está programado en el otro mes', porDefecto: false },
  { valor: 'evento', etiqueta: 'Viajes y eventos', ayuda: 'Ojo: son gastos de una sola vez', porDefecto: false },
];

/** Copia los valores de otro mes al mes seleccionado, por secciones. */
function HojaCopiarMes({ abierta, onCerrar, desdeSugerido }: { abierta: boolean; onCerrar: () => void; desdeSugerido?: string }) {
  const { estado, filas, periodoId, copiarMes, avisar } = useDatos();
  const [desde, setDesde] = useState('');
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  useEffect(() => {
    if (!abierta) return;
    setDesde(desdeSugerido ?? '');
    setSecciones(SECCIONES_COPIA.filter(s => s.porDefecto).map(s => s.valor));
  }, [abierta, desdeSugerido]);
  const destino = estado.periodos.find(p => p.id === periodoId);
  const origen = filas.find(f => f.periodo.id === desde);
  const totalDe = (s: Seccion) => !origen ? 0 : s === 'ingreso' ? origen.ingresos : s === 'operativo' ? origen.operativo : s === 'ahorro' ? origen.ahorro : s === 'deuda' ? origen.deudas : origen.eventos;

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={`Copiar a ${destino?.etiqueta ?? ''}`}
      subtitulo="Reemplaza los valores de este mes en las secciones elegidas"
      pie={
        <BotonAcento className="w-full" disabled={!desde || !secciones.length} onClick={async () => {
          try {
            await copiarMes(desde, periodoId, secciones);
            avisar(`${destino?.etiqueta} cargado con los valores de ${origen?.periodo.etiqueta}`);
            onCerrar();
          } catch { /* aviso ya mostrado */ }
        }}>
          <Copy /> Copiar
        </BotonAcento>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Copiar desde" htmlFor="cp-desde">
          <Selector id="cp-desde" value={desde} onChange={e => setDesde(e.target.value)}>
            <option value="">Elige un mes…</option>
            {estado.periodos.filter(p => p.id !== periodoId).map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
          </Selector>
        </Campo>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[12px] font-semibold text-muted">Qué copiar</legend>
          {SECCIONES_COPIA.map(s => {
            const marcada = secciones.includes(s.valor);
            return (
              <label key={s.valor} className={cx('flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition', marcada ? 'border-accent bg-accent-soft' : 'border-line')}>
                <input type="checkbox" checked={marcada} className="mt-0.5 size-5 shrink-0 accent-[var(--accent-fill)]"
                  onChange={e => setSecciones(xs => e.target.checked ? [...xs, s.valor] : xs.filter(x => x !== s.valor))} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold">{s.etiqueta}</span>
                    <span className="text-[13px] font-semibold tabular-nums">{cop(totalDe(s.valor))}</span>
                  </span>
                  <span className={cx('block text-[12px]', s.porDefecto ? 'text-muted' : 'text-warn-text')}>{s.ayuda}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="flex items-start gap-2 text-[12px] text-muted">
          <CalendarDays className="mt-px size-3.5 shrink-0" />
          Los rubros de solo algunos meses (primas, bonos, ingresos temporales) no se copian.
        </p>
      </div>
    </Hoja>
  );
}

function Cifra({ etiqueta, valor, clase }: { etiqueta: string; valor: string; clase?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted">{etiqueta}</p>
      <p className={cx('truncate text-[17px] font-bold tracking-tight', clase)}>{valor}</p>
    </div>
  );
}
function MiniCifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="min-w-0">
      <p className="text-muted">{etiqueta}</p>
      <p className="truncate font-semibold tabular-nums">{cop(valor)}</p>
    </div>
  );
}

/** Valor del rubro en el mes: campo editable, o el valor calculado si la celda es automática. */
function ValorMes({ rubro, periodoId, onCambio }: { rubro: Rubro; periodoId: string; onCambio?: () => void }) {
  const { estado, setCelda } = useDatos();
  const celda = estado.valores[claveCelda(rubro.id, periodoId)];
  if (celda?.auto) {
    return <span className="w-[136px] shrink-0 text-right text-[15px] font-semibold tabular-nums sm:w-[160px]">{cop(valorCelda(estado, rubro, periodoId))}</span>;
  }
  return (
    <EntradaDinero
      aria-label={`${rubro.nombre}, valor del mes`}
      className="w-[136px] shrink-0 sm:w-[160px]"
      valor={celda?.valor ?? 0}
      onValor={v => { onCambio?.(); setCelda(rubro.id, periodoId, v); }}
      placeholder="0"
    />
  );
}

/** Ingresos de Movimientos de esta categoría en el mes: así se ve lo que de verdad entró. */
function IngresosRegistrados({ categoria }: { categoria: string }) {
  const { estado, periodoId, fila, abrirRegistro } = useDatos();
  const movs = movimientosDe(estado, periodoId).filter(m => m.tipo === 'ingreso' && m.categoria === categoria);
  if (!movs.length) return null;
  return (
    <div className="mt-3 rounded-2xl bg-pos-soft p-3">
      <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-pos-text">
        <ArrowDownLeft className="size-3.5" /> Registrado en Movimientos · {fila?.periodo.etiqueta}
      </p>
      <ul className="flex flex-col">
        {movs.map(m => (
          <li key={m.id}>
            <button type="button" onClick={() => abrirRegistro(m)}
              className="foco flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left hover:brightness-95">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{m.descripcion}</span>
                <span className="block text-[11px] text-ink-2">{fechaCorta(m.fecha)} · {m.medio}</span>
              </span>
              <span className="shrink-0 text-[13px] font-bold tabular-nums text-pos-text">{conSigno(m.valor, 'ingreso')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Solo en Nov 2026 · Dic 2026 · Ene 2027" para los rubros que no se repiten. */
function MesesDelRubro({ rubro }: { rubro: Rubro }) {
  const { estado } = useDatos();
  const meses = mesesConValor(estado, rubro);
  const txt = meses.length === 0 ? 'Solo algunos meses · aún sin meses con valor'
    : `Solo en ${meses.slice(0, 4).map(p => p.etiqueta).join(' · ')}${meses.length > 4 ? ` y ${meses.length - 4} más` : ''}`;
  return <span className="flex items-center gap-1"><CalendarDays className="size-3 shrink-0" /> {txt}</span>;
}

function BotonMas({ etiqueta, onClick }: { etiqueta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={etiqueta}
      className="foco grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink">
      <Ellipsis className="size-5" />
    </button>
  );
}

function FilaRubro({ rubro, periodoId, onMas, detalle, titulo, onCambio }: {
  rubro: Rubro; periodoId: string; onMas: () => void; detalle?: React.ReactNode; titulo?: string; onCambio?: () => void;
}) {
  const { estado } = useDatos();
  const auto = !!estado.valores[claveCelda(rubro.id, periodoId)]?.auto;
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] leading-snug font-medium">{titulo ?? rubro.nombre}</p>
        {auto && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-accent-strong">
            <Sparkles className="size-3" /> Saldo en USD × TRM, menos lo ya pagado
          </p>
        )}
        {detalle && <div className="mt-0.5 text-[12px] leading-snug text-muted">{detalle}</div>}
      </div>
      <ValorMes rubro={rubro} periodoId={periodoId} onCambio={onCambio} />
      <BotonMas etiqueta={`Opciones de ${rubro.nombre}`} onClick={onMas} />
    </li>
  );
}

/* ---------------- Pestaña Deudas: lo que se programa en "Deudas y metas" ---------------- */
function PestanaDeudas() {
  const { estado, periodoId, fila } = useDatos();
  const [deuda, setDeuda] = useState<{ abierta: boolean; rubro: Rubro | null }>({ abierta: false, rubro: null });
  const [evento, setEvento] = useState<{ abierta: boolean; sel: EventoSel }>({ abierta: false, sel: null });
  const deudas = planDeudas(estado, periodoId);
  const eventos = estado.rubros.filter(r => estado.categorias.find(c => c.id === r.categoria_id)?.seccion === 'evento');
  const periodo = estado.periodos.find(p => p.id === periodoId);
  const mesesDe = (r: Rubro) => estado.periodos.filter(p => valorCelda(estado, r, p.id) > 0);

  return (
    <>
      <Tarjeta
        titulo={<span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-surface-2 text-ink-2"><CreditCard className="size-4" /></span>Pagos de deudas</span>}
        subtitulo={`Lo que se paga en ${periodo?.etiqueta}. El saldo y el plan se definen en Deudas y metas.`}
        accion={<span className="pt-1.5 text-[14px] font-bold whitespace-nowrap tabular-nums">{cop(fila?.deudas ?? 0)}</span>}
      >
        {deudas.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {deudas.map(d => (
              <FilaRubro
                key={d.rubro.id}
                rubro={d.rubro}
                periodoId={periodoId}
                onMas={() => setDeuda({ abierta: true, rubro: d.rubro })}
                detalle={
                  d.liquidada ? (
                    <span className="flex items-center gap-1 font-semibold text-pos-text"><CircleCheck className="size-3.5" /> Liquidada</span>
                  ) : (
                    <>
                      Debe {cop(d.restante)} al cierre del mes
                      {d.faltaProgramar > 0.5 && <span className="font-semibold text-warn-text"> · faltan {cop(d.faltaProgramar)} por programar</span>}
                    </>
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">Sin deudas en el plan.</p>
        )}
        <PastillaSuave icono={Plus} className="mt-3" onClick={() => setDeuda({ abierta: true, rubro: null })}>Agregar deuda</PastillaSuave>
      </Tarjeta>

      <Tarjeta
        titulo={<span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-surface-2 text-ink-2"><Plane className="size-4" /></span>Viajes y eventos</span>}
        subtitulo="Gastos grandes reservados en un mes"
        accion={<span className="pt-1.5 text-[14px] font-bold whitespace-nowrap tabular-nums">{cop(fila?.eventos ?? 0)}</span>}
      >
        {eventos.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {eventos.map(r => {
              const meses = mesesDe(r);
              const mesEditar = meses.some(p => p.id === periodoId) ? periodoId : (meses[0]?.id ?? periodoId);
              return (
                <FilaRubro
                  key={r.id}
                  rubro={r}
                  periodoId={periodoId}
                  onMas={() => setEvento({ abierta: true, sel: { rubro: r, periodoId: mesEditar } })}
                  detalle={meses.length ? meses.map(p => `${p.etiqueta} · ${copCorto(valorCelda(estado, r, p.id))}`).join(' · ') : 'Sin mes asignado'}
                />
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">Sin viajes ni eventos.</p>
        )}
        <PastillaSuave icono={Plus} className="mt-3" onClick={() => setEvento({ abierta: true, sel: null })}>Agregar viaje o evento</PastillaSuave>
      </Tarjeta>

      <EnlacePlan texto="Ver el cronograma completo de deudas" />
      <HojaDeuda deuda={deuda.rubro} abierta={deuda.abierta} onCerrar={() => setDeuda(d => ({ ...d, abierta: false }))} />
      <HojaEvento evento={evento.sel} abierta={evento.abierta} onCerrar={() => setEvento(e => ({ ...e, abierta: false }))} />
    </>
  );
}

/* ---------------- Pestaña Ahorro: aportes de las metas de "Deudas y metas" ---------------- */
function PestanaAhorro({ onNuevoRubro, onEditarRubro }: { onNuevoRubro: (c: Categoria) => void; onEditarRubro: (r: Rubro) => void }) {
  const { estado, filas, fila, periodoId } = useDatos();
  const [meta, setMeta] = useState<{ abierta: boolean; meta: Meta | null }>({ abierta: false, meta: null });
  const metas = calcularMetas(estado, filas, periodoId);
  const periodo = estado.periodos.find(p => p.id === periodoId);
  const idsMetas = new Set(estado.metas.map(m => m.rubro_id).filter(Boolean));
  const otros = estado.rubros.filter(r => estado.categorias.find(c => c.id === r.categoria_id)?.seccion === 'ahorro' && !idsMetas.has(r.id));
  const catAhorro = estado.categorias.find(c => c.seccion === 'ahorro');

  return (
    <>
      <Tarjeta
        titulo={<span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-surface-2 text-ink-2"><Target className="size-4" /></span>Metas</span>}
        subtitulo={`Aportes de ${periodo?.etiqueta}. El valor y la fecha de cada meta se definen en Deudas y metas.`}
        accion={<span className="pt-1.5 text-[14px] font-bold whitespace-nowrap tabular-nums">{cop(fila?.ahorro ?? 0)}</span>}
      >
        {metas.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {metas.map(m => {
              const rubro = m.meta.modo === 'aportes' ? estado.rubros.find(r => r.id === m.meta.rubro_id) : undefined;
              const estadoMeta = m.pausada ? `En pausa desde ${etiquetaMes(m.pausadaDesde!)}: no se aporta`
                : m.meta.objetivo <= 0 ? 'Define el valor de la meta'
                : m.cumplida ? `Se cumple: ${cop(m.proyectado)} en ${m.etiquetaObjetivo}`
                : `Faltan ${cop(m.falta)}${m.meta.modo === 'aportes' ? ` · sube ${cop(m.aporteSugerido)}/mes` : ''}`;
              const detalle = (
                <>
                  <span>{cop(m.actual)} de {cop(m.meta.objetivo)}</span>
                  <Medidor className="my-1.5" valor={m.pct} tono={m.pausada ? 'ink' : m.cumplida ? 'pos' : 'accent'} etiqueta={`Avance de ${m.meta.nombre}`} />
                  <span className={cx(m.pausada ? 'font-semibold text-ink-2' : m.cumplida ? 'font-semibold text-pos-text' : m.meta.objetivo > 0 ? 'text-warn-text' : '')}>{estadoMeta}</span>
                </>
              );
              const abrir = () => setMeta({ abierta: true, meta: m.meta });
              if (rubro) return <FilaRubro key={m.meta.id} rubro={rubro} titulo={m.meta.nombre} periodoId={periodoId} onMas={abrir} detalle={detalle} />;
              return (
                <li key={m.meta.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[14px] leading-snug font-medium">{m.meta.nombre}</p>
                    <div className="mt-0.5 text-[12px] leading-snug text-muted">{detalle}</div>
                  </div>
                  <span className="w-[136px] shrink-0 text-right text-[12px] text-muted sm:w-[160px]">
                    Con lo que sobra<br /><b className="font-semibold text-ink-2">en cuenta {copCorto(fila?.caja ?? 0)}</b>
                  </span>
                  <BotonMas etiqueta={`Opciones de ${m.meta.nombre}`} onClick={abrir} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">Sin metas todavía.</p>
        )}
        <PastillaSuave icono={Plus} className="mt-3" onClick={() => setMeta({ abierta: true, meta: null })}>Agregar meta</PastillaSuave>
      </Tarjeta>

      {(otros.length > 0 || catAhorro) && (
        <Tarjeta
          titulo="Otros ahorros"
          subtitulo="Ahorro mensual que no está atado a una meta (ej. inversión, CDT)"
        >
          {otros.length > 0 && (
            <ul className="flex flex-col divide-y divide-line">
              {otros.map(r => <FilaRubro key={r.id} rubro={r} periodoId={periodoId} onMas={() => onEditarRubro(r)} />)}
            </ul>
          )}
          {catAhorro && <PastillaSuave icono={Plus} tono="neutro" className={otros.length ? 'mt-3' : ''} onClick={() => onNuevoRubro(catAhorro)}>Agregar ahorro</PastillaSuave>}
        </Tarjeta>
      )}

      <EnlacePlan texto="Ver todas las metas" />
      <HojaMeta meta={meta.meta} abierta={meta.abierta} onCerrar={() => setMeta(x => ({ ...x, abierta: false }))} />
    </>
  );
}

function EnlacePlan({ texto }: { texto: string }) {
  return (
    <Link href="/plan" className="foco flex items-center justify-between gap-3 rounded-3xl bg-surface px-5 py-4 shadow-card transition hover:bg-surface-2">
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{texto}</span>
        <span className="block text-[12px] text-muted">Deudas y metas es donde se crean, se editan y se ve su avance</span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-strong"><ArrowRight className="size-[18px]" /></span>
    </Link>
  );
}

type Frecuencia = 'todos' | 'algunos';
const OPCIONES_FRECUENCIA: { valor: Frecuencia; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos los meses' },
  { valor: 'algunos', etiqueta: 'Solo algunos meses' },
];

function HojaRubro({ rubro, onCerrar }: { rubro: Rubro | null; onCerrar: () => void }) {
  const { estado, periodoId, setCelda, actualizarRubro, borrarRubro, avisar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [usdTxt, setUsdTxt] = useState('');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('todos');
  const [meses, setMeses] = useState<string[]>([]);
  const [valorMeses, setValorMeses] = useState(0);
  const [tocado, setTocado] = useState(false);
  useEffect(() => {
    if (!rubro) return;
    const conValor = mesesConValor(estado, rubro);
    setNombre(rubro.nombre);
    setUsdTxt(rubro.saldo_usd != null ? String(rubro.saldo_usd) : '');
    setFrecuencia(rubro.recurrente ? 'todos' : 'algunos');
    setMeses(conValor.length ? conValor.map(p => p.id) : [periodoId]);
    setValorMeses(valorCelda(estado, rubro, periodoId) || (conValor[0] ? valorCelda(estado, rubro, conValor[0].id) : 0));
    setTocado(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubro]);
  if (!rubro) return <Hoja abierta={false} onCerrar={onCerrar} titulo="">{null}</Hoja>;

  const celda = estado.valores[claveCelda(rubro.id, periodoId)];
  const periodo = estado.periodos.find(p => p.id === periodoId);
  const valorMes = valorCelda(estado, rubro, periodoId);
  const seccion = estado.categorias.find(c => c.id === rubro.categoria_id)?.seccion;
  const esDeuda = seccion === 'deuda';
  const conFrecuencia = seccion === 'ingreso' || seccion === 'operativo' || seccion === 'ahorro';

  return (
    <Hoja
      abierta={!!rubro}
      onCerrar={onCerrar}
      titulo={rubro.nombre}
      subtitulo={`${periodo?.etiqueta} · ${cop(valorMes)}`}
      pie={
        <div className="flex gap-2">
          <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar rubro" onClick={async () => {
            if (!confirm(`¿Eliminar "${rubro.nombre}" de todos los meses?`)) return;
            await borrarRubro(rubro.id).catch(() => {});
            avisar('Rubro eliminado');
            onCerrar();
          }}><Trash2 /></BotonSecundario>
          <BotonAcento className="flex-1" onClick={async () => {
            const cambios: DatosRubro = {};
            if (nombre.trim() && nombre.trim() !== rubro.nombre) cambios.nombre = nombre.trim();
            if (esDeuda) {
              const usd = usdTxt.trim() === '' ? null : Number(usdTxt.replace(',', '.')) || 0;
              if (usd !== rubro.saldo_usd) cambios.saldo_usd = usd;
            }
            if (conFrecuencia) {
              const recurrente = frecuencia === 'todos';
              if (recurrente !== rubro.recurrente) cambios.recurrente = recurrente;
              if (!recurrente && tocado) {
                if (!meses.length) return avisar('Elige al menos un mes');
                cambios.valores = Object.fromEntries(estado.periodos.map(p => [p.id, meses.includes(p.id) ? valorMeses : 0]));
                cambios.autos = [];
              }
            }
            if (Object.keys(cambios).length) {
              try { await actualizarRubro(rubro.id, cambios); } catch { return; }
              if (cambios.recurrente === false || cambios.valores) avisar(`${nombre.trim() || rubro.nombre}: solo en ${meses.length} ${meses.length === 1 ? 'mes' : 'meses'}`);
            }
            onCerrar();
          }}>Guardar</BotonAcento>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre del rubro" htmlFor="rb-nombre">
          <Entrada id="rb-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} />
        </Campo>

        {conFrecuencia && (
          <Campo etiqueta="¿Cada cuánto?" ayuda={frecuencia === 'todos'
            ? 'Aparece en todos los meses y se copia al agregar meses nuevos.'
            : 'Solo aparece en los meses elegidos (primas, bonos, ingresos temporales, pagos anuales).'}>
            <Segmentado etiqueta="Frecuencia" valor={frecuencia} onChange={setFrecuencia} opciones={OPCIONES_FRECUENCIA} />
          </Campo>
        )}

        {conFrecuencia && frecuencia === 'algunos' ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
            <Campo etiqueta="Valor en cada mes elegido" htmlFor="rb-valor-meses">
              <EntradaDinero id="rb-valor-meses" valor={valorMeses} onValor={v => { setValorMeses(v); setTocado(true); }} className="[&_input]:bg-surface" />
            </Campo>
            <SelectorMeses etiqueta="Meses" sobreGris periodos={estado.periodos} seleccion={meses} onCambio={m => { setMeses(m); setTocado(true); }} />
            <p className="text-[12px] text-muted">
              {meses.length} {meses.length === 1 ? 'mes' : 'meses'} · total {cop(valorMeses * meses.length)}
              {tocado ? ' · los demás meses quedan en $ 0' : ''}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-2 p-4">
            <p className="text-[13px] font-semibold">Repetir valor</p>
            <p className="mt-0.5 text-[12px] text-muted">Copia {cop(valorMes)} a {periodo?.etiqueta} y a todos los meses siguientes.</p>
            <PastillaSuave icono={Copy} className="mt-3" onClick={() => {
              setCelda(rubro.id, periodoId, valorMes, { propagar: true });
              avisar('Valor aplicado a los meses siguientes');
              onCerrar();
            }}>Aplicar a los meses siguientes</PastillaSuave>
          </div>
        )}

        {esDeuda && (
          <div className="rounded-2xl bg-surface-2 p-4">
            <Campo etiqueta="Saldo de la deuda en dólares (opcional)" htmlFor="rb-usd"
              ayuda="Si la deuda es en USD, un mes en modo automático paga el saldo restante con la TRM vigente.">
              <Entrada id="rb-usd" inputMode="decimal" value={usdTxt} onChange={e => setUsdTxt(e.target.value)} placeholder="Ej: 500" />
            </Campo>
            {rubro.saldo_usd != null && (
              <PastillaSuave icono={Sparkles} tono={celda?.auto ? 'neutro' : 'accent'} className="mt-3" onClick={() => {
                setCelda(rubro.id, periodoId, celda?.auto ? valorMes : 0, { auto: !celda?.auto });
                onCerrar();
              }}>
                {celda?.auto ? 'Volver a valor manual este mes' : 'Pagar saldo restante este mes (auto)'}
              </PastillaSuave>
            )}
          </div>
        )}
      </div>
    </Hoja>
  );
}

function HojaNuevoRubro({ categoria, onCerrar }: { categoria: Categoria | null; onCerrar: () => void }) {
  const { estado, periodoId, crearRubro, avisar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('todos');
  const [valor, setValor] = useState(0);
  const [desde, setDesde] = useState('');
  const [meses, setMeses] = useState<string[]>([]);
  useEffect(() => {
    if (!categoria) return;
    setNombre('');
    setFrecuencia('todos');
    setValor(0);
    setDesde(periodoId);
    setMeses([periodoId]);
  }, [categoria, periodoId]);

  const destino: Periodo[] = frecuencia === 'todos' ? estado.periodos.filter(p => p.id >= desde) : estado.periodos.filter(p => meses.includes(p.id));
  const esIngreso = categoria?.seccion === 'ingreso';

  return (
    <Hoja
      abierta={!!categoria}
      onCerrar={onCerrar}
      titulo="Agregar rubro"
      subtitulo={categoria ? `En ${categoria.nombre}` : undefined}
      pie={
        <BotonAcento className="w-full" type="submit" form="form-rubro">Agregar</BotonAcento>
      }
    >
      <form id="form-rubro" className="flex flex-col gap-4" onSubmit={async e => {
        e.preventDefault();
        if (!categoria) return;
        if (!nombre.trim()) return avisar('Escribe el nombre');
        if (frecuencia === 'algunos' && !meses.length) return avisar('Elige al menos un mes');
        try {
          await crearRubro({
            categoria_id: categoria.id,
            nombre: nombre.trim(),
            recurrente: frecuencia === 'todos',
            valores: Object.fromEntries(destino.map(p => [p.id, valor])),
          });
          avisar(frecuencia === 'todos' ? 'Rubro agregado' : `Rubro agregado en ${destino.length} ${destino.length === 1 ? 'mes' : 'meses'}`);
          onCerrar();
        } catch { /* aviso ya mostrado */ }
      }}>
        <Campo etiqueta="Nombre" htmlFor="nr-nombre">
          <Entrada id="nr-nombre" autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder={esIngreso ? 'Ej: Prima de junio' : 'Ej: Netflix'} maxLength={120} />
        </Campo>
        <Campo etiqueta="¿Cada cuánto?">
          <Segmentado etiqueta="Frecuencia" valor={frecuencia} onChange={setFrecuencia} opciones={OPCIONES_FRECUENCIA} />
        </Campo>
        <div className="grid grid-cols-[1.5fr_1fr] gap-3">
          <Campo etiqueta={frecuencia === 'todos' ? 'Valor mensual' : 'Valor en cada mes'} htmlFor="nr-valor">
            <EntradaDinero id="nr-valor" valor={valor} onValor={setValor} />
          </Campo>
          {frecuencia === 'todos' && (
            <Campo etiqueta="Desde" htmlFor="nr-desde">
              <Selector id="nr-desde" value={desde} onChange={e => setDesde(e.target.value)}>
                {estado.periodos.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </Selector>
            </Campo>
          )}
        </div>
        {frecuencia === 'algunos' && (
          <Campo etiqueta="¿En qué meses?" ayuda="En los demás meses no aparece en el presupuesto.">
            <SelectorMeses etiqueta="Meses del rubro" periodos={estado.periodos} seleccion={meses} onCambio={setMeses} />
          </Campo>
        )}
        <p className="rounded-2xl bg-surface-2 p-3 text-[12px] text-ink-2">
          {valor > 0
            ? <>Suma <b className="font-semibold">{cop(valor)}</b> en {destino.length} {destino.length === 1 ? 'mes' : 'meses'} · total <b className="font-semibold">{cop(valor * destino.length)}</b></>
            : 'Puedes dejarlo en $ 0 y llenar cada mes después.'}
        </p>
      </form>
    </Hoja>
  );
}

/** Crear, renombrar o borrar una categoría del grupo visible. */
function HojaCategoria({ categoria, abierta, secciones, onCerrar }: {
  categoria: Categoria | null; abierta: boolean; secciones: Seccion[]; onCerrar: () => void;
}) {
  const { estado, guardarCategoria, borrarCategoria, avisar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [seccion, setSeccion] = useState<Seccion>('operativo');
  const [control, setControl] = useState('');
  const [icono, setIcono] = useState<string | null>(null);
  useEffect(() => {
    if (!abierta) return;
    setNombre(categoria?.nombre ?? '');
    setSeccion(categoria?.seccion ?? secciones[0]);
    setControl(categoria?.control ?? (secciones[0] === 'operativo' ? 'Fijo' : ''));
    setIcono(categoria?.icono ?? null);
  }, [abierta, categoria, secciones]);
  const nRubros = categoria ? estado.rubros.filter(r => r.categoria_id === categoria.id).length : 0;

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={categoria ? 'Editar categoría' : 'Nueva categoría'}
      subtitulo={categoria ? `${nRubros} ${nRubros === 1 ? 'rubro' : 'rubros'}` : 'Agrupa rubros parecidos: ej. Mascotas, Hijos, Salud'}
      pie={
        <div className="flex gap-2">
          {categoria && (
            <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar categoría" onClick={async () => {
              if (!confirm(`¿Eliminar "${categoria.nombre}"${nRubros ? ` y sus ${nRubros} rubros de todos los meses` : ''}?`)) return;
              await borrarCategoria(categoria.id).catch(() => {});
              avisar('Categoría eliminada');
              onCerrar();
            }}><Trash2 /></BotonSecundario>
          )}
          <BotonAcento type="submit" form="form-categoria" className="flex-1">{categoria ? 'Guardar' : 'Crear categoría'}</BotonAcento>
        </div>
      }
    >
      <form id="form-categoria" className="flex flex-col gap-4" onSubmit={async e => {
        e.preventDefault();
        if (!nombre.trim()) return avisar('Escribe el nombre');
        try {
          await guardarCategoria(categoria
            ? { id: categoria.id, nombre: nombre.trim(), control: control || null, icono }
            : { nombre: nombre.trim(), seccion, control: seccion === 'operativo' ? control || null : null, icono });
          avisar(categoria ? 'Categoría actualizada' : 'Categoría creada');
          onCerrar();
        } catch { /* aviso ya mostrado */ }
      }}>
        <Campo etiqueta="Nombre" htmlFor="cat-nombre">
          <Entrada id="cat-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} autoFocus={!categoria} />
        </Campo>
        <SelectorIcono valor={icono} onCambio={setIcono} nombre={nombre} respaldo="package" />
        {!categoria && secciones.length > 1 && (
          <Campo etiqueta="Tipo" htmlFor="cat-seccion">
            <Selector id="cat-seccion" value={seccion} onChange={e => setSeccion(e.target.value as Seccion)}>
              {secciones.map(s => <option key={s} value={s}>{NOMBRE_SECCION[s]}</option>)}
            </Selector>
          </Campo>
        )}
        {(categoria?.seccion ?? seccion) === 'operativo' && (
          <Campo etiqueta="Tipo de control" ayuda="Flexible = gastos que se pueden recortar para ahorrar">
            <Segmentado etiqueta="Tipo de control" valor={control || 'Fijo'} onChange={setControl}
              opciones={CONTROLES.map(c => ({ valor: c, etiqueta: c }))} />
          </Campo>
        )}
      </form>
    </Hoja>
  );
}

/* ---------------- Vista de tabla (escritorio) ---------------- */
function TablaCompleta() {
  const { estado, filas, periodoId, setPeriodoId } = useDatos();
  const filasTotal = (etiqueta: string, valores: number[], clase = '', signo = false) => (
    <tr className={clase}>
      <th scope="row" className="sticky left-0 z-10 bg-inherit px-4 py-2.5 text-left text-[13px] font-semibold whitespace-nowrap">{etiqueta}</th>
      {valores.map((v, i) => (
        <td key={i} className={cx('px-2 py-2.5 text-right text-[13px] font-semibold whitespace-nowrap tabular-nums', v < 0 && 'text-neg-text')}>
          {signo ? delta(v) : numero(v)}
        </td>
      ))}
    </tr>
  );

  return (
    <Tarjeta sinPadding className="mt-4 overflow-hidden">
      <div className="max-h-[calc(100dvh-220px)] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-surface">
              <th className="sticky left-0 z-30 min-w-[240px] border-b border-line bg-surface px-4 py-3 text-left text-[12px] font-semibold text-muted">Rubro</th>
              {estado.periodos.map(p => (
                <th key={p.id} className="border-b border-line px-1 py-2">
                  <button type="button" onClick={() => setPeriodoId(p.id)}
                    className={cx('foco w-full rounded-xl px-2 py-1 text-right', p.id === periodoId ? 'bg-accent-soft text-ink ring-1 ring-accent' : 'hover:bg-surface-2')}>
                    <span className="block text-[12px] font-semibold whitespace-nowrap">{p.etiqueta}</span>
                    <span className={cx('block text-[10px] font-medium whitespace-nowrap', p.id === periodoId ? 'text-accent-strong' : 'text-muted')}>Sueldo {diaSueldo(p.cobro)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map(g => {
              const cats = estado.categorias.filter(c => g.secciones.includes(c.seccion));
              return [
                <tr key={`g-${g.valor}`} className="bg-surface-2">
                  <th colSpan={estado.periodos.length + 1} className="sticky left-0 bg-surface-2 px-4 py-2 text-left text-[12px] font-bold">
                    {g.etiqueta}
                  </th>
                </tr>,
                ...cats.flatMap(cat =>
                  estado.rubros.filter(r => r.categoria_id === cat.id).map(r => (
                    <tr key={r.id} className="bg-surface hover:bg-surface-2/60">
                      <th scope="row" className="sticky left-0 z-10 border-b border-line bg-inherit px-4 py-1 text-left font-normal">
                        <span className="block max-w-[260px] truncate font-medium">{r.nombre}</span>
                        <span className="block text-[11px] text-muted">{cat.nombre}</span>
                      </th>
                      {estado.periodos.map(p => (
                        <td key={p.id} className={cx('border-b border-line px-1 py-1', p.id === periodoId && 'bg-accent-soft/50')}>
                          <CeldaTabla rubro={r} periodoId={p.id} />
                        </td>
                      ))}
                    </tr>
                  )),
                ),
              ];
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            {filasTotal('Total ingresos', filas.map(f => f.ingresos), 'bg-surface text-pos-text')}
            {filasTotal('Total egresos', filas.map(f => f.egresos), 'bg-surface')}
            {filasTotal('Sobra o falta en el mes', filas.map(f => f.flujo), 'bg-surface', true)}
            {filasTotal('En la cuenta al cierre', filas.map(f => f.caja), 'bg-ink text-on-ink')}
          </tfoot>
        </table>
      </div>
    </Tarjeta>
  );
}

function CeldaTabla({ rubro, periodoId }: { rubro: Rubro; periodoId: string }) {
  const { estado, setCelda } = useDatos();
  const celda = estado.valores[claveCelda(rubro.id, periodoId)];
  const [txt, setTxt] = useState(celda?.valor ? numero(celda.valor) : '');
  useEffect(() => {
    setTxt(t => (Number(t.replace(/\D/g, '')) === Math.round(celda?.valor ?? 0) ? t : celda?.valor ? numero(celda.valor) : ''));
  }, [celda?.valor]);
  if (celda?.auto) {
    return (
      <span title="Automático: saldo USD × TRM menos lo ya pagado" className="flex h-9 items-center justify-end gap-1 px-2 font-semibold whitespace-nowrap text-accent-strong tabular-nums">
        <Sparkles className="size-3" />{numero(valorCelda(estado, rubro, periodoId))}
      </span>
    );
  }
  return (
    <input
      inputMode="numeric"
      aria-label={`${rubro.nombre} ${periodoId}`}
      value={txt}
      placeholder="0"
      onFocus={e => e.target.select()}
      onChange={e => {
        const n = Number(e.target.value.replace(/\D/g, '')) || 0;
        setTxt(n ? numero(n) : '');
        setCelda(rubro.id, periodoId, n);
      }}
      className={cx(
        'foco h-9 w-[104px] rounded-lg bg-transparent px-2 text-right tabular-nums transition hover:bg-surface-2 focus:bg-surface',
        !celda?.valor && 'text-muted',
      )}
    />
  );
}

/* ---------------- Meses del plan ---------------- */
function MesesDelPlan() {
  const { estado, agregarPeriodo, quitarPeriodo, setPeriodoId, setConfig, avisar } = useDatos();
  const primero = estado.periodos[0], ultimo = estado.periodos.at(-1);
  const antes = primero ? mesAnterior(primero.id) : '';
  const despues = ultimo ? mesSiguiente(ultimo.id) : '';
  const quitar = async (cual: 'primero' | 'ultimo') => {
    const p = cual === 'primero' ? primero : ultimo;
    if (!p || !confirm(`¿Quitar ${p.etiqueta} y sus valores del plan?`)) return;
    await quitarPeriodo(cual).catch(() => {});
  };
  return (
    <Tarjeta className="mt-5" titulo="Meses del plan" subtitulo={`${estado.periodos.length} meses · de ${primero?.etiqueta} a ${ultimo?.etiqueta}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[12px] font-semibold text-muted">Al inicio</p>
          <div className="flex flex-wrap gap-2">
            <PastillaSuave icono={CalendarPlus} onClick={async () => {
              try { await agregarPeriodo('anterior'); } catch { return; }
              setPeriodoId(antes);
              avisar(`${etiquetaMes(antes)} agregado en $ 0: llena sus valores`);
            }}>Agregar {etiquetaMes(antes)}</PastillaSuave>
            <PastillaSuave icono={CalendarMinus} tono="neutro" onClick={() => quitar('primero')}>Quitar {primero?.etiqueta}</PastillaSuave>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[12px] font-semibold text-muted">Al final</p>
          <div className="flex flex-wrap gap-2">
            <PastillaSuave icono={CalendarPlus} onClick={async () => {
              try { await agregarPeriodo('siguiente'); } catch { return; }
              avisar(`${etiquetaMes(despues)} agregado con lo que se repite de ${ultimo?.etiqueta}`);
            }}>Agregar {etiquetaMes(despues)}</PastillaSuave>
            <PastillaSuave icono={CalendarMinus} tono="neutro" onClick={() => quitar('ultimo')}>Quitar {ultimo?.etiqueta}</PastillaSuave>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        Un mes al inicio (como el mes en curso) empieza en $ 0. Un mes al final copia lo que se repite cada mes y sigue las cuotas
        de las deudas con saldo; los viajes, eventos y rubros de solo algunos meses no se copian.
      </p>
      <div className="mt-4 border-t border-line pt-4 sm:max-w-sm">
        <Campo etiqueta={`Saldo en cuenta al empezar ${primero?.etiqueta ?? 'el plan'}`} htmlFor="saldo-inicial"
          ayuda="Lo que ya tienen ahorrado o disponible. Se suma a la plata en cuenta de todos los meses.">
          <EntradaDinero id="saldo-inicial" valor={estado.config.saldo_inicial || 0} onValor={v => setConfig({ saldo_inicial: v })} />
        </Campo>
      </div>
    </Tarjeta>
  );
}
