'use client';
// Formularios de deudas y de viajes/eventos. Ambos son rubros del presupuesto:
// lo que se programa aquí aparece mes a mes en la vista Presupuesto.
import { CircleCheck, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useDatos } from './proveedor';
import { BotonAcento, BotonSecundario, PastillaSuave, cx } from './ui/botones';
import { Campo, Entrada, EntradaDinero, Selector } from './ui/campos';
import { Hoja } from './ui/hoja';
import { Segmentado } from './ui/segmentado';
import { SelectorIcono } from './ui/selector-icono';
import { cuposTarjetas, planDeudas, planPagos, valorCelda, type TipoPlan } from '@/lib/calculos';
import { cop, numero, tasaEA, usd } from '@/lib/formato';
import type { Rubro } from '@/lib/tipos';

type Plan = 'mantener' | TipoPlan;

/** Crear o editar una deuda (saldo, moneda, interés y plan de pago). */
export function HojaDeuda({ deuda, abierta, onCerrar }: { deuda: Rubro | null; abierta: boolean; onCerrar: () => void }) {
  const { estado, periodoId, crearRubro, actualizarRubro, borrarRubro, avisar } = useDatos();
  const categorias = estado.categorias.filter(c => c.seccion === 'deuda');
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [moneda, setMoneda] = useState<'COP' | 'USD'>('COP');
  const [saldo, setSaldo] = useState(0);
  const [usdTxt, setUsdTxt] = useState('');
  const [tasaTxt, setTasaTxt] = useState('');
  const [plan, setPlan] = useState<Plan>('cuota');
  const [cuota, setCuota] = useState(0);
  const [desde, setDesde] = useState('');
  const [mes, setMes] = useState('');
  const [icono, setIcono] = useState<string | null>(null);
  const [cupo, setCupo] = useState(0);
  const [cupoModo, setCupoModo] = useState<'propio' | 'compartido'>('propio');
  const [cupoDe, setCupoDe] = useState<number | ''>('');

  useEffect(() => {
    if (!abierta) return;
    setNombre(deuda?.nombre ?? '');
    setIcono(deuda?.icono ?? null);
    setCupo(deuda?.cupo ?? 0);
    setCupoModo(deuda?.cupo_de ? 'compartido' : 'propio');
    setCupoDe(deuda?.cupo_de ?? '');
    setCategoriaId(deuda?.categoria_id ?? categorias[0]?.id ?? '');
    setMoneda(deuda?.saldo_usd != null ? 'USD' : 'COP');
    setSaldo(deuda?.saldo ?? 0);
    setUsdTxt(deuda?.saldo_usd != null ? String(deuda.saldo_usd).replace('.', ',') : '');
    setTasaTxt(deuda?.tasa ? String(deuda.tasa).replace('.', ',') : '');
    setPlan(deuda ? 'mantener' : 'cuota');
    setCuota(0);
    setDesde(periodoId);
    setMes(periodoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, deuda]);

  const usdNum = Number(usdTxt.replace(',', '.')) || 0;
  const tasa = Number(tasaTxt.replace(',', '.')) || 0;
  const saldoCop = moneda === 'USD' ? usdNum * estado.config.trm : saldo;
  const simulacion = useMemo(
    () => (plan === 'mantener' ? null : planPagos(estado, { saldo: saldoCop, tasa, tipo: plan, cuota, desde, mes })),
    [estado, saldoCop, tasa, plan, cuota, desde, mes],
  );
  // Cuota mínima para terminar de pagar dentro del plan (búsqueda binaria sobre la simulación)
  const cuotaMinima = useMemo(() => {
    if (plan !== 'cuota' || saldoCop <= 0) return 0;
    let lo = 0, hi = saldoCop * 2;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (planPagos(estado, { saldo: saldoCop, tasa, tipo: 'cuota', cuota: m, desde }).restante > 0) lo = m; else hi = m;
    }
    return Math.ceil(hi / 1000) * 1000;
  }, [estado, saldoCop, tasa, plan, desde]);

  // Lo que se debe hoy según el plan (al cierre del mes seleccionado)
  const actual = deuda ? planDeudas(estado, periodoId).find(d => d.rubro.id === deuda.id) : undefined;
  const mesSel = estado.periodos.find(p => p.id === periodoId)?.etiqueta ?? '';

  // Deudas principales a las que esta puede sumarse (misma tarjeta, otra moneda)
  const otrasTarjetas = estado.rubros.filter(r => r.id !== deuda?.id && !r.cupo_de
    && estado.categorias.find(c => c.id === r.categoria_id)?.seccion === 'deuda');
  const principal = cupoModo === 'compartido' ? otrasTarjetas.find(r => r.id === cupoDe) : undefined;
  const cupoPrincipal = principal ? cuposTarjetas(estado, periodoId).find(c => c.rubro.id === principal.id) : undefined;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return avisar('Escribe el nombre de la deuda');
    if (cupoModo === 'compartido' && !cupoDe) return avisar('Elige la deuda cuyo cupo usa');
    const datos = {
      nombre: nombre.trim(),
      categoria_id: categoriaId ? Number(categoriaId) : undefined,
      seccion: 'deuda' as const,
      saldo: moneda === 'COP' ? saldo || null : null,
      saldo_usd: moneda === 'USD' ? usdNum || null : null,
      tasa: tasa || null,
      cupo: cupoModo === 'propio' ? cupo || null : null,
      cupo_de: cupoModo === 'compartido' && cupoDe ? Number(cupoDe) : null,
      icono,
      ...(simulacion
        ? moneda === 'USD' && plan === 'unico'
          ? { valores: {}, autos: [mes] } // se calcula sola con la TRM vigente
          : { valores: simulacion.valores, autos: [] }
        : {}),
    };
    try {
      if (deuda) await actualizarRubro(deuda.id, datos);
      else await crearRubro(datos);
      avisar(deuda ? 'Deuda actualizada' : 'Deuda agregada al plan');
      onCerrar();
    } catch { /* aviso ya mostrado */ }
  }

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={deuda ? 'Editar deuda' : 'Agregar deuda'}
      subtitulo="Los pagos quedan programados mes a mes en el presupuesto"
      pie={
        <div className="flex gap-2">
          {deuda && (
            <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar deuda" onClick={async () => {
              if (!confirm(`¿Eliminar "${deuda.nombre}" y sus pagos del presupuesto?`)) return;
              await borrarRubro(deuda.id).catch(() => {});
              avisar('Deuda eliminada');
              onCerrar();
            }}><Trash2 /></BotonSecundario>
          )}
          <BotonAcento type="submit" form="form-deuda" className="flex-1">{deuda ? 'Guardar' : 'Agregar deuda'}</BotonAcento>
        </div>
      }
    >
      <form id="form-deuda" onSubmit={guardar} className="flex flex-col gap-4">
        {actual && (
          <div className={cx('rounded-2xl p-4', actual.liquidada ? 'bg-pos-soft' : 'bg-surface-2')}>
            <p className="text-[12px] font-semibold text-muted">Deben al cierre de {mesSel}</p>
            <p className={cx('mt-0.5 text-[24px] font-bold leading-tight tracking-tight', actual.liquidada && 'text-pos-text')}>
              {actual.liquidada ? 'Liquidada' : cop(actual.restante)}
            </p>
            <p className="mt-1 text-[12px] text-ink-2">
              {[
                deuda?.saldo_usd && !actual.liquidada && estado.config.trm ? `≈ ${usd(actual.restante / estado.config.trm)} a TRM ${cop(estado.config.trm)}` : null,
                `Pagado ${cop(actual.pagado)} de ${cop(actual.programado)} programados`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        )}
        <Campo etiqueta="Nombre" htmlFor="d-nombre">
          <Entrada id="d-nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Tarjeta Visa Davivienda" maxLength={120} autoFocus={!deuda} />
        </Campo>
        <SelectorIcono valor={icono} onCambio={setIcono} nombre={nombre} respaldo="credit-card" />
        {categorias.length > 1 && (
          <Campo etiqueta="Tipo de deuda" htmlFor="d-cat">
            <Selector id="d-cat" value={categoriaId} onChange={e => setCategoriaId(Number(e.target.value))}>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
          </Campo>
        )}
        <Campo etiqueta="Moneda">
          <Segmentado etiqueta="Moneda" valor={moneda} onChange={setMoneda} opciones={[{ valor: 'COP', etiqueta: 'Pesos' }, { valor: 'USD', etiqueta: 'Dólares' }]} />
        </Campo>
        <div className="grid grid-cols-[1.5fr_1fr] gap-3">
          {moneda === 'COP' ? (
            <Campo etiqueta="Saldo al empezar el plan" htmlFor="d-saldo"
              ayuda={!saldo && actual && actual.programado > 0 ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  Vacío: se toma lo programado ({cop(actual.programado)})
                  <PastillaSuave className="h-7 px-2.5 text-[12px]" onClick={() => setSaldo(Math.round(actual.programado))}>Usar</PastillaSuave>
                </span>
              ) : undefined}>
              <EntradaDinero id="d-saldo" valor={saldo} onValor={setSaldo} placeholder={actual?.programado ? numero(actual.programado) : '0'} />
            </Campo>
          ) : (
            <Campo etiqueta="Saldo en dólares" htmlFor="d-usd" ayuda={usdNum ? `≈ ${cop(saldoCop)} a TRM ${cop(estado.config.trm)}` : undefined}>
              <Entrada id="d-usd" inputMode="decimal" value={usdTxt} onChange={e => setUsdTxt(e.target.value)} placeholder="Ej: 500" className="text-right tabular-nums" />
            </Campo>
          )}
          <Campo etiqueta="Interés mensual %" htmlFor="d-tasa" ayuda={tasa > 0 ? `≈ ${tasaEA(tasa)}` : 'Mensual (M.V.)'}>
            <Entrada id="d-tasa" inputMode="decimal" value={tasaTxt} onChange={e => setTasaTxt(e.target.value)} placeholder="0" className="text-right tabular-nums" />
          </Campo>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
          <Campo etiqueta="Cupo de la tarjeta (opcional)">
            <Segmentado etiqueta="Cupo" valor={cupoModo} onChange={setCupoModo} className="bg-surface-3!" opciones={[
              { valor: 'propio', etiqueta: 'Cupo propio' },
              { valor: 'compartido', etiqueta: 'Usa el de otra deuda' },
            ]} />
          </Campo>
          {cupoModo === 'propio' ? (
            <Campo etiqueta="Cupo total" htmlFor="d-cupo"
              ayuda={cupo > 0
                ? saldoCop > 0
                  ? `Hoy usan ${cop(saldoCop)}${deuda && estado.rubros.some(r => r.cupo_de === deuda.id) ? ' más las otras partes de la tarjeta' : ''}. Las compras con esta tarjeta lo van restando.`
                  : 'Las compras que registren con esta tarjeta irán restando del cupo.'
                : 'Si es una tarjeta de crédito, escribe el cupo para ver cuánto queda al registrar compras con ella.'}>
              <EntradaDinero id="d-cupo" valor={cupo} onValor={setCupo} className="[&_input]:bg-surface" />
            </Campo>
          ) : (
            <Campo etiqueta="Es parte de la tarjeta" htmlFor="d-cupo-de"
              ayuda={cupoPrincipal
                ? `Comparten un cupo de ${cop(cupoPrincipal.cupo)}: hoy quedan ${cop(cupoPrincipal.disponible)}.`
                : 'Para una tarjeta con deuda en pesos y en dólares: el cupo se pone en una y la otra lo usa.'}>
              <Selector id="d-cupo-de" value={cupoDe} onChange={e => setCupoDe(e.target.value ? Number(e.target.value) : '')} className="bg-surface!">
                <option value="">Elige la deuda que tiene el cupo…</option>
                {otrasTarjetas.map(r => <option key={r.id} value={r.id}>{r.nombre}{r.cupo ? ` · cupo ${cop(r.cupo)}` : ''}</option>)}
              </Selector>
            </Campo>
          )}
        </div>

        <Campo etiqueta="Plan de pago">
          <Segmentado etiqueta="Plan de pago" valor={plan} onChange={setPlan} opciones={[
            ...(deuda ? [{ valor: 'mantener' as const, etiqueta: 'Mantener' }] : []),
            { valor: 'cuota', etiqueta: 'Cuota mensual' },
            { valor: 'unico', etiqueta: 'Pago único' },
          ]} />
        </Campo>

        {plan === 'cuota' && (
          <div className="grid grid-cols-[1.5fr_1fr] gap-3">
            <Campo etiqueta="Cuota" htmlFor="d-cuota">
              <EntradaDinero id="d-cuota" valor={cuota} onValor={setCuota} />
            </Campo>
            <Campo etiqueta="Desde" htmlFor="d-desde">
              <Selector id="d-desde" value={desde} onChange={e => setDesde(e.target.value)}>
                {estado.periodos.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </Selector>
            </Campo>
          </div>
        )}
        {plan === 'unico' && (
          <Campo etiqueta="Mes del pago" htmlFor="d-mes" ayuda={moneda === 'USD' ? 'En dólares el pago se recalcula solo si cambia la TRM.' : undefined}>
            <Selector id="d-mes" value={mes} onChange={e => setMes(e.target.value)}>
              {estado.periodos.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </Selector>
          </Campo>
        )}
        {plan === 'mantener' && (
          <p className="rounded-2xl bg-surface-2 p-4 text-[13px] text-ink-2">
            Se conservan los pagos que ya tiene en el presupuesto. Elige “Cuota mensual” o “Pago único” para reprogramarlos.
          </p>
        )}

        {simulacion && saldoCop > 0 && (
          <div className={cx('rounded-2xl p-4 text-[13px]', simulacion.restante > 0.5 ? 'bg-warn-soft' : 'bg-pos-soft')}>
            {simulacion.restante > 0.5 ? (
              <>
                <p className="flex items-center gap-1.5 font-semibold text-warn-text"><TriangleAlert className="size-4" />
                  {plan === 'cuota' && cuota === 0 ? 'Escribe la cuota mensual' : `Quedan ${cop(simulacion.restante)} sin pagar al final del plan`}
                </p>
                {plan === 'cuota' && cuotaMinima > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-ink-2">
                    Cuota mínima para pagarla en el plan: <b className="font-semibold">{cop(cuotaMinima)}</b>
                    <PastillaSuave onClick={() => setCuota(cuotaMinima)}>Usar</PastillaSuave>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 font-semibold text-pos-text"><CircleCheck className="size-4" />
                  Queda pagada en {simulacion.liquidaEn?.etiqueta}
                </p>
                <p className="mt-1 text-ink-2">
                  Total a pagar {cop(simulacion.total)}{simulacion.intereses > 0 ? ` · intereses ${cop(simulacion.intereses)}` : ''}
                  {moneda === 'USD' ? ` · ${usd(usdNum)}` : ''}
                </p>
              </>
            )}
          </div>
        )}
      </form>
    </Hoja>
  );
}

export type EventoSel = { rubro: Rubro; periodoId: string } | null;

/** Crear o editar un viaje o evento (un gasto grande en un mes). */
export function HojaEvento({ evento, abierta, onCerrar }: { evento: EventoSel; abierta: boolean; onCerrar: () => void }) {
  const { estado, periodoId, crearRubro, actualizarRubro, borrarRubro, setCelda, avisar } = useDatos();
  const categorias = estado.categorias.filter(c => c.seccion === 'evento');
  const [nombre, setNombre] = useState('');
  const [mes, setMes] = useState('');
  const [valor, setValor] = useState(0);
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [icono, setIcono] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta) return;
    setNombre(evento?.rubro.nombre ?? '');
    setIcono(evento?.rubro.icono ?? null);
    setMes(evento?.periodoId ?? periodoId);
    setValor(evento ? valorCelda(estado, evento.rubro, evento.periodoId) : 0);
    setCategoriaId(evento?.rubro.categoria_id ?? categorias[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, evento]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return avisar('Escribe el nombre');
    if (valor <= 0) return avisar('Escribe el valor');
    try {
      if (evento) {
        const valores = Object.fromEntries(estado.periodos.map(p => [p.id, valorCelda(estado, evento.rubro, p.id)]));
        valores[evento.periodoId] = 0;
        valores[mes] = valor;
        await actualizarRubro(evento.rubro.id, { nombre: nombre.trim(), icono, valores, autos: [] });
      } else {
        await crearRubro({ nombre: nombre.trim(), icono, categoria_id: categoriaId ? Number(categoriaId) : undefined, seccion: 'evento', valores: { [mes]: valor } });
      }
      avisar(evento ? 'Evento actualizado' : 'Evento agregado al presupuesto');
      onCerrar();
    } catch { /* aviso ya mostrado */ }
  }

  async function eliminar() {
    if (!evento || !confirm(`¿Quitar "${evento.rubro.nombre}" de ${estado.periodos.find(p => p.id === evento.periodoId)?.etiqueta}?`)) return;
    const otros = estado.periodos.some(p => p.id !== evento.periodoId && valorCelda(estado, evento.rubro, p.id) > 0);
    if (otros) setCelda(evento.rubro.id, evento.periodoId, 0);
    else await borrarRubro(evento.rubro.id).catch(() => {});
    avisar('Evento eliminado');
    onCerrar();
  }

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={evento ? 'Editar viaje o evento' : 'Agregar viaje o evento'}
      subtitulo="Un gasto grande en un mes: viajes, matrículas, celebraciones, regalos"
      pie={
        <div className="flex gap-2">
          {evento && <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar evento" onClick={eliminar}><Trash2 /></BotonSecundario>}
          <BotonAcento type="submit" form="form-evento" className="flex-1">{evento ? 'Guardar' : 'Agregar'}</BotonAcento>
        </div>
      }
    >
      <form id="form-evento" onSubmit={guardar} className="flex flex-col gap-4">
        <Campo etiqueta="Nombre" htmlFor="ev-nombre">
          <Entrada id="ev-nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Viaje a Cartagena" maxLength={120} autoFocus={!evento} />
        </Campo>
        <SelectorIcono valor={icono} onCambio={setIcono} nombre={nombre} respaldo="party-popper" />
        <div className="grid grid-cols-[1.5fr_1fr] gap-3">
          <Campo etiqueta="Valor" htmlFor="ev-valor">
            <EntradaDinero id="ev-valor" valor={valor} onValor={setValor} />
          </Campo>
          <Campo etiqueta="Mes" htmlFor="ev-mes">
            <Selector id="ev-mes" value={mes} onChange={e => setMes(e.target.value)}>
              {estado.periodos.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </Selector>
          </Campo>
        </div>
        {!evento && categorias.length > 1 && (
          <Campo etiqueta="Categoría" htmlFor="ev-cat">
            <Selector id="ev-cat" value={categoriaId} onChange={e => setCategoriaId(Number(e.target.value))}>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
          </Campo>
        )}
      </form>
    </Hoja>
  );
}
