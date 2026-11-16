'use client';
// Formulario para registrar o editar un movimiento real (ingreso o egreso).
import { Check, CreditCard, Trash2, UserRound } from 'lucide-react';
import { cuando, quienFue } from '@/lib/miembros';
import { iconoDe, iconoRubro } from '@/lib/iconos';
import { useEffect, useState } from 'react';
import { categoriasMovimiento, cuposTarjetas, realPorCategoria, tarjetaPrincipal, valorCelda } from '@/lib/calculos';
import { cop, copCorto, hoyISO } from '@/lib/formato';
import { etiquetaMes } from '@/lib/meses';
import { MEDIOS_PAGO, type TipoMovimiento } from '@/lib/tipos';
import { AvisoMesFueraCompacto } from './aviso-mes';
import { useFinanzas } from './proveedor';
import { BotonAcento, BotonSecundario, PastillaSuave, cx } from './ui/botones';
import { Campo, Entrada, EntradaDinero, Selector } from './ui/campos';
import { Medidor } from './ui/datos';
import { Hoja } from './ui/hoja';
import { Segmentado } from './ui/segmentado';

export function HojaRegistro() {
  const { estado, registro, cerrarRegistro, guardarMovimiento, borrarMovimiento, avisar, setPeriodoId } = useFinanzas();
  const borrador = registro.movimiento;
  // Con id se edita un movimiento existente; sin id es un borrador precargado.
  const edicion = borrador?.id ? borrador : null;
  const [tipo, setTipo] = useState<TipoMovimiento>('egreso');
  const [valor, setValor] = useState(0);
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [medio, setMedio] = useState<string>(MEDIOS_PAGO[0]);
  const [fecha, setFecha] = useState(hoyISO());
  const [tarjetaId, setTarjetaId] = useState<number | ''>('');
  const [enviando, setEnviando] = useState(false);

  const categorias = estado ? categoriasMovimiento(estado, tipo) : [];
  // Tarjetas de crédito: deudas con cupo, en una categoría de tarjetas o con nombre de tarjeta.
  // Si no se reconoce ninguna, se ofrecen todas las deudas. Las que tienen cupo van primero.
  const tarjetas = (() => {
    if (!estado) return [];
    // Las deudas que usan el cupo de otra son la misma tarjeta: solo se muestra la principal.
    const deudas = estado.rubros.filter(r => !r.cupo_de && estado.categorias.find(c => c.id === r.categoria_id)?.seccion === 'deuda');
    const esTarjeta = (r: (typeof deudas)[number]) => (r.cupo ?? 0) > 0
      || /tarjeta/i.test(estado.categorias.find(c => c.id === r.categoria_id)?.nombre ?? '')
      || /\btc\b|tarjeta|visa|master|amex|diners/i.test(r.nombre);
    const lista = deudas.some(esTarjeta) ? deudas.filter(esTarjeta) : deudas;
    return [...lista].sort((a, b) => Number((b.cupo ?? 0) > 0) - Number((a.cupo ?? 0) > 0));
  })();

  useEffect(() => {
    if (!registro.abierto) return;
    setTipo(borrador?.tipo ?? registro.tipo);
    setValor(borrador?.valor ?? 0);
    setDescripcion(borrador?.descripcion ?? '');
    setCategoria(borrador?.categoria ?? '');
    setMedio(borrador?.medio ?? MEDIOS_PAGO[0]);
    setFecha(borrador?.fecha ?? hoyISO());
    // '' = la primera tarjeta con cupo · 0 = otra tarjeta. Una compra vieja sin tarjeta queda como "otra".
    const guardada = borrador?.tarjeta_id && estado ? estado.rubros.find(r => r.id === borrador.tarjeta_id) : undefined;
    setTarjetaId(guardada && estado ? tarjetaPrincipal(estado, guardada).id : (borrador?.id && borrador.medio === 'Tarjeta de crédito' ? 0 : ''));
  }, [registro.abierto, borrador, registro.tipo]);

  // Si la categoría elegida no aplica al tipo (p. ej. al cambiar de egreso a ingreso), usa la de
  // por defecto: en ingresos, "Ingresos Extra" (los fijos ya están en el plan); en egresos, la primera.
  const porDefecto = (tipo === 'ingreso' ? categorias.find(c => /extra/i.test(c)) : undefined) ?? categorias[0] ?? '';
  const cat = categorias.includes(categoria) ? categoria : porDefecto;
  const mesMov = fecha.slice(0, 7);
  const fueraDelPlan = !!estado && /^\d{4}-\d{2}/.test(fecha) && !estado.periodos.some(p => p.id === mesMov);

  // Lo planeado para la categoría en el mes del movimiento: sugerencias y cuánto queda.
  const catPlan = estado?.categorias.find(c => c.nombre === cat);
  const rubrosPlan = estado && catPlan && !fueraDelPlan
    ? estado.rubros.filter(r => r.categoria_id === catPlan.id).map(r => ({ r, v: valorCelda(estado, r, mesMov) })).filter(x => x.v > 0)
    : [];
  const planCat = rubrosPlan.reduce((s, x) => s + x.v, 0);
  const yaGastado = estado && tipo === 'egreso' && planCat > 0
    ? (realPorCategoria(estado, mesMov).get(cat) ?? 0) - (edicion && edicion.categoria === cat && edicion.fecha?.startsWith(mesMov) ? edicion.valor ?? 0 : 0)
    : 0;
  const conEste = yaGastado + (tipo === 'egreso' ? valor : 0);

  // Compra con tarjeta de crédito: cupo que queda antes y después de esta compra
  const conTarjeta = tipo === 'egreso' && medio === 'Tarjeta de crédito';
  const tarjeta = conTarjeta ? (tarjetas.find(t => t.id === tarjetaId) ?? (tarjetaId === '' ? tarjetas[0] : undefined)) : undefined;
  const cupo = estado && tarjeta ? cuposTarjetas(estado, mesMov).find(c => c.rubro.id === tarjeta.id) : undefined;
  // Al editar, la compra ya está contada en el cupo: se devuelve para no restarla dos veces
  const yaContada = edicion && edicion.tarjeta_id === tarjeta?.id && (edicion.fecha ?? '').slice(0, 7) <= mesMov ? edicion.valor ?? 0 : 0;
  const disponibleAntes = cupo ? cupo.disponible + yaContada : 0;
  const disponibleDespues = disponibleAntes - valor;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (valor <= 0) return avisar('Escribe un valor mayor a cero');
    setEnviando(true);
    try {
      await guardarMovimiento({
        id: edicion?.id, tipo, valor, descripcion: descripcion.trim() || cat, categoria: cat, medio, fecha,
        tarjeta_id: conTarjeta && tarjeta ? tarjeta.id : null,
      });
      // Los movimientos se agrupan por mes calendario: lleva la vista al mes del movimiento.
      const periodo = estado?.periodos.find(p => p.id === mesMov);
      if (periodo) {
        setPeriodoId(periodo.id);
        avisar(edicion ? 'Movimiento actualizado' : `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado en ${periodo.etiqueta}`);
      } else {
        avisar(`Guardado, pero ${etiquetaMes(mesMov)} está fuera del plan (${estado?.periodos[0]?.etiqueta} – ${estado?.periodos.at(-1)?.etiqueta})`);
      }
      cerrarRegistro();
    } catch { /* el aviso ya se mostró */ } finally {
      setEnviando(false);
    }
  }

  async function eliminar() {
    if (!edicion?.id || !confirm(`¿Eliminar "${edicion.descripcion}"?`)) return;
    try {
      await borrarMovimiento(edicion.id);
      avisar('Movimiento eliminado');
      cerrarRegistro();
    } catch { /* aviso ya mostrado */ }
  }

  return (
    <Hoja
      abierta={registro.abierto}
      onCerrar={cerrarRegistro}
      titulo={edicion ? 'Editar movimiento' : 'Registrar movimiento'}
      subtitulo="Lo que realmente entró o salió. Se compara con el presupuesto del mes."
      pie={
        <div className="flex gap-2">
          {edicion && (
            <BotonSecundario onClick={eliminar} aria-label="Eliminar movimiento" className="px-4 text-neg-text">
              <Trash2 />
            </BotonSecundario>
          )}
          <BotonAcento type="submit" form="form-registro" className="flex-1" disabled={enviando}>
            {enviando ? 'Guardando…' : edicion ? 'Guardar cambios' : tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}
          </BotonAcento>
        </div>
      }
    >
      <form id="form-registro" onSubmit={guardar} className="flex flex-col gap-4">
        <Segmentado
          etiqueta="Tipo de movimiento"
          valor={tipo}
          onChange={setTipo}
          opciones={[{ valor: 'egreso', etiqueta: '− Egreso', tono: 'neg' }, { valor: 'ingreso', etiqueta: '+ Ingreso', tono: 'pos' }]}
        />
        <Campo etiqueta="Valor" htmlFor="r-valor">
          <EntradaDinero id="r-valor" grande valor={valor} onValor={setValor} placeholder="0" autoFocus={!borrador} />
        </Campo>
        <Campo etiqueta="Descripción" htmlFor="r-desc">
          <Entrada id="r-desc" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder={tipo === 'ingreso' ? 'Ej: sueldo María' : 'Ej: domicilio pizza'} maxLength={160} />
        </Campo>
        <div>
          <p id="r-cat" className="mb-1.5 text-[12px] font-semibold text-muted">Categoría</p>
          <div role="radiogroup" aria-labelledby="r-cat" className="flex flex-wrap gap-1.5">
            {categorias.map(c => {
              const elegida = c === cat;
              const Icono = iconoDe(c, estado?.categorias);
              return (
                <button key={c} type="button" role="radio" aria-checked={elegida} onClick={() => setCategoria(c)}
                  className={cx('foco inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-[0.97]',
                    elegida ? 'bg-accent-soft text-ink ring-2 ring-accent' : 'bg-surface-2 text-ink-2 hover:bg-surface-3')}>
                  <Icono className={cx('size-4 shrink-0', elegida ? 'text-accent-strong' : 'text-muted')} aria-hidden />
                  <span className="max-w-[200px] truncate">{c}</span>
                  {elegida && <Check className="size-3.5 shrink-0 text-accent-strong" strokeWidth={3} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
        <Campo etiqueta="Fecha" htmlFor="r-fecha">
          <Entrada id="r-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
        </Campo>

        {!edicion && rubrosPlan.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-muted">Del presupuesto de {etiquetaMes(mesMov)}</p>
            <div className="flex flex-wrap gap-1.5">
              {rubrosPlan.slice(0, 6).map(x => (
                <PastillaSuave key={x.r.id} tono="neutro" onClick={() => { setDescripcion(x.r.nombre); setValor(Math.round(x.v)); }}>
                  <span className="max-w-[160px] truncate">{x.r.nombre}</span>
                  <span className="text-muted">· {copCorto(x.v)}</span>
                </PastillaSuave>
              ))}
            </div>
          </div>
        )}

        {tipo === 'egreso' && planCat > 0 && (
          <div className={cx('rounded-2xl p-3 text-[12px]', conEste > planCat ? 'bg-neg-soft' : conEste >= planCat * 0.85 ? 'bg-warn-soft' : 'bg-surface-2')}>
            <p className="flex items-baseline justify-between gap-2">
              <span className="text-ink-2">Con este gasto, en {cat} llevas</span>
              <b className={cx('font-semibold tabular-nums', conEste > planCat ? 'text-neg-text' : 'text-ink')}>{cop(conEste)} de {cop(planCat)}</b>
            </p>
            <Medidor className="mt-2 bg-surface!" valor={planCat ? conEste / planCat : 0} tono={conEste > planCat ? 'neg' : 'ink'} etiqueta={`Gastado en ${cat}`} />
            {conEste > planCat && <p className="mt-1.5 font-semibold text-neg-text">Te pasas {cop(conEste - planCat)} del presupuesto de la categoría</p>}
          </div>
        )}

        {fueraDelPlan && <AvisoMesFueraCompacto mesId={mesMov} />}
        <Campo etiqueta={tipo === 'ingreso' ? 'Llegó por' : 'Medio de pago'} htmlFor="r-medio">
          <Selector id="r-medio" value={medio} onChange={e => setMedio(e.target.value)}>
            {MEDIOS_PAGO.map(x => <option key={x}>{x}</option>)}
          </Selector>
        </Campo>

        {conTarjeta && (tarjetas.length ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
            <div>
              <p id="r-tarjeta" className="mb-1.5 text-[12px] font-semibold text-muted">¿De cuál tarjeta?</p>
              <div role="radiogroup" aria-labelledby="r-tarjeta" className="flex flex-col gap-1.5">
                {[...tarjetas.map(t => ({ id: t.id, nombre: t.nombre, icono: iconoRubro(t, estado?.categorias.find(c => c.id === t.categoria_id)) })),
                  { id: 0, nombre: 'Otra tarjeta', icono: CreditCard }].map(op => {
                  const elegida = op.id === 0 ? !tarjeta : tarjeta?.id === op.id;
                  const disp = op.id && estado ? cuposTarjetas(estado, mesMov).find(c => c.rubro.id === op.id) : undefined;
                  return (
                    <button key={op.id} type="button" role="radio" aria-checked={elegida} onClick={() => setTarjetaId(op.id)}
                      className={cx('foco flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition',
                        elegida ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface hover:bg-surface-3')}>
                      <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', elegida ? 'bg-surface text-accent-strong' : 'bg-surface-2 text-ink-2')}>
                        <op.icono className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{op.nombre}</span>
                        {op.id !== 0 && (
                          <span className={cx('block text-[11px]', disp && disp.disponible < 0 ? 'font-semibold text-neg-text' : 'text-muted')}>
                            {disp ? `Disponible ${cop(disp.disponible + (edicion && edicion.tarjeta_id === op.id && (edicion.fecha ?? '').slice(0, 7) <= mesMov ? edicion.valor ?? 0 : 0))} de ${cop(disp.cupo)}` : 'Sin cupo registrado'}
                          </span>
                        )}
                      </span>
                      <span className={cx('grid size-5 shrink-0 place-items-center rounded-full border-2', elegida ? 'border-accent-fill bg-accent-fill text-accent-ink' : 'border-line')}>
                        {elegida && <Check className="size-3" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {tarjeta && !cupo && (
              <p className="text-[12px] text-muted">
                Para ver cuánto cupo les queda, agréguenlo en Deudas y metas (⋯ en la deuda).
              </p>
            )}
            {cupo && (
              <div className="text-[12px]">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-ink-2">Cupo disponible</span>
                  <b className="shrink-0 font-semibold tabular-nums">{cop(disponibleAntes)} de {cop(cupo.cupo)}</b>
                </p>
                <Medidor className="mt-2 bg-surface!" valor={cupo.cupo ? (cupo.cupo - disponibleDespues) / cupo.cupo : 0}
                  tono={disponibleDespues < 0 ? 'neg' : 'ink'} etiqueta="Cupo usado de la tarjeta" />
                <p className={cx('mt-1.5 font-semibold', disponibleDespues < 0 ? 'text-neg-text' : disponibleDespues < cupo.cupo * 0.1 ? 'text-warn-text' : 'text-ink')}>
                  {disponibleDespues < 0
                    ? `Esta compra supera el cupo por ${cop(-disponibleDespues)}`
                    : `Después de esta compra quedan ${cop(disponibleDespues)}`}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-2xl bg-surface-2 p-3 text-[12px] text-muted">
            Aún no tienen tarjetas registradas. Agréguenlas en Deudas y metas (con su cupo) para elegirlas aquí.
          </p>
        ))}

        {edicion && (quienFue(estado, edicion.creado_por) || quienFue(estado, edicion.editado_por)) && (
          <p className="flex items-start gap-2 text-[12px] text-muted">
            <UserRound className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {quienFue(estado, edicion.creado_por) && <>Registrado por <b className="font-semibold text-ink-2">{quienFue(estado, edicion.creado_por)}</b> {cuando(edicion.creado)}</>}
              {quienFue(estado, edicion.creado_por) && quienFue(estado, edicion.editado_por) && ' · '}
              {quienFue(estado, edicion.editado_por) && <>editado por <b className="font-semibold text-ink-2">{quienFue(estado, edicion.editado_por)}</b> {cuando(edicion.editado)}</>}
            </span>
          </p>
        )}
      </form>
    </Hoja>
  );
}
