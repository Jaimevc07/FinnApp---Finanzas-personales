'use client';
// Formulario para registrar o editar un movimiento real (ingreso o egreso).
// Se elige la categoría y el ítem del presupuesto (p. ej. Transporte y Salud → Combustible) para ver
// cuánto queda de ese ítem en el mes; con tarjeta de crédito, en qué extracto entra y cuándo se paga.
import { CalendarClock, Check, CreditCard, Trash2, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  categoriasMovimiento, cuposTarjetas, pagoDeCompra, realPorCategoria, realPorRubro, tarjetaPrincipal, valorCelda,
} from '@/lib/calculos';
import { conSigno, cop, fechaCorta, hoyISO } from '@/lib/formato';
import { iconoDe, iconoRubro } from '@/lib/iconos';
import { etiquetaMes } from '@/lib/meses';
import { cuando, quienFue } from '@/lib/miembros';
import { MEDIOS_PAGO, type TipoMovimiento } from '@/lib/tipos';
import { AvisoMesFueraCompacto } from './aviso-mes';
import { useFinanzas } from './proveedor';
import { BotonAcento, BotonSecundario, cx } from './ui/botones';
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
  // Ítems del presupuesto elegidos. Con varios, cada uno se guarda como un movimiento con su monto.
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [montos, setMontos] = useState<Record<number, number>>({});
  // true = el valor y la descripción los llenan los ítems elegidos (se empezó por elegir ítems)
  const [auto, setAuto] = useState(false);
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
    setSeleccion(borrador?.rubro_id ? [borrador.rubro_id] : []);
    setMontos({});
    setAuto(false);
    setMedio(borrador?.medio ?? MEDIOS_PAGO[0]);
    setFecha(borrador?.fecha ?? hoyISO());
    // '' = la primera tarjeta con cupo · 0 = otra tarjeta. Una compra vieja sin tarjeta queda como "otra".
    const guardada = borrador?.tarjeta_id && estado ? estado.rubros.find(r => r.id === borrador.tarjeta_id) : undefined;
    setTarjetaId(guardada && estado ? tarjetaPrincipal(estado, guardada).id : (borrador?.id && borrador.medio === 'Tarjeta de crédito' ? 0 : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro.abierto, borrador, registro.tipo]);

  // Si la categoría elegida no aplica al tipo (p. ej. al cambiar de egreso a ingreso), usa la de
  // por defecto: en ingresos, "Ingresos Extra" (los fijos ya están en el plan); en egresos, la primera.
  const porDefecto = (tipo === 'ingreso' ? categorias.find(c => /extra/i.test(c)) : undefined) ?? categorias[0] ?? '';
  const cat = categorias.includes(categoria) ? categoria : porDefecto;
  const mesMov = fecha.slice(0, 7);
  const fueraDelPlan = !!estado && /^\d{4}-\d{2}/.test(fecha) && !estado.periodos.some(p => p.id === mesMov);

  // Ítems del presupuesto de la categoría en el mes del movimiento (los que tienen monto van primero)
  const catPlan = estado?.categorias.find(c => c.nombre === cat);
  const items = estado && catPlan
    ? estado.rubros.filter(r => r.categoria_id === catPlan.id)
      .map(r => {
        const plan = fueraDelPlan ? 0 : valorCelda(estado, r, mesMov);
        const antes = realPorRubro(estado, mesMov, r.id, edicion?.id);
        return { r, plan, antes };
      })
      .sort((a, b) => Number(b.plan > 0) - Number(a.plan > 0))
    : [];
  const elegidos = seleccion.map(id => items.find(x => x.r.id === id)).filter(x => !!x);
  const varios = elegidos.length > 1;
  const item = elegidos.length === 1 ? elegidos[0] : undefined;
  const planCat = items.reduce((s, x) => s + x.plan, 0);
  const yaGastado = estado && tipo === 'egreso' && planCat > 0
    ? (realPorCategoria(estado, mesMov).get(cat) ?? 0) - (edicion && edicion.categoria === cat && edicion.fecha?.startsWith(mesMov) ? edicion.valor ?? 0 : 0)
    : 0;
  const conEste = yaGastado + (tipo === 'egreso' ? valor : 0);
  // Se pueden elegir varios ítems cuando se empieza por ellos (sin valor ni descripción) en un registro nuevo
  const multiple = !edicion && (auto || (!valor && !descripcion.trim()));

  /** Lo que se propone pagar (o recibir) de un ítem: lo que falta del mes, o todo si ya estaba completo. */
  const sugerido = (x: (typeof items)[number]) => Math.round(x.plan > x.antes ? x.plan - x.antes : x.plan);
  const nombreDe = (id: number) => items.find(x => x.r.id === id)?.r.nombre ?? '';

  /** Con los ítems elegidos se llenan el valor (la suma) y la descripción (sus nombres). */
  function aplicarAuto(ids: number[], m: Record<number, number>) {
    setSeleccion(ids);
    setMontos(m);
    if (!ids.length) { setAuto(false); setValor(0); setDescripcion(''); return; }
    setAuto(true);
    setValor(ids.reduce((s, id) => s + (m[id] || 0), 0));
    setDescripcion(ids.map(nombreDe).join(' + '));
  }

  function elegirItem(x: (typeof items)[number]) {
    const ya = seleccion.includes(x.r.id);
    if (multiple) {
      const ids = ya ? seleccion.filter(id => id !== x.r.id) : [...seleccion.filter(id => items.some(y => y.r.id === id)), x.r.id];
      aplicarAuto(ids, ya ? montos : { ...montos, [x.r.id]: montos[x.r.id] ?? sugerido(x) });
      return;
    }
    // Un solo ítem: el valor ya lo escribiste tú
    const anterior = item?.r.nombre;
    setSeleccion(ya ? [] : [x.r.id]);
    if (ya) return;
    // La descripción toma el nombre del ítem si estaba vacía o tenía el del ítem anterior
    if (!descripcion.trim() || descripcion === anterior) setDescripcion(x.r.nombre);
    // En un ingreso sin valor, se propone lo que falta por recibir de ese ítem
    if (tipo === 'ingreso' && !valor && x.plan > x.antes) setValor(Math.round(x.plan - x.antes));
  }

  /** Al cambiar de categoría o de tipo, los ítems elegidos ya no aplican. */
  function soltarItems() {
    if (auto) aplicarAuto([], {});
    else setSeleccion([]);
  }

  function cambiarValor(v: number) {
    setValor(v);
    // Con un ítem elegido por la app, el valor que escribas es el de ese ítem
    if (auto && elegidos.length === 1) setMontos({ ...montos, [elegidos[0].r.id]: v });
  }

  // Compra con tarjeta de crédito: cupo que queda antes y después de esta compra
  const conTarjeta = tipo === 'egreso' && medio === 'Tarjeta de crédito';
  const tarjeta = conTarjeta ? (tarjetas.find(t => t.id === tarjetaId) ?? (tarjetaId === '' ? tarjetas[0] : undefined)) : undefined;
  const cupo = estado && tarjeta ? cuposTarjetas(estado, mesMov).find(c => c.rubro.id === tarjeta.id) : undefined;
  // Al editar, la compra ya está contada en el cupo: se devuelve para no restarla dos veces
  const yaContada = edicion && edicion.tarjeta_id === tarjeta?.id && (edicion.fecha ?? '').slice(0, 7) <= mesMov ? edicion.valor ?? 0 : 0;
  const disponibleAntes = cupo ? cupo.disponible + yaContada : 0;
  const disponibleDespues = disponibleAntes - valor;
  // En qué extracto entra y cuándo se paga (según el día de corte y de pago de la tarjeta)
  const pago = estado && tarjeta ? pagoDeCompra(estado, fecha, tarjeta.dia_corte, tarjeta.dia_pago) : null;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (varios) {
      const sinMonto = elegidos.find(x => !(montos[x.r.id] > 0));
      if (sinMonto) return avisar(`Escribe cuánto pagas de ${sinMonto.r.nombre}`);
    } else if (valor <= 0) return avisar('Escribe un valor mayor a cero');
    setEnviando(true);
    let guardados = 0;
    try {
      if (varios) {
        // Un movimiento por ítem, para que cada uno cuente contra su presupuesto
        for (const x of elegidos) {
          await guardarMovimiento({
            tipo, valor: montos[x.r.id], descripcion: x.r.nombre, categoria: cat, medio, fecha,
            tarjeta_id: conTarjeta && tarjeta ? tarjeta.id : null, rubro_id: x.r.id,
          });
          guardados++;
        }
        const periodo = estado?.periodos.find(p => p.id === mesMov);
        if (periodo) setPeriodoId(periodo.id);
        avisar(`${guardados} ${tipo === 'ingreso' ? 'ingresos registrados' : 'pagos registrados'} en ${periodo?.etiqueta ?? etiquetaMes(mesMov)}`);
        cerrarRegistro();
        return;
      }
      await guardarMovimiento({
        id: edicion?.id, tipo, valor, descripcion: descripcion.trim() || item?.r.nombre || cat, categoria: cat, medio, fecha,
        tarjeta_id: conTarjeta && tarjeta ? tarjeta.id : null,
        rubro_id: item?.r.id ?? null,
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
    } catch {
      // El aviso del error ya se mostró. Si eran varios y alguno alcanzó a guardarse, se quita de la lista.
      if (varios && guardados > 0) {
        avisar(`Se guardaron ${guardados} de ${elegidos.length}. Revisa los que faltan y vuelve a intentar.`);
        aplicarAuto(elegidos.slice(guardados).map(x => x.r.id), montos);
      }
    } finally {
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
      ancha
      abierta={registro.abierto}
      onCerrar={cerrarRegistro}
      titulo={edicion ? 'Editar movimiento' : 'Registrar movimiento'}
      subtitulo="Lo que realmente entró o salió. Se compara con el presupuesto del mes."
      pie={
        <div className="flex gap-2 lg:justify-end">
          {edicion && (
            <BotonSecundario onClick={eliminar} aria-label="Eliminar movimiento" className="px-4 text-neg-text">
              <Trash2 />
            </BotonSecundario>
          )}
          <BotonAcento type="submit" form="form-registro" className="min-w-0 flex-1 lg:min-w-[280px] lg:flex-none" disabled={enviando}>
            {enviando ? 'Guardando…' : edicion ? 'Guardar cambios'
              : varios ? `Registrar ${elegidos.length} ${tipo === 'ingreso' ? 'ingresos' : 'pagos'}`
              : tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}
          </BotonAcento>
        </div>
      }
    >
      {/* En el celular va todo en una columna (el orden lo dan las clases order-*). En escritorio, dos columnas
          con su propio scroll: a la izquierda el movimiento, a la derecha la categoría y sus ítems. */}
      <form id="form-registro" onSubmit={guardar} className="flex min-w-0 flex-col gap-4 lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-0">
        <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:overflow-y-auto lg:overscroll-contain lg:py-1 lg:pr-6 lg:pb-5 lg:pl-1">
          <div className="min-w-0 empty:hidden order-1 lg:order-none">
          <Segmentado
            etiqueta="Tipo de movimiento"
            valor={tipo}
            onChange={t => { if (t !== tipo) soltarItems(); setTipo(t); }}
            opciones={[{ valor: 'egreso', etiqueta: '− Egreso', tono: 'neg' }, { valor: 'ingreso', etiqueta: '+ Ingreso', tono: 'pos' }]}
          />
          </div>
          <div className="min-w-0 empty:hidden order-2 lg:order-none">
          <Campo etiqueta="Valor" htmlFor="r-valor">
            <EntradaDinero id="r-valor" grande valor={valor} onValor={cambiarValor} placeholder="0" autoFocus={!borrador} readOnly={varios} />
            {varios && <p className="mt-1 text-[12px] text-muted">Es la suma de los {elegidos.length} ítems. Cambia el monto de cada uno abajo.</p>}
          </Campo>
          </div>
          <div className="min-w-0 empty:hidden order-3 lg:order-none">
          <Campo etiqueta="Descripción" htmlFor="r-desc">
            <Entrada id="r-desc" value={descripcion} onChange={e => { setDescripcion(e.target.value); if (auto && !varios) setAuto(false); }}
              readOnly={varios} placeholder={tipo === 'ingreso' ? 'Ej: sueldo María' : 'Ej: tanqueada'} maxLength={160} />
            {varios && <p className="mt-1 text-[12px] text-muted">Cada ítem se guarda como un movimiento con su nombre.</p>}
          </Campo>
          </div>
          <div className="min-w-0 empty:hidden order-7 lg:order-none">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
            <Campo etiqueta="Fecha" htmlFor="r-fecha">
              <Entrada id="r-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
            </Campo>
            <Campo etiqueta={tipo === 'ingreso' ? 'Llegó por' : 'Medio de pago'} htmlFor="r-medio">
              <Selector id="r-medio" value={medio} onChange={e => setMedio(e.target.value)}>
                {MEDIOS_PAGO.map(x => <option key={x}>{x}</option>)}
              </Selector>
            </Campo>
          </div>
          </div>
          <div className="min-w-0 empty:hidden order-8 lg:order-none">
          {fueraDelPlan && <AvisoMesFueraCompacto mesId={mesMov} />}
          </div>
          <div className="min-w-0 empty:hidden order-9 lg:order-none">
          {conTarjeta && (tarjetas.length ? (
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl bg-surface-2 p-3">
              <div className="min-w-0">
                <p id="r-tarjeta" className="mb-1.5 text-[12px] font-semibold text-muted">¿De cuál tarjeta?</p>
                <div role="radiogroup" aria-labelledby="r-tarjeta" className="flex flex-col gap-1.5">
                  {[...tarjetas.map(t => ({ id: t.id, nombre: t.nombre, icono: iconoRubro(t, estado?.categorias.find(c => c.id === t.categoria_id)) })),
                    { id: 0, nombre: 'Otra tarjeta', icono: CreditCard }].map(op => {
                    const elegida = op.id === 0 ? !tarjeta : tarjeta?.id === op.id;
                    const disp = op.id && estado ? cuposTarjetas(estado, mesMov).find(c => c.rubro.id === op.id) : undefined;
                    return (
                      <button key={op.id} type="button" role="radio" aria-checked={elegida} onClick={() => setTarjetaId(op.id)}
                        className={cx('foco flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition',
                          elegida ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface hover:bg-surface-3')}>
                        <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', elegida ? 'bg-surface text-accent-strong' : 'bg-surface-2 text-ink-2')}>
                          <op.icono className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{op.nombre}</span>
                          {op.id !== 0 && (
                            <span className={cx('block truncate text-[11px]', disp && disp.disponible < 0 ? 'font-semibold text-neg-text' : 'text-muted')}>
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
                <p className="text-[12px] text-muted">Para ver cuánto cupo les queda, agréguenlo en Deudas y metas (⋯ en la deuda).</p>
              )}
              {cupo && (
                <div className="text-[12px]">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-ink-2">Cupo disponible</span>
                    <b className="font-semibold tabular-nums">{cop(disponibleAntes)} de {cop(cupo.cupo)}</b>
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
              {tarjeta && (
                <p className="flex items-start gap-2 border-t border-line pt-3 text-[12px] text-ink-2">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted" />
                  {pago ? (
                    <span>
                      Entra al extracto del <b className="font-semibold">{fechaCorta(pago.corte)}</b> y la pagas hasta el <b className="font-semibold">{fechaCorta(pago.pago)}</b>:
                      sale del presupuesto de <b className="font-semibold">{etiquetaMes(pago.mesPago)}</b> <span className="whitespace-nowrap">(sueldo del {pago.sueldo})</span>.
                    </span>
                  ) : (
                    <span className="text-muted">Para saber en qué mes la pagas, agrega el día de corte y de pago de la tarjeta en Deudas y metas (⋯ en la deuda).</span>
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-3 text-[12px] text-muted">
              Aún no tienen tarjetas registradas. Agréguenlas en Deudas y metas (con su cupo) para elegirlas aquí.
            </p>
          ))}
          </div>
          <div className="min-w-0 empty:hidden order-6 lg:order-none">
          {/* Cómo queda el ítem (o la categoría) con este movimiento */}
          {item && item.plan > 0 ? (
            <ResumenItem tipo={tipo} valor={valor} categoria={cat} nombre={item.r.nombre} plan={item.plan} antes={item.antes} mes={etiquetaMes(mesMov)} />
          ) : tipo === 'egreso' && planCat > 0 && (
            <div className={cx('rounded-2xl p-3 text-[12px]', conEste > planCat ? 'bg-neg-soft' : conEste >= planCat * 0.85 ? 'bg-warn-soft' : 'bg-surface-2')}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-ink-2">Con este gasto, en {cat} llevas</span>
                <b className={cx('font-semibold tabular-nums', conEste > planCat ? 'text-neg-text' : 'text-ink')}>{cop(conEste)} de {cop(planCat)}</b>
              </p>
              <Medidor className="mt-2 bg-surface!" valor={planCat ? conEste / planCat : 0} tono={conEste > planCat ? 'neg' : 'ink'} etiqueta={`Gastado en ${cat}`} />
              {conEste > planCat && <p className="mt-1.5 font-semibold text-neg-text">Te pasas {cop(conEste - planCat)} del presupuesto de la categoría</p>}
            </div>
          )}
          </div>
          <div className="min-w-0 empty:hidden order-10 lg:order-none">
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
          </div>
        </div>
        <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-line lg:py-1 lg:pr-1 lg:pb-5 lg:pl-6">
          <div className="min-w-0 empty:hidden order-4 lg:order-none">
          <div className="min-w-0">
            <p id="r-cat" className="mb-1.5 text-[12px] font-semibold text-muted">Categoría</p>
            <div role="radiogroup" aria-labelledby="r-cat" className="flex flex-wrap gap-1.5">
              {categorias.map(c => {
                const elegida = c === cat;
                const Icono = iconoDe(c, estado?.categorias);
                return (
                  <button key={c} type="button" role="radio" aria-checked={elegida} onClick={() => { if (c !== cat) soltarItems(); setCategoria(c); }}
                    className={cx('foco inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-[0.97]',
                      elegida ? 'bg-accent-soft text-ink ring-2 ring-accent' : 'bg-surface-2 text-ink-2 hover:bg-surface-3')}>
                    <Icono className={cx('size-4 shrink-0', elegida ? 'text-accent-strong' : 'text-muted')} aria-hidden />
                    <span className="min-w-0 truncate">{c}</span>
                    {elegida && <Check className="size-3.5 shrink-0 text-accent-strong" strokeWidth={3} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
          </div>
          <div className="min-w-0 empty:hidden order-5 lg:order-none">
          {/* Ítem del presupuesto: Combustible, Mercado, Sueldo Jaime… */}
          {items.length > 0 && (
            <div className="min-w-0">
              <p id="r-item" className="mb-1.5 text-[12px] font-semibold text-muted">
                {multiple
                  ? <>¿Qué {tipo === 'ingreso' ? 'recibes' : 'pagas'} de {cat}? <span className="font-normal">(puedes elegir varios)</span></>
                  : <>¿Qué ítem de {cat}? <span className="font-normal">(opcional)</span></>}
              </p>
              {multiple && !elegidos.length && (
                <p className="-mt-0.5 mb-2 text-[12px] text-muted">Al elegirlos se llena el valor con lo que falta de cada uno.</p>
              )}
              <div role={multiple ? 'group' : 'radiogroup'} aria-labelledby="r-item" className="flex flex-col gap-1.5">
                {items.map(x => {
                  const elegido = seleccion.includes(x.r.id);
                  const queda = x.plan - x.antes;
                  return (
                    <div key={x.r.id} className={cx('min-w-0 rounded-xl transition', elegido ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2 hover:bg-surface-3')}>
                      <button type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={elegido} onClick={() => elegirItem(x)}
                        className="foco flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{x.r.nombre}</span>
                          <span className="block truncate text-[11px] text-muted">
                            {!x.plan
                              ? `Sin presupuesto en ${etiquetaMes(mesMov)}`
                              : tipo === 'ingreso'
                                ? `Esperado ${cop(x.plan)}${x.antes ? ` · recibido ${cop(x.antes)}` : ''}`
                                : `Presupuesto ${cop(x.plan)} · ${queda > 0 ? `quedan ${cop(queda)}` : queda === 0 ? (x.antes ? 'ya está pago' : 'quedan $ 0') : `pasado ${cop(-queda)}`}`}
                          </span>
                        </span>
                        <span className={cx('grid size-5 shrink-0 place-items-center border-2', multiple ? 'rounded-md' : 'rounded-full',
                          elegido ? 'border-accent-fill bg-accent-fill text-accent-ink' : 'border-line bg-surface')}>
                          {elegido && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      </button>
                      {varios && elegido && (
                        <div className="flex items-center justify-between gap-3 px-3 pb-2.5">
                          <label htmlFor={`r-monto-${x.r.id}`} className="text-[12px] font-semibold text-ink-2">{tipo === 'ingreso' ? 'Recibes' : 'Pagas'}</label>
                          <EntradaDinero id={`r-monto-${x.r.id}`} valor={montos[x.r.id] ?? 0} placeholder="0" className="w-40 [&_input]:h-10 [&_input]:bg-surface"
                            onValor={v => aplicarAuto(seleccion, { ...montos, [x.r.id]: v })} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>
      </form>
    </Hoja>
  );
}

/**
 * Cómo queda un ítem del presupuesto con este movimiento:
 *   $26.000 → Transporte y Salud
 *   Combustible: presupuesto $80.000
 *   Restante en el mes: $54.000
 */
function ResumenItem({ tipo, valor, categoria, nombre, plan, antes, mes }: {
  tipo: TipoMovimiento; valor: number; categoria: string; nombre: string; plan: number; antes: number; mes: string;
}) {
  const conEste = antes + valor;
  const queda = plan - conEste;
  const ingreso = tipo === 'ingreso';
  const mal = !ingreso && queda < 0;
  return (
    <div className={cx('rounded-2xl p-3 text-[13px]', mal ? 'bg-neg-soft' : !ingreso && queda < plan * 0.15 ? 'bg-warn-soft' : 'bg-surface-2')} aria-live="polite">
      <p className="text-ink-2">
        <b className={cx('font-semibold tabular-nums', ingreso ? 'text-pos-text' : 'text-ink')}>{valor ? conSigno(valor, tipo) : cop(0)}</b>
        {' → '}{categoria}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-semibold">{nombre}</span>
        <span className="text-ink-2 tabular-nums">{ingreso ? 'esperado' : 'presupuesto'} {cop(plan)}</span>
      </p>
      {antes > 0 && (
        <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] text-muted">
          <span>{ingreso ? 'Ya recibido' : 'Ya gastado'} en {mes}</span>
          <span className="tabular-nums">{cop(antes)}</span>
        </p>
      )}
      <Medidor className="my-2 bg-surface!" valor={plan ? conEste / plan : 0} tono={mal ? 'neg' : ingreso ? 'pos' : 'ink'} etiqueta={`${nombre}: ${ingreso ? 'recibido' : 'gastado'} del presupuesto`} />
      <p className={cx('flex flex-wrap items-baseline justify-between gap-x-2 font-semibold', mal ? 'text-neg-text' : 'text-ink')}>
        {ingreso
          ? (queda > 0 ? <><span>Falta por recibir en el mes</span><span className="tabular-nums">{cop(queda)}</span></>
            : <><span>{queda === 0 ? 'Recibido completo' : 'Recibiste más de lo esperado'}</span><span className="tabular-nums">{queda < 0 ? `+${cop(-queda)}` : ''}</span></>)
          : (queda >= 0 ? <><span>Restante en el mes</span><span className="tabular-nums">{cop(queda)}</span></>
            : <><span>Te pasas del presupuesto</span><span className="tabular-nums">{cop(-queda)}</span></>)}
      </p>
    </div>
  );
}
