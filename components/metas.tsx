'use client';
// Metas de ahorro: con aportes mensuales (rubro del presupuesto) o con la caja que sobra.
// La fecha puede ser cualquiera: si cae después del plan, se proyecta.
import { CircleCheck, CirclePause, Ellipsis, Pause, Play, Telescope, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useDatos } from './proveedor';
import { BotonAcento, BotonSecundario, PastillaSuave, cx } from './ui/botones';
import { Campo, Entrada, EntradaDinero, Selector } from './ui/campos';
import { Insignia, Medidor } from './ui/datos';
import { Hoja } from './ui/hoja';
import { Segmentado } from './ui/segmentado';
import { SelectorIcono } from './ui/selector-icono';
import { calcularMetas, flujoLibre, planAportes, proyectarCaja, type EstadoMeta } from '@/lib/calculos';
import { cop, hoyISO } from '@/lib/formato';
import { iconoMeta } from '@/lib/iconos';
import { etiquetaMes, MESES, mesesEntre } from '@/lib/meses';
import type { Meta, ModoMeta } from '@/lib/tipos';

/** Una meta con su avance. */
export function FilaMeta({ m, onEditar }: { m: EstadoMeta; onEditar?: () => void }) {
  const Icono = iconoMeta(m.meta);
  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-2xl',
          m.pausada ? 'bg-surface-2 text-muted' : m.cumplida ? 'bg-pos-soft text-pos-text' : 'bg-accent-soft text-accent-strong')}>
          <Icono className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug">{m.meta.nombre}</p>
          <p className="text-[12px] text-muted">
            {[m.meta.detalle, m.etiquetaObjetivo && `para ${m.etiquetaObjetivo}`].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.pausada ? (
              <Insignia><CirclePause className="size-3" /> En pausa</Insignia>
            ) : (
              <Insignia tono={m.meta.modo === 'caja' ? 'neutro' : 'accent'}>
                {m.meta.modo === 'caja' ? 'Con lo que sobra' : `Aporte ${m.aporteActual ? cop(m.aporteActual) + '/mes' : 'mensual'}`}
              </Insignia>
            )}
            {m.despuesDelPlan && <Insignia><Telescope className="size-3" /> Proyección</Insignia>}
          </div>
        </div>
        {onEditar && (
          <button type="button" onClick={onEditar} aria-label={`Editar ${m.meta.nombre}`}
            className="foco -mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            <Ellipsis className="size-5" />
          </button>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 text-[13px]">
        <span><b className="text-[16px] font-bold tracking-tight">{cop(m.actual)}</b> <span className="text-muted">de {cop(m.meta.objetivo)}</span></span>
        <span className="font-semibold tabular-nums">{Math.round(m.pct * 100)} %</span>
      </div>
      <Medidor className="mt-1.5" valor={m.pct} tono={m.pausada ? 'ink' : m.cumplida ? 'pos' : 'accent'} etiqueta={`Avance de ${m.meta.nombre}`} />
      <p className={cx('mt-2 flex items-center gap-1.5 text-[12px] font-semibold', m.cumplida && !m.pausada ? 'text-pos-text' : 'text-ink-2')}>
        {m.pausada ? (
          <><Pause className="size-3.5 shrink-0 text-muted" /> En pausa desde {etiquetaMes(m.pausadaDesde!)}: no se aporta ni se reserva plata</>
        ) : m.meta.objetivo <= 0 ? (
          <span className="font-normal text-muted">Define el valor de la meta</span>
        ) : m.cumplida ? (
          <><CircleCheck className="size-3.5 shrink-0" /> {m.despuesDelPlan ? 'Se cumple según la proyección' : 'Se cumple con el plan'} ({cop(m.proyectado)} en {m.etiquetaObjetivo})</>
        ) : (
          <>
            <TriangleAlert className="size-3.5 shrink-0 text-warn-text" />
            Faltan {cop(m.falta)}{m.meta.modo === 'aportes' ? ` · sube ${cop(m.aporteSugerido)}/mes` : ''}
          </>
        )}
      </p>
    </li>
  );
}

type PlanAportes = 'mantener' | 'repartir';

/** Mes y año por separado: permite fechas lejanas (una casa en 2032) sin una lista eterna. */
function SelectorMesAnio({ valor, onCambio, desdeAnio }: { valor: string; onCambio: (v: string) => void; desdeAnio: number }) {
  const [a, m] = valor ? valor.split('-') : [String(desdeAnio), '12'];
  const anios = Array.from({ length: 26 }, (_, i) => desdeAnio + i);
  return (
    <div className="grid grid-cols-[1fr_1.2fr] gap-2">
      <Selector aria-label="Mes objetivo" value={m} onChange={e => onCambio(`${a}-${e.target.value}`)} className="px-3 pr-8">
        {MESES.map((x, i) => <option key={x} value={String(i + 1).padStart(2, '0')}>{x}</option>)}
      </Selector>
      <Selector aria-label="Año objetivo" value={a} onChange={e => onCambio(`${e.target.value}-${m}`)} className="px-3 pr-8">
        {anios.map(x => <option key={x} value={x}>{x}</option>)}
      </Selector>
    </div>
  );
}

