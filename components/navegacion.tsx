'use client';
// Barra lateral (escritorio) y barra inferior con FAB (móvil).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, BookOpen, Calculator, ChevronsUpDown, Eye, House, Plus, RefreshCw, Settings, ShoppingBasket, Target, type LucideIcon } from 'lucide-react';
import { useFinanzas } from './proveedor';
import { cx } from './ui/botones';
import { Marca } from './ui/marca';

type Destino = { href: string; etiqueta: string; corta: string; icono: LucideIcon };

export const DESTINOS: Destino[] = [
  { href: '/', etiqueta: 'Inicio', corta: 'Inicio', icono: House },
  { href: '/presupuesto', etiqueta: 'Presupuesto', corta: 'Presupuesto', icono: Calculator },
  { href: '/movimientos', etiqueta: 'Movimientos', corta: 'Movimientos', icono: ArrowLeftRight },
  { href: '/plan', etiqueta: 'Deudas y metas', corta: 'Plan', icono: Target },
  { href: '/listas', etiqueta: 'Listas de compras', corta: 'Listas', icono: ShoppingBasket },
  { href: '/ajustes', etiqueta: 'Ajustes', corta: 'Ajustes', icono: Settings },
];

const activo = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function EstadoConexion({ className }: { className?: string }) {
  const { conexion } = useFinanzas();
  const [txt, color] =
    conexion === 'sin-conexion' ? ['Sin conexión', 'bg-neg'] : conexion === 'guardando' ? ['Guardando…', 'bg-warn'] : ['Guardado', 'bg-pos'];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[12px] text-muted', className)} role="status" aria-live="polite">
      <span className={cx('size-2 rounded-full', color)} />
      {txt}
    </span>
  );
}

export function BarraLateral() {
  const path = usePathname();
  const { estado, abrirRegistro, puedeEditar, refrescar, refrescando } = useFinanzas();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <Link href="/" className="foco flex items-center gap-2.5 rounded-2xl px-2">
        <span className="grid size-10 place-items-center rounded-2xl bg-ink">
          <Marca className="size-6" claro />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold tracking-tight">Finanzas Hogar</span>
        </span>
      </Link>

      {/* Cuaderno actual: lleva a la pre-vista para cambiar de cuaderno */}
      <Link href="/cuadernos" className="foco mt-5 flex items-center gap-2.5 rounded-2xl bg-surface-2 px-3 py-2.5 transition hover:bg-surface-3"
        aria-label={`Cuaderno: ${estado?.cuaderno?.nombre ?? '…'}. Cambiar de cuaderno`}>
        <BookOpen className="size-[18px] shrink-0 text-accent-strong" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-muted">Cuaderno</span>
          <span className="block truncate text-[13px] font-semibold">{estado?.cuaderno?.nombre ?? estado?.config.hogar ?? '…'}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </Link>

      {puedeEditar ? (
        <button
          type="button"
          onClick={() => abrirRegistro()}
          className="foco mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent-fill text-[14px] font-bold text-accent-ink transition hover:bg-accent-fill-hover active:scale-[0.98]"
        >
          <Plus className="size-[18px]" strokeWidth={2.4} /> Registrar movimiento
        </button>
      ) : estado && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-line px-3 py-2.5 text-[12px] font-semibold text-ink-2">
          <Eye className="size-4" /> Solo lectura
        </p>
      )}

      <nav className="mt-6 flex flex-col gap-1" aria-label="Principal">
        {DESTINOS.map(d => {
          const on = activo(path, d.href);
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'foco flex h-11 items-center gap-3 rounded-2xl px-3 text-[14px] font-semibold transition',
                // Seleccionado: naranja suave (nunca un bloque negro junto al botón naranja)
                on ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-surface-2',
              )}
            >
              <d.icono className={cx('size-[19px]', on && 'text-accent-strong')} strokeWidth={on ? 2.2 : 1.8} />
              {d.etiqueta}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center justify-between gap-2 px-2">
        <EstadoConexion />
        <button type="button" onClick={() => refrescar()} disabled={refrescando} title="Traer los cambios de las demás personas"
          className="foco inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-60">
          <RefreshCw className={cx('size-3.5', refrescando && 'animate-spin text-accent-strong')} /> {refrescando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
    </aside>
  );
}

const MOVIL = [DESTINOS[0], DESTINOS[1], null, DESTINOS[2], DESTINOS[3]];

export function NavegacionInferior() {
  const path = usePathname();
  const { abrirRegistro, puedeEditar, estado } = useFinanzas();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-[480px] grid-cols-5 items-center px-2">
        {MOVIL.map((d, i) =>
          d ? (
            <li key={d.href} className="flex justify-center">
              <Link
                href={d.href}
                aria-current={activo(path, d.href) ? 'page' : undefined}
                className={cx(
                  'foco relative flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[10.5px] font-semibold',
                  activo(path, d.href) ? 'text-ink' : 'text-muted',
                )}
              >
                <d.icono className="size-[22px]" strokeWidth={activo(path, d.href) ? 2.2 : 1.8} />
                {d.corta}
                {activo(path, d.href) && <span className="absolute -top-1 size-1 rounded-full bg-accent" aria-hidden />}
              </Link>
            </li>
          ) : (
            <li key={i} className="flex justify-center">
              {!puedeEditar && estado ? (
                <span className="flex flex-col items-center gap-0.5 text-[10.5px] font-semibold text-muted" title="Este cuaderno es de solo lectura para ti">
                  <Eye className="size-[22px]" strokeWidth={1.8} /> Solo ver
                </span>
              ) : (
              <button
                type="button"
                onClick={() => abrirRegistro()}
                aria-label="Registrar movimiento"
                className="foco -mt-7 grid size-14 place-items-center rounded-full bg-accent-fill text-accent-ink shadow-fin ring-4 ring-bg transition active:scale-95"
              >
                <Plus className="size-7" strokeWidth={2.4} />
              </button>
              )}
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
