'use client';
// Quién hizo qué en el hogar: lista de cambios con el nombre de cada persona.
import { ArrowLeftRight, ArrowRight, Calculator, CalendarRange, History, Landmark, Settings, ShoppingBasket, Target, Users, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cuando, diaDe, primerNombre } from '@/lib/miembros';
import type { Actividad, TipoActividad } from '@/lib/tipos';
import { Avatar } from './cuenta';
import { useDatos } from './proveedor';
import { PastillaSuave, cx } from './ui/botones';
import { Esqueleto, Tarjeta, Vacio } from './ui/estructura';

const ICONO: Record<TipoActividad, LucideIcon> = {
  movimiento: ArrowLeftRight, presupuesto: Calculator, deuda: Landmark, meta: Target,
  lista: ShoppingBasket, plan: CalendarRange, ajustes: Settings, miembros: Users,
};

/** Carga la actividad y la vuelve a pedir cada vez que cambian los datos (alguien guardó algo). */
export function useActividad(limite: number, usuario: string | null = null) {
  const { estado } = useDatos();
  const [lista, setLista] = useState<Actividad[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const pedido = useRef(0);

  const pedir = useCallback(async (antes?: number) => {
    const n = ++pedido.current;
    const q = new URLSearchParams({ limite: String(limite) });
    if (usuario) q.set('usuario', usuario);
    if (antes) q.set('antes', String(antes));
    setCargando(true);
    try {
      const r = await fetch(`/api/actividad?${q}`, { headers: { 'x-cuaderno': String(estado?.cuaderno?.id ?? '') } });
      if (!r.ok) throw new Error();
      const datos = (await r.json()) as Actividad[];
      if (n !== pedido.current) return;
      setLista(prev => (antes && prev ? [...prev, ...datos] : datos));
      setHayMas(datos.length === limite);
    } catch {
      if (n === pedido.current) setLista(prev => prev ?? []);
    } finally {
      if (n === pedido.current) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limite, usuario, estado?.cuaderno?.id]);

  // estado cambia con cada guardado: así la lista se mantiene al día
  useEffect(() => { pedir(); }, [pedir, estado]);

  return { lista, hayMas, cargando, masAntiguas: () => lista?.length && pedir(lista[lista.length - 1].id) };
}

export function FilaActividad({ a, conAvatar = true }: { a: Actividad; conAvatar?: boolean }) {
  const Icono = ICONO[a.tipo] ?? History;
  return (
    <li className="flex items-start gap-3 py-2.5">
      {conAvatar ? (
        <span className="relative shrink-0">
          <Avatar nombre={a.nombre} className="size-9 text-[12px]" />
          <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-surface text-ink-2 ring-2 ring-surface">
            <Icono className="size-3" />
          </span>
        </span>
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><Icono className="size-4" /></span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-ink-2">
          <b className="font-semibold text-ink">{primerNombre(a.nombre)}</b> {a.accion}
        </p>
        {a.detalle && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{a.detalle}</p>}
      </div>
      <time dateTime={a.fecha} className="shrink-0 pt-0.5 text-[11px] whitespace-nowrap text-muted">{cuando(a.fecha)}</time>
    </li>
  );
}

/** Inicio: los últimos cambios del hogar. */
export function ActividadReciente() {
  const { lista } = useActividad(5);
  return (
    <Tarjeta titulo="Actividad reciente" subtitulo="Quién registró o cambió qué"
      accion={<PastillaSuave icono={ArrowRight} href="/actividad">Ver todo</PastillaSuave>}>
      {!lista ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Esqueleto key={i} className="h-10" />)}</div>
      ) : lista.length ? (
        <ul className="flex flex-col divide-y divide-line">{lista.map(a => <FilaActividad key={a.id} a={a} />)}</ul>
      ) : (
        <p className="text-[13px] text-muted">Aún no hay cambios registrados. Desde ahora, cada movimiento y cambio queda con el nombre de quien lo hizo.</p>
      )}
    </Tarjeta>
  );
}

/** Pantalla completa: filtro por persona y agrupado por día. */
export function ListaActividad() {
  const { estado } = useDatos();
  const [usuario, setUsuario] = useState<string | null>(null);
  const { lista, hayMas, cargando, masAntiguas } = useActividad(50, usuario);
  const personas = estado.miembros;

  const grupos: { dia: string; items: Actividad[] }[] = [];
  for (const a of lista ?? []) {
    const dia = diaDe(a.fecha);
    if (grupos.at(-1)?.dia !== dia) grupos.push({ dia, items: [] });
    grupos.at(-1)!.items.push(a);
  }

  return (
    <div className="flex flex-col gap-4">
      {personas.length > 1 && (
        <div role="radiogroup" aria-label="Filtrar por persona" className="flex flex-wrap gap-1.5">
          {[{ usuario_id: null as string | null, nombre: 'Todos' }, ...personas].map(p => {
            const on = usuario === p.usuario_id;
            return (
              <button key={p.usuario_id ?? 'todos'} type="button" role="radio" aria-checked={on} onClick={() => setUsuario(p.usuario_id)}
                className={cx('foco inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-[0.97]',
                  on ? 'bg-accent-soft text-ink ring-2 ring-accent' : 'bg-surface text-ink-2 shadow-card hover:bg-surface-2')}>
                {p.usuario_id && <Avatar nombre={p.nombre} className="size-6 text-[10px]" />}
                {p.usuario_id ? primerNombre(p.nombre) : p.nombre}
              </button>
            );
          })}
        </div>
      )}

      {!lista ? (
        <Tarjeta><div className="flex flex-col gap-3">{[0, 1, 2, 3].map(i => <Esqueleto key={i} className="h-10" />)}</div></Tarjeta>
      ) : !lista.length ? (
        <Tarjeta>
          <Vacio icono={History} titulo="Sin actividad todavía" texto="Cada movimiento, compra y cambio en el plan quedará aquí con el nombre de quien lo hizo." />
        </Tarjeta>
      ) : (
        grupos.map(g => (
          <Tarjeta key={g.dia} titulo={g.dia}>
            <ul className="-mt-2 flex flex-col divide-y divide-line">{g.items.map(a => <FilaActividad key={a.id} a={a} />)}</ul>
          </Tarjeta>
        ))
      )}

      {hayMas && (
        <button type="button" onClick={() => masAntiguas()} disabled={cargando}
          className="foco mx-auto inline-flex h-11 items-center rounded-full px-4 text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50">
          {cargando ? 'Cargando…' : 'Ver cambios anteriores'}
        </button>
      )}
    </div>
  );
}