export function HojaMeta({ meta, abierta, onCerrar }: { meta: Meta | null; abierta: boolean; onCerrar: () => void }) {
  const { estado, filas, periodoId, guardarMeta, borrarMeta, pausarMeta, reanudarMeta, avisar } = useDatos();
  const primero = estado.periodos[0]?.id ?? '';
  const ultimo = estado.periodos.at(-1)?.id ?? '';
  const [nombre, setNombre] = useState('');
  const [detalle, setDetalle] = useState('');
  const [objetivo, setObjetivo] = useState(0);
  const [ahorrado, setAhorrado] = useState(0);
  const [mesObj, setMesObj] = useState('');
  const [modo, setModo] = useState<ModoMeta>('aportes');
  const [plan, setPlan] = useState<PlanAportes>('repartir');
  const [aporte, setAporte] = useState(0);
  const [desde, setDesde] = useState('');
  const [icono, setIcono] = useState<string | null>(null);
  // Reanudar una meta en pausa: aporte y mes desde el que se vuelve a ahorrar
  const [aporteR, setAporteR] = useState(0);
  const [desdeR, setDesdeR] = useState('');
  const pausada = !!meta?.pausada_desde;
  // Se pausa (o se reanuda) desde el mes actual, dentro de los meses del plan
  const mesHoy = hoyISO().slice(0, 7);
  const mesPausa = mesHoy < primero ? primero : mesHoy;

  useEffect(() => {
    if (!abierta) return;
    setNombre(meta?.nombre ?? '');
    setDetalle(meta?.detalle ?? '');
    setObjetivo(meta?.objetivo ?? 0);
    setAhorrado(meta?.ahorrado ?? 0);
    setMesObj(meta?.periodo_objetivo ?? ultimo);
    setModo(meta?.modo ?? 'aportes');
    setPlan(meta?.rubro_id ? 'mantener' : 'repartir');
    setAporte(0);
    setDesde(periodoId);
    setIcono(meta?.icono ?? null);
    const opciones = estado.periodos.filter(p => p.id >= (meta?.pausada_desde ?? '')).map(p => p.id);
    setDesdeR(opciones.find(p => p >= mesPausa) ?? opciones[0] ?? '');
    setAporteR(meta?.aporte_pausado ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, meta]);

  const despues = !!mesObj && mesObj > ultimo;
  // Meses de aporte desde "desde" hasta el objetivo (después del plan se asume el mismo aporte cada mes).
  const meses = desde && mesObj ? Math.max(0, mesesEntre(desde, mesObj) + 1) : 0;
  const sugerido = meses ? Math.ceil(Math.max(0, objetivo - ahorrado) / meses / 1000) * 1000 : 0;
  const libre = flujoLibre(estado.config);
  const proyectado = useMemo(() => {
    if (!mesObj) return null;
    if (modo === 'caja') return ahorrado + Math.max(0, proyectarCaja(estado, filas)(mesObj));
    if (plan === 'repartir') return ahorrado + aporte * meses;
    return null;
  }, [modo, plan, ahorrado, aporte, meses, estado, filas, mesObj]);
  const etiquetaObj = mesObj ? etiquetaMes(mesObj) : '';

  // Avance de la meta guardada (con la pausa aplicada) y aporte para llegar a tiempo al reanudar
  const avance = meta ? calcularMetas(estado, filas, periodoId).find(x => x.meta.id === meta.id) : undefined;
  const objGuardado = meta?.periodo_objetivo ?? ultimo;
  const mesesR = desdeR && objGuardado ? Math.max(1, mesesEntre(desdeR, objGuardado) + 1) : 1;
  const sugeridoR = avance && meta ? Math.ceil(Math.max(0, meta.objetivo - avance.proyectado) / mesesR / 1000) * 1000 : 0;
  const aporteHoy = avance?.aporteActual ?? 0;

  async function pausar() {
    if (!meta) return;
    const libera = meta.modo === 'aportes' && aporteHoy ? ` Se liberan ${cop(aporteHoy)}/mes del presupuesto.` : '';
    if (!confirm(`¿Pausar "${meta.nombre}" desde ${etiquetaMes(mesPausa)}?${libera} Lo ahorrado se conserva.`)) return;
    try {
      await pausarMeta(meta.id, mesPausa);
      avisar(`Meta en pausa desde ${etiquetaMes(mesPausa)}`);
      onCerrar();
    } catch { /* aviso ya mostrado */ }
  }

  async function reanudar() {
    if (!meta) return;
    if (meta.modo === 'aportes' && aporteR <= 0) return avisar('Escribe el aporte mensual para reanudar');
    try {
      await reanudarMeta(meta.id, desdeR || mesPausa, aporteR);
      avisar(meta.modo === 'aportes' ? `Meta reanudada: ${cop(aporteR)}/mes desde ${etiquetaMes(desdeR || mesPausa)}` : 'Meta reanudada');
      onCerrar();
    } catch { /* aviso ya mostrado */ }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return avisar('Escribe el nombre de la meta');
    if (mesObj && primero && mesObj < primero) return avisar(`El mes objetivo debe ser desde ${etiquetaMes(primero)}`);
    if (modo === 'aportes' && plan === 'repartir' && mesObj && desde > mesObj) return avisar('El mes "desde" es posterior a la meta');
    try {
      await guardarMeta({
        id: meta?.id,
        nombre: nombre.trim(),
        detalle: detalle.trim(),
        objetivo,
        ahorrado,
        periodo_objetivo: mesObj || null,
        modo,
        icono,
        aportes: modo === 'aportes' && plan === 'repartir' && !pausada ? planAportes(estado, aporte, desde, mesObj || null) : null,
      });
      avisar(meta ? 'Meta actualizada' : 'Meta creada');
      onCerrar();
    } catch { /* aviso ya mostrado */ }
  }

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={meta ? 'Editar meta' : 'Nueva meta'}
      subtitulo="Carro, viaje, casa, fondo de emergencias, estudio…"
      pie={
        <div className="flex gap-2">
          {meta && (
            <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar meta" onClick={async () => {
              if (!confirm(`¿Eliminar la meta "${meta.nombre}"${meta.rubro_id ? ' y sus aportes del presupuesto' : ''}?`)) return;
              await borrarMeta(meta.id).catch(() => {});
              avisar('Meta eliminada');
              onCerrar();
            }}><Trash2 /></BotonSecundario>
          )}
          <BotonAcento type="submit" form="form-meta" className="flex-1">{meta ? 'Guardar' : 'Crear meta'}</BotonAcento>
        </div>
      }
    >
      <form id="form-meta" onSubmit={guardar} className="flex flex-col gap-4">
        {meta && pausada && (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-ink-2"><CirclePause className="size-5" /></span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">En pausa desde {etiquetaMes(meta.pausada_desde!)}</p>
                <p className="text-[12px] text-muted">
                  No se aporta ni se reserva plata de la cuenta para esta meta. Lleva {cop(avance?.actual ?? meta.ahorrado)} de {cop(meta.objetivo)}.
                </p>
              </div>
            </div>
            {meta.modo === 'aportes' && (
              <>
                <div className="grid grid-cols-[1.2fr_1fr] gap-3">
                  <Campo etiqueta="Aporte al reanudar" htmlFor="me-aporte-r">
                    <EntradaDinero id="me-aporte-r" valor={aporteR} onValor={setAporteR} className="[&_input]:bg-surface" />
                  </Campo>
                  <Campo etiqueta="Desde" htmlFor="me-desde-r">
                    <Selector id="me-desde-r" value={desdeR} onChange={e => setDesdeR(e.target.value)} className="bg-surface! px-3 pr-8">
                      {estado.periodos.filter(p => p.id >= meta.pausada_desde!).map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                    </Selector>
                  </Campo>
                </div>
                {sugeridoR > 0 && aporteR !== sugeridoR && (
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                    Para llegar a {etiquetaMes(objGuardado)}: <b className="font-semibold">{cop(sugeridoR)}/mes</b>
                    <PastillaSuave onClick={() => setAporteR(sugeridoR)}>Usar</PastillaSuave>
                  </div>
                )}
              </>
            )}
            <PastillaSuave icono={Play} onClick={reanudar} className="self-start">Reanudar meta</PastillaSuave>
          </div>
        )}
        <Campo etiqueta="Nombre" htmlFor="me-nombre">
          <Entrada id="me-nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Cuota inicial de la casa" maxLength={80} autoFocus={!meta} />
        </Campo>
        <SelectorIcono valor={icono} onCambio={setIcono} nombre={nombre} respaldo="target" />
        <Campo etiqueta="Valor de la meta" htmlFor="me-obj">
          <EntradaDinero id="me-obj" valor={objetivo} onValor={setObjetivo} />
        </Campo>
        <Campo etiqueta="¿Para cuándo?" ayuda={despues ? `Después del plan (termina en ${etiquetaMes(ultimo)}): se calcula con una proyección.` : undefined}>
          <SelectorMesAnio valor={mesObj} onCambio={setMesObj} desdeAnio={Number(primero.slice(0, 4)) || new Date().getFullYear()} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Ya ahorrado" htmlFor="me-ahorrado">
            <EntradaDinero id="me-ahorrado" valor={ahorrado} onValor={setAhorrado} />
          </Campo>
          <Campo etiqueta="Detalle (opcional)" htmlFor="me-detalle">
            <Entrada id="me-detalle" value={detalle} onChange={e => setDetalle(e.target.value)} maxLength={120} />
          </Campo>
        </div>

        <Campo etiqueta="¿Cómo se ahorra?">
          <Segmentado etiqueta="Modo de ahorro" valor={modo} onChange={setModo} opciones={[
            { valor: 'aportes', etiqueta: 'Aporte mensual' },
            { valor: 'caja', etiqueta: 'Con lo que sobra' },
          ]} />
        </Campo>

        {pausada ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-[12px] text-ink-2">
            Mientras esté en pausa no se programan aportes. Reanúdenla arriba cuando quieran volver a ahorrar.
          </p>
        ) : modo === 'aportes' ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
            {meta?.rubro_id && (
              <Segmentado etiqueta="Aportes" valor={plan} onChange={setPlan} className="bg-surface-3!" opciones={[
                { valor: 'mantener', etiqueta: 'Mantener aportes' },
                { valor: 'repartir', etiqueta: 'Reprogramar' },
              ]} />
            )}
            {plan === 'repartir' ? (
              <>
                <div className="grid grid-cols-[1.2fr_1fr] gap-3">
                  <Campo etiqueta="Aporte mensual" htmlFor="me-aporte">
                    <EntradaDinero id="me-aporte" valor={aporte} onValor={setAporte} className="[&_input]:bg-surface" />
                  </Campo>
                  <Campo etiqueta="Desde" htmlFor="me-desde">
                    <Selector id="me-desde" value={desde} onChange={e => setDesde(e.target.value)} className="bg-surface! px-3 pr-8">
                      {estado.periodos.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                    </Selector>
                  </Campo>
                </div>
                {sugerido > 0 && aporte !== sugerido && (
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                    Para llegar a tiempo: <b className="font-semibold">{cop(sugerido)}/mes</b> durante {meses} {meses === 1 ? 'mes' : 'meses'}
                    <PastillaSuave onClick={() => setAporte(sugerido)}>Usar</PastillaSuave>
                  </div>
                )}
                <p className="text-[12px] text-muted">
                  El aporte se reserva cada mes en el presupuesto (sección Ahorro) y reduce lo que sobra.
                  {despues && ` Después de ${etiquetaMes(ultimo)} se asume que sigues aportando lo mismo hasta ${etiquetaObj}.`}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-ink-2">Se conservan los aportes que ya tiene en el presupuesto.</p>
            )}
          </div>
        ) : (
          <p className="rounded-2xl bg-surface-2 p-4 text-[12px] text-ink-2">
            Se paga con la plata que habrá en la cuenta en {etiquetaObj} (lo que sobra mes a mes), como la meta del carro en el Excel.
            Si hay varias metas así, se reparten esa plata en orden de prioridad.
            {despues && (libre > 0
              ? ` Después de ${etiquetaMes(ultimo)} la cuenta crece ${cop(libre)}/mes según la proyección después del plan (Deudas y metas).`
              : ` Para estimar la cuenta después de ${etiquetaMes(ultimo)}, llena la proyección después del plan en Deudas y metas.`)}
          </p>
        )}

        {meta && !pausada && (
          <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
            <p className="text-[13px] font-semibold">¿Necesitan un respiro?</p>
            <p className="text-[12px] text-muted">
              Pausen la meta desde {etiquetaMes(mesPausa)}: {meta.modo === 'aportes'
                ? `dejan de reservar ${aporteHoy ? cop(aporteHoy) + '/mes' : 'el aporte'} en el presupuesto`
                : 'deja de reservar plata de la cuenta'}. Lo ahorrado se conserva y la pueden reanudar cuando quieran.
            </p>
            <PastillaSuave icono={Pause} tono="neutro" onClick={pausar} className="self-start">Pausar meta</PastillaSuave>
          </div>
        )}

        {!pausada && proyectado !== null && objetivo > 0 && (
          <p className={cx('flex items-center gap-1.5 rounded-2xl p-4 text-[13px] font-semibold',
            proyectado >= objetivo ? 'bg-pos-soft text-pos-text' : 'bg-warn-soft text-warn-text')}>
            {proyectado >= objetivo ? <CircleCheck className="size-4 shrink-0" /> : <TriangleAlert className="size-4 shrink-0" />}
            {proyectado >= objetivo
              ? `Llegas a ${cop(proyectado)} en ${etiquetaObj}`
              : `En ${etiquetaObj} tendrías ${cop(proyectado)}: faltan ${cop(objetivo - proyectado)}`}
          </p>
        )}
      </form>
    </Hoja>
  );
}
