'use client';
// Formularios de listas de compras y de sus productos.
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDatos } from './proveedor';
import { BotonAcento, BotonSecundario } from './ui/botones';
import { Campo, Entrada, EntradaDinero, Selector } from './ui/campos';
import { Hoja } from './ui/hoja';
import { Segmentado } from './ui/segmentado';
import { SelectorIcono } from './ui/selector-icono';
import { cop } from '@/lib/formato';
import { ESTADOS_COMPRA, type ItemLista, type Lista } from '@/lib/tipos';
import { quienFue } from '@/lib/miembros';

type ModoPresupuesto = 'ninguno' | 'fijo' | 'rubro';

/** Crear o editar una lista. Al crear, devuelve el control con onCreada para navegar a ella. */
export function HojaLista({ lista, abierta, onCerrar, onBorrada }: {
  lista: Lista | null; abierta: boolean; onCerrar: () => void; onBorrada?: () => void;
}) {
  const { estado, guardarLista, borrarLista, avisar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [modo, setModo] = useState<ModoPresupuesto>('ninguno');
  const [monto, setMonto] = useState(0);
  const [rubroId, setRubroId] = useState<number | ''>('');
  const [icono, setIcono] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta) return;
    setNombre(lista?.nombre ?? '');
    setIcono(lista?.icono ?? null);
    setModo(lista?.rubro_id ? 'rubro' : lista?.presupuesto ? 'fijo' : 'ninguno');
    setMonto(lista?.presupuesto ?? 0);
    setRubroId(lista?.rubro_id ?? '');
  }, [abierta, lista]);

  // Rubros de gasto agrupados por categoría (para vincular el presupuesto de la lista)
  const grupos = estado.categorias
    .filter(c => c.seccion === 'operativo' || c.seccion === 'evento')
    .map(c => ({ c, rubros: estado.rubros.filter(r => r.categoria_id === c.id) }))
    .filter(g => g.rubros.length);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nombre.trim()) return avisar('Escribe el nombre de la lista');
    if (modo === 'rubro' && !rubroId) return avisar('Elige el rubro del presupuesto');
    try {
      await guardarLista({
        id: lista?.id,
        nombre: nombre.trim(),
        rubro_id: modo === 'rubro' ? Number(rubroId) : null,
        presupuesto: modo === 'fijo' ? monto : 0,
        icono,
      });
      avisar(lista ? 'Lista actualizada' : 'Lista creada');
      onCerrar();
    } catch { /* aviso ya mostrado */ }
  }

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={lista ? 'Editar lista' : 'Nueva lista'}
      subtitulo="Ej: Mercado del mes, Droguería, Cumpleaños de María"
      pie={
        <div className="flex gap-2">
          {lista && (
            <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar lista" onClick={async () => {
              if (!confirm(`¿Eliminar la lista "${lista.nombre}" y todos sus productos?`)) return;
              await borrarLista(lista.id).catch(() => {});
              avisar('Lista eliminada');
              onCerrar();
              onBorrada?.();
            }}><Trash2 /></BotonSecundario>
          )}
          <BotonAcento type="submit" form="form-lista" className="flex-1">{lista ? 'Guardar' : 'Crear lista'}</BotonAcento>
        </div>
      }
    >
      <form id="form-lista" onSubmit={guardar} className="flex flex-col gap-4">
        <Campo etiqueta="Nombre" htmlFor="l-nombre">
          <Entrada id="l-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} autoFocus={!lista} />
        </Campo>
        <SelectorIcono valor={icono} onCambio={setIcono} nombre={nombre} respaldo="list-checks" />
        <Campo etiqueta="Presupuesto de la lista">
          <Segmentado etiqueta="Presupuesto" valor={modo} onChange={setModo} opciones={[
            { valor: 'ninguno', etiqueta: 'Sin tope' },
            { valor: 'fijo', etiqueta: 'Monto fijo' },
            { valor: 'rubro', etiqueta: 'Del presupuesto' },
          ]} />
        </Campo>
        {modo === 'fijo' && (
          <Campo etiqueta="Monto máximo" htmlFor="l-monto">
            <EntradaDinero id="l-monto" valor={monto} onValor={setMonto} />
          </Campo>
        )}
        {modo === 'rubro' && (
          <Campo etiqueta="Rubro del presupuesto" htmlFor="l-rubro" ayuda="El tope será el valor de ese rubro en el mes que estés viendo.">
            <Selector id="l-rubro" value={rubroId} onChange={e => setRubroId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Elige un rubro…</option>
              {grupos.map(g => (
                <optgroup key={g.c.id} label={g.c.nombre}>
                  {g.rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </optgroup>
              ))}
            </Selector>
          </Campo>
        )}
      </form>
    </Hoja>
  );
}

