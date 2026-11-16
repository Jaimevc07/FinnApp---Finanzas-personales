// Botones del sistema diseno-fin-tech.
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BaseProps = { href?: string; className?: string; children?: ReactNode } & Omit<ComponentProps<'button'>, 'className' | 'children'>;

/** Renderiza un Link si hay href; si no, un botón. */
function Pulsable({ href, className, children, ...rest }: BaseProps) {
  if (href) {
    return (
      <Link href={href} className={className} aria-label={rest['aria-label']} title={rest.title}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} {...rest}>
      {children}
    </button>
  );
}

/** Ícono circular de 40 px para el encabezado (atrás, historial, ajustes). */
export function BotonCircular({ etiqueta, className, children, ...rest }: BaseProps & { etiqueta: string }) {
  return (
    <Pulsable
      aria-label={etiqueta}
      title={etiqueta}
      className={cx(
        'foco grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink',
        'transition hover:bg-surface-2 active:scale-[0.96] [&_svg]:size-[18px]',
        className,
      )}
      {...rest}
    >
      {children}
    </Pulsable>
  );
}

/** Acción rápida: círculo de 56 px con la etiqueta debajo (fila de 3–4). */
export function AccionCircular({ etiqueta, icono: Icono, className, ...rest }: BaseProps & { etiqueta: string; icono: LucideIcon }) {
  return (
    <Pulsable className={cx('foco group flex w-[76px] flex-col items-center gap-2 rounded-2xl text-center', className)} {...rest}>
      <span className="grid size-14 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition group-hover:bg-surface-2 group-active:scale-[0.96]">
        <Icono className="size-[22px]" strokeWidth={1.8} />
      </span>
      <span className="text-[12px] font-semibold leading-tight text-ink-2">{etiqueta}</span>
    </Pulsable>
  );
}

const botonBase =
  'foco inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px]';

/** Acción principal de la vista: negro con texto blanco (como "Add to Apple Wallet"). */
export function BotonPrimario({ className, ...rest }: BaseProps) {
  return <Pulsable className={cx(botonBase, 'bg-ink text-on-ink hover:opacity-90', className)} {...rest} />;
}

/** Confirmación en hojas y formularios: naranja profundo con texto blanco (oscuro: naranja claro con texto oscuro). */
export function BotonAcento({ className, ...rest }: BaseProps) {
  return <Pulsable className={cx(botonBase, 'bg-accent-fill font-bold text-accent-ink hover:bg-accent-fill-hover', className)} {...rest} />;
}

/** Botón neutro (cancelar, acciones secundarias). */
export function BotonSecundario({ className, ...rest }: BaseProps) {
  return <Pulsable className={cx(botonBase, 'bg-surface-2 text-ink hover:bg-surface-3', className)} {...rest} />;
}

const TONOS_PASTILLA = {
  accent: 'bg-accent-soft text-accent-strong',
  pos: 'bg-pos-soft text-pos-text',
  neg: 'bg-neg-soft text-neg-text',
  neutro: 'bg-surface-2 text-ink',
} as const;

/** Acción secundaria con ícono sobre fondo suave (como "Edit limit"). */
export function PastillaSuave({
  icono: Icono, tono = 'accent', className, children, ...rest
}: BaseProps & { icono?: LucideIcon; tono?: keyof typeof TONOS_PASTILLA }) {
  return (
    <Pulsable
      className={cx(
        'foco inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition hover:brightness-95 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        TONOS_PASTILLA[tono],
        className,
      )}
      {...rest}
    >
      {Icono && <Icono className="size-4" strokeWidth={2} />}
      {children}
    </Pulsable>
  );
}
