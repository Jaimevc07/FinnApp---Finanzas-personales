'use client';
import { Check, ChevronLeft, Ellipsis, FolderPlus, Pencil, Plus, ReceiptText, RotateCcw, ShoppingBasket } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { HojaGrupo, HojaItem, HojaLista } from '@/components/listas';
import { useDatos } from '@/components/proveedor';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { ConDatos } from '@/components/shell';
import { BotonCircular, BotonPrimario, PastillaSuave, cx } from '@/components/ui/botones';
import { BarraDividida, Insignia, Medidor, MontoHeroe } from '@/components/ui/datos';
import { EncabezadoPantalla, Tarjeta, Vacio } from '@/components/ui/estructura';
import { Segmentado } from '@/components/ui/segmentado';
import { presupuestoLista, totalesLista } from '@/lib/calculos';
import { cop } from '@/lib/formato';
import { iconoDe } from '@/lib/iconos';
import { ESTADOS_COMPRA, type EstadoCompra, type ItemLista } from '@/lib/tipos';
import { quienFue } from '@/lib/miembros';

type Filtro = 'Todos' | EstadoCompra;

export default function DetalleLista() {
  return (
    <ConDatos>
      <VistaLista />
    </ConDatos>
  );
}

function VistaLista() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { estado, periodoId, guardarItem, reiniciarLista, avisar, abrirRegistro } = useDatos();
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [editando, setEditando] = useState<Partial<ItemLista> | null>(null);
  const [editandoLista, setEditandoLista] = useState(false);
  // Grupo en edición: nombre actual, o null para crear uno nuevo.
  const [grupo, setGrupo] = useState<{ abierta: boolean; nombre: string | null }>({ abierta: false, nombre: null });
  const lista = estado.listas.find(l => l.id === Number(id));

  if (!lista) {
    return (
      <>
        <EncabezadoPantalla titulo="Lista" izquierda={<BotonCircular etiqueta="Volver" href="/listas"><ChevronLeft /></BotonCircular>} />
        <Tarjeta className="mt-4">
          <Vacio icono={ShoppingBasket} titulo="Esta lista ya no existe" accion={<BotonPrimario href="/listas">Ver mis listas</BotonPrimario>} />
        </Tarjeta>
      </>
    );
  }

  const todos = estado.items.filter(i => i.lista_id === lista.id);
  const tot = totalesLista(todos);
  const tope = presupuestoLista(estado, lista, periodoId);
  const rubro = lista.rubro_id ? estado.rubros.find(r => r.id === lista.rubro_id) : undefined;
  const visibles = todos.filter(i => filtro === 'Todos' || i.estado === filtro);
  const categorias = [...new Set(todos.map(i => i.categoria))];
  const todasLasCategorias = [...new Set(estado.items.map(i => i.categoria))];
  const cuenta = (e: EstadoCompra) => todos.filter(i => i.estado === e).length;
  const nuevo = (categoria = categorias[0] ?? '') => setEditando({ categoria, cantidad: 1, precio: 0, estado: 'Pendiente' });
  // Lo comprado se registra como gasto real en la categoría del rubro vinculado (si lo hay).
  const categoriaGasto = rubro ? estado.categorias.find(c => c.id === rubro.categoria_id)?.nombre : undefined;
  const registrarCompra = () => abrirRegistro({ tipo: 'egreso', valor: Math.round(tot.comprado), descripcion: lista.nombre, categoria: categoriaGasto }, 'egreso');

  return (
    <>
      <EncabezadoPantalla
        izquierda={<BotonCircular etiqueta="Volver a las listas" href="/listas"><ChevronLeft /></BotonCircular>}
        titulo={lista.nombre}
        subtitulo={rubro ? <>Tope: <b className="font-semibold text-ink">{rubro.nombre}</b> del presupuesto</> : lista.presupuesto ? <>Tope fijo de <b className="font-semibold text-ink">{cop(lista.presupuesto)}</b></> : 'Sin tope de presupuesto'}
        derecha={<BotonCircular etiqueta="Editar lista" onClick={() => setEditandoLista(true)}><Pencil /></BotonCircular>}
      />

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-5">
          <section className="flex flex-col items-center gap-5 lg:rounded-3xl lg:bg-surface lg:p-6 lg:shadow-card">
            {rubro && <SelectorPeriodo />}
            <MontoHeroe centrado etiqueta="Total estimado de la lista" valor={tot.total}
              detalle={`${tot.cantidad} productos · ${tot.comprados} comprados`} />
            <BotonPrimario onClick={() => nuevo()} className="min-w-[220px]">
              <Plus strokeWidth={2.4} /> Agregar producto
            </BotonPrimario>
          </section>

          <Tarjeta titulo={tope > 0 ? 'Lista vs tope' : 'Avance de compras'} subtitulo={tope > 0 ? 'Margen = tope − total estimado de la lista' : undefined}>
            {tope > 0 && <BarraDividida usado={tot.total} total={tope} etiquetaUsado="Lista estimada" etiquetaDisponible="Margen" />}
            <div className={cx(tope > 0 && 'mt-5 border-t border-line pt-4')}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-muted">Comprado</span>
                <span><b className="font-semibold">{cop(tot.comprado)}</b> <span className="text-muted">de {cop(tot.total)}</span></span>
              </div>
              <Medidor className="mt-2" valor={tot.total ? tot.comprado / tot.total : 0} tono="pos" etiqueta="Avance de compras" />
              <div className="mt-4 flex flex-wrap gap-2">
                {tot.comprado > 0 && (
                  <PastillaSuave icono={ReceiptText} onClick={registrarCompra}>Registrar gasto de {cop(tot.comprado)}</PastillaSuave>
                )}
                <PastillaSuave icono={RotateCcw} tono="neutro" onClick={async () => {
                  if (!confirm('¿Marcar todos los productos como Pendiente para volver a comprar?')) return;
                  await reiniciarLista(lista.id).catch(() => {});
                  avisar('Lista reiniciada');
                }}>Reiniciar lista</PastillaSuave>
              </div>
            </div>
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          {todos.length > 0 && (
            <Segmentado
              etiqueta="Filtrar por estado"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { valor: 'Todos', etiqueta: 'Todos' },
                ...ESTADOS_COMPRA.map(e => ({ valor: e, etiqueta: cuenta(e) && e === 'Ajustar' ? `Ajustar ${cuenta(e)}` : e })),
              ]}
            />
          )}
          {visibles.length === 0 && (
            <Tarjeta>
              <Vacio icono={ShoppingBasket} titulo={todos.length === 0 ? 'La lista está vacía' : `Nada en "${filtro}"`}
                texto={todos.length === 0 ? 'Agrega los productos con cantidad y precio para saber cuánto vas a gastar.' : undefined}
                accion={todos.length === 0 ? <BotonPrimario onClick={() => nuevo()}><Plus /> Agregar producto</BotonPrimario> : undefined} />
            </Tarjeta>
          )}
          {categorias.map(cat => {
            const items = visibles.filter(i => i.categoria === cat);
            if (!items.length) return null;
            const Icono = iconoDe(cat);
            const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
            return (
              <Tarjeta key={cat}
                titulo={<span className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><Icono className="size-4" /></span>{cat || 'General'}</span>}
                accion={
                  <span className="flex items-center gap-1">
                    <span className="text-[14px] font-bold whitespace-nowrap tabular-nums">{cop(subtotal)}</span>
                    <button type="button" onClick={() => setGrupo({ abierta: true, nombre: cat })} aria-label={`Editar el grupo ${cat || 'General'}`}
                      className="foco -mr-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                      <Ellipsis className="size-5" />
                    </button>
                  </span>
                }>
                <ul className="flex flex-col divide-y divide-line">
                  {items.map(i => (
                    <li key={i.id} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        aria-label={i.estado === 'Comprado' ? `Marcar ${i.producto} como pendiente` : `Marcar ${i.producto} como comprado`}
                        aria-pressed={i.estado === 'Comprado'}
                        onClick={() => guardarItem({ id: i.id, estado: i.estado === 'Comprado' ? 'Pendiente' : 'Comprado' }).catch(() => {})}
                        className={cx(
                          'foco grid size-7 shrink-0 place-items-center rounded-full border-2 transition',
                          i.estado === 'Comprado' ? 'border-pos bg-pos text-white' : 'border-line hover:border-ink',
                        )}
                      >
                        {i.estado === 'Comprado' && <Check className="size-4" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cx('text-[14px] font-medium leading-snug', i.estado === 'Comprado' && 'text-muted line-through')}>{i.producto}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                          {String(i.cantidad).replace('.', ',')} × {cop(i.precio)}
                          {i.estado === 'Comprado' && quienFue(estado, i.editado_por) && <span>· lo compró {quienFue(estado, i.editado_por)}</span>}
                          {i.estado === 'Ajustar' && <Insignia tono="warn">Ajustar</Insignia>}
                        </p>
                      </div>
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums">{cop(i.cantidad * i.precio)}</span>
                      <button type="button" onClick={() => setEditando(i)} aria-label={`Editar ${i.producto}`}
                        className="foco grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                        <Ellipsis className="size-5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <PastillaSuave icono={Plus} tono="neutro" className="mt-3" onClick={() => nuevo(cat)}>Agregar producto</PastillaSuave>
              </Tarjeta>
            );
          })}
          {todos.length > 0 && (
            <button type="button" onClick={() => setGrupo({ abierta: true, nombre: null })}
              className="foco flex h-14 items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-[14px] font-semibold text-muted transition hover:border-ink hover:text-ink">
              <FolderPlus className="size-5" /> Nuevo grupo
            </button>
          )}
        </div>
      </div>

      <HojaGrupo
        listaId={lista.id}
        grupo={grupo.nombre}
        abierta={grupo.abierta}
        cantidad={grupo.nombre === null ? 0 : todos.filter(i => i.categoria === grupo.nombre).length}
        onCerrar={() => setGrupo(g => ({ ...g, abierta: false }))}
        onCreado={nombre => { setGrupo(g => ({ ...g, abierta: false })); nuevo(nombre); }}
      />
      <HojaItem item={editando} listaId={lista.id} categorias={todasLasCategorias} onCerrar={() => setEditando(null)} />
      <HojaLista lista={lista} abierta={editandoLista} onCerrar={() => setEditandoLista(false)} onBorrada={() => router.push('/listas')} />
    </>
  );
}