/**
 * Renombrar o borrar un grupo de productos ("Proteínas y Lácteos"), o crear uno nuevo.
 * Un grupo no existe sin productos: al crearlo se sigue con el primer producto (onCreado).
 */
export function HojaGrupo({ listaId, grupo, abierta, cantidad, onCerrar, onCreado }: {
  listaId: number;
  /** Nombre actual; nulo = grupo nuevo */
  grupo: string | null;
  abierta: boolean;
  cantidad: number;
  onCerrar: () => void;
  onCreado: (nombre: string) => void;
}) {
  const { renombrarGrupo, borrarGrupo, avisar } = useDatos();
  const [nombre, setNombre] = useState('');
  useEffect(() => { if (abierta) setNombre(grupo ?? ''); }, [abierta, grupo]);
  const nuevo = grupo === null;
  const visible = (g: string) => g || 'General';

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return avisar('Escribe el nombre del grupo');
    if (nuevo) { onCreado(n); return; }
    if (n === grupo) { onCerrar(); return; }
    try {
      await renombrarGrupo(listaId, grupo, n);
      avisar(`"${visible(grupo)}" ahora se llama "${n}"`);
      onCerrar();
    } catch { /* aviso ya mostrado */ }
  }

  return (
    <Hoja
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={nuevo ? 'Nuevo grupo' : 'Editar grupo'}
      subtitulo={nuevo ? 'Ej: Frutas, Aseo, Mascotas. Luego agregas sus productos.' : `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'} en este grupo`}
      pie={
        <div className="flex gap-2">
          {!nuevo && (
            <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar grupo" onClick={async () => {
              if (!confirm(`¿Eliminar el grupo "${visible(grupo)}" y sus ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}?`)) return;
              try {
                await borrarGrupo(listaId, grupo);
                avisar('Grupo eliminado');
                onCerrar();
              } catch { /* aviso ya mostrado */ }
            }}><Trash2 /></BotonSecundario>
          )}
          <BotonAcento type="submit" form="form-grupo" className="flex-1">{nuevo ? 'Continuar' : 'Guardar'}</BotonAcento>
        </div>
      }
    >
      <form id="form-grupo" onSubmit={guardar} className="flex flex-col gap-4">
        <Campo etiqueta="Nombre del grupo" htmlFor="g-nombre"
          ayuda={nuevo ? undefined : 'Si ya existe otro grupo con ese nombre, sus productos se unen.'}>
          <Entrada id="g-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} autoFocus placeholder="Ej: Lácteos" />
        </Campo>
      </form>
    </Hoja>
  );
}

