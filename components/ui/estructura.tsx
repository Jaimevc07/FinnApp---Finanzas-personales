// Estructura de pantalla: encabezado, tarjetas y estados vacíos.
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './botones';

/** Encabezado de cada vista: botón izquierdo, título + subtítulo y botones a la derecha. */
export function EncabezadoPantalla({
  titulo, subtitulo, izquierda, derecha, className,
}: { titulo: string; subtitulo?: ReactNode; izquierda?: ReactNode; derecha?: ReactNode; className?: string }) {
  return (
    <header className={cx('flex items-center gap-3 pt-[max(env(safe-area-inset-top),16px)] pb-2 lg:pt-8', className)}>
      {izquierda}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[18px] font-semibold leading-tight tracking-tight lg:text-[22px]">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 truncate text-[12px] text-muted lg:text-[13px]">{subtitulo}</p>}
      </div>
      {derecha && <div className="flex shrink-0 items-center gap-2">{derecha}</div>}
    </header>
  );
}

/** Contenedor blanco estándar. */
export function Tarjeta({
  titulo, subtitulo, accion, children, className, sinPadding,
}: {
  titulo?: ReactNode; subtitulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string; sinPadding?: boolean;
}) {
  return (
    <section className={cx('min-w-0 rounded-3xl bg-surface shadow-card', !sinPadding && 'p-5 lg:p-6', className)}>
      {(titulo || accion) && (
        <div className={cx('mb-4 flex items-start justify-between gap-3', sinPadding && 'px-5 pt-5 lg:px-6 lg:pt-6')}>
          <div className="min-w-0">
            {titulo && <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-[12px] text-muted">{subtitulo}</p>}
          </div>
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

/** Estado vacío: ícono suave, una frase y la acción para resolverlo. */
export function Vacio({ icono: Icono, titulo, texto, accion }: { icono: LucideIcon; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Icono className="size-[22px]" strokeWidth={1.8} />
      </span>
      <p className="text-[14px] font-semibold">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-[13px] text-muted">{texto}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/** Esqueleto de carga con la forma del contenido. */
export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-3xl bg-surface-2', className)} />;
}