/** Crear o editar un producto de una lista. */
export function HojaItem({ item, listaId, categorias, onCerrar }: {
  item: Partial<ItemLista> | null; listaId: number; categorias: string[]; onCerrar: () => void;
}) {
  const { estado, guardarItem, borrarItem, avisar } = useDatos();
  const [f, setF] = useState<Partial<ItemLista>>({});
  const [cantidadTxt, setCantidadTxt] = useState('1');
  useEffect(() => {
    if (item) { setF(item); setCantidadTxt(String(item.cantidad ?? 1).replace('.', ',')); }
  }, [item]);
  const nuevo = !item?.id;

  return (
    <Hoja
      abierta={!!item}
      onCerrar={onCerrar}
      titulo={nuevo ? 'Agregar producto' : 'Editar producto'}
      subtitulo={`Subtotal: ${cop((f.cantidad ?? 0) * (f.precio ?? 0))}`}
      pie={
        <div className="flex gap-2">
          {!nuevo && (
            <BotonSecundario className="px-4 text-neg-text" aria-label="Eliminar producto" onClick={async () => {
              if (!item?.id || !confirm(`¿Eliminar "${item.producto}"?`)) return;
              await borrarItem(item.id).catch(() => {});
              onCerrar();
            }}><Trash2 /></BotonSecundario>
          )}
          <BotonAcento className="flex-1" type="submit" form="form-item">{nuevo ? 'Agregar' : 'Guardar'}</BotonAcento>
        </div>
      }
    >
      <form id="form-item" className="flex flex-col gap-4" onSubmit={async e => {
        e.preventDefault();
        if (!f.producto?.trim()) return avisar('Escribe el nombre del producto');
        try {
          await guardarItem({
            id: f.id, lista_id: listaId, producto: f.producto.trim(), categoria: f.categoria?.trim() || 'General',
            cantidad: f.cantidad ?? 1, precio: f.precio ?? 0, estado: f.estado ?? 'Pendiente',
          });
        } catch { return; /* aviso ya mostrado */ }
        if (nuevo) {
          // Deja el formulario listo para el siguiente producto de la misma categoría
          setF({ categoria: f.categoria, cantidad: 1, precio: 0, estado: 'Pendiente' });
          setCantidadTxt('1');
          avisar(`"${f.producto.trim()}" agregado`);
        } else {
          onCerrar();
        }
      }}>
        <Campo etiqueta="Producto" htmlFor="it-prod">
          <Entrada id="it-prod" value={f.producto ?? ''} onChange={e => setF({ ...f, producto: e.target.value })} placeholder="Ej: Arroz 5 kg" autoFocus={nuevo} />
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="it-cat" ayuda="Escribe una nueva o elige una existente">
          <Entrada id="it-cat" list="cats-lista" value={f.categoria ?? ''} onChange={e => setF({ ...f, categoria: e.target.value })} placeholder="Ej: Despensa" />
          <datalist id="cats-lista">{categorias.map(c => <option key={c} value={c} />)}</datalist>
        </Campo>
        <div className="grid grid-cols-[1fr_1.6fr] gap-3">
          <Campo etiqueta="Cantidad" htmlFor="it-cant">
            <Entrada id="it-cant" inputMode="decimal" value={cantidadTxt} className="text-right tabular-nums"
              onChange={e => { setCantidadTxt(e.target.value); setF({ ...f, cantidad: Number(e.target.value.replace(',', '.')) || 0 }); }} />
          </Campo>
          <Campo etiqueta="Precio unitario" htmlFor="it-precio">
            <EntradaDinero id="it-precio" valor={f.precio ?? 0} onValor={v => setF({ ...f, precio: v })} />
          </Campo>
        </div>
        {!nuevo && (
          <Campo etiqueta="Estado">
            <Segmentado etiqueta="Estado de compra" valor={f.estado ?? 'Pendiente'} onChange={v => setF({ ...f, estado: v })}
              opciones={ESTADOS_COMPRA.map(e => ({ valor: e, etiqueta: e }))} />
          </Campo>
        )}
        {!nuevo && (quienFue(estado, item?.creado_por) || quienFue(estado, item?.editado_por)) && (
          <p className="text-[12px] text-muted">
            {quienFue(estado, item?.creado_por) && <>Lo agregó <b className="font-semibold text-ink-2">{quienFue(estado, item?.creado_por)}</b></>}
            {quienFue(estado, item?.creado_por) && quienFue(estado, item?.editado_por) && ' · '}
            {quienFue(estado, item?.editado_por) && <>último cambio de <b className="font-semibold text-ink-2">{quienFue(estado, item?.editado_por)}</b></>}
          </p>
        )}
      </form>
    </Hoja>
  );
}
