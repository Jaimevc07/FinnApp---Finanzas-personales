// Piezas para mostrar dinero y progreso.
import { ArrowDownLeft, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { conSigno, cop, numero } from '@/lib/formato';
import { cx } from './botones';

/** El número protagonista de la pantalla. El "$" va más pequeño y arriba. */
export function MontoHeroe({
  etiqueta, valor, centrado, detalle, className,
}: { etiqueta: string; valor: number; centrado?: boolean; detalle?: ReactNode; className?: string }) {
  const negativo = Math.round(valor) < 0;
  return (
    <div className={cx(centrado && 'text-center', className)}>
      <p className="text-[13px] font-medium text-muted">{etiqueta}</p>
      <p
        className={cx(
          'mt-1 text-[40px] font-bold leading-none tracking-tight lg:text-[48px]',
          negativo ? 'text-neg-text' : 'text-ink',
        )}
      >
        {negativo && <span aria-hidden>{'−'}</span>}
        <span className="mr-1 align-top text-[0.6em] leading-[1.25]">$</span>
        {numero(valor)}
        <span className="sr-only">{negativo ? ' negativo' : ''}</span>
      </p>
      {detalle && <div className="mt-2 text-[13px] text-muted">{detalle}</div>}
    </div>
  );
}

/** Monto con signo y color de ingreso (+ verde) o egreso (− rojo). */
export function Monto({ valor, tipo, className }: { valor: number; tipo: 'ingreso' | 'egreso'; className?: string }) {
  return (
    <span className={cx('whitespace-nowrap font-semibold tabular-nums', tipo === 'ingreso' ? 'text-pos-text' : 'text-neg-text', className)}>
      {conSigno(valor, tipo)}
    </span>
  );
}

const TONOS = {
  neutro: 'text-ink',
  pos: 'text-pos-text',
  neg: 'text-neg-text',
  accent: 'text-accent-strong',
  warn: 'text-warn-text',
} as const;
export type Tono = keyof typeof TONOS;

/** KPI: etiqueta, valor y detalle. */
export function Estadistica({
  etiqueta, valor, detalle, tono = 'neutro', icono: Icono, className,
}: { etiqueta: string; valor: string; detalle?: ReactNode; tono?: Tono; icono?: LucideIcon; className?: string }) {
  return (
    <div className={cx('min-w-0 rounded-3xl bg-surface p-4 shadow-card lg:p-5', className)}>
      <div className="flex items-center gap-2">
        {Icono && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
            <Icono className="size-[15px]" strokeWidth={2} />
          </span>
        )}
        <p className="line-clamp-2 text-[12px] font-medium leading-tight text-muted">{etiqueta}</p>
      </div>
      <p className={cx('mt-2.5 truncate text-[20px] font-bold tracking-tight lg:text-[22px]', TONOS[tono])}>{valor}</p>
      {detalle && <div className="mt-1 text-[12px] leading-snug text-muted">{detalle}</div>}
    </div>
  );
}

/** Barra gastado / disponible con leyenda de puntos (bloque inferior de la referencia). */
export function BarraDividida({
  usado, total, etiquetaUsado = 'Gastado', etiquetaDisponible = 'Disponible',
}: { usado: number; total: number; etiquetaUsado?: string; etiquetaDisponible?: string }) {
  const excedido = usado > total;
  const p = total > 0 ? Math.min(100, (usado / total) * 100) : usado > 0 ? 100 : 0;
  const disponible = total - usado;
  return (
    <div>
      <div
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
        aria-valuenow={usado}
        aria-label={`${etiquetaUsado} ${cop(usado)} de ${cop(total)}`}
      >
        {p > 0 && <div className={cx('h-full rounded-full', excedido ? 'bg-neg' : 'bg-ink')} style={{ width: `${p}%` }} />}
        {p < 100 && <div className="h-full flex-1 rounded-full bg-accent/45" />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className={cx('size-2 rounded-full', excedido ? 'bg-neg' : 'bg-ink')} />
            {etiquetaUsado}
          </p>
          <p className="mt-1 text-[16px] font-bold tracking-tight">{cop(usado)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="size-2 rounded-full bg-accent/60" />
            {excedido ? 'Excedido' : etiquetaDisponible}
          </p>
          <p className={cx('mt-1 text-[16px] font-bold tracking-tight', excedido && 'text-neg-text')}>{cop(disponible)}</p>
        </div>
      </div>
    </div>
  );
}

/** Medidor de progreso simple (8 px). */
export function Medidor({ valor, tono = 'accent', className, etiqueta }: { valor: number; tono?: 'accent' | 'pos' | 'neg' | 'ink'; className?: string; etiqueta: string }) {
  const p = Math.max(0, Math.min(1, valor)) * 100;
  const fondo = { accent: 'bg-accent', pos: 'bg-pos', neg: 'bg-neg', ink: 'bg-ink' }[tono];
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} aria-label={etiqueta}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-300', fondo)} style={{ width: `${p}%` }} />
    </div>
  );
}

const TONOS_INSIGNIA = {
  neutro: 'bg-surface-2 text-ink-2',
  pos: 'bg-pos-soft text-pos-text',
  neg: 'bg-neg-soft text-neg-text',
  accent: 'bg-accent-soft text-accent-strong',
  warn: 'bg-warn-soft text-warn-text',
} as const;

/** Etiqueta pequeña tipo "Me" de la referencia. */
export function Insignia({ children, tono = 'neutro', className }: { children: ReactNode; tono?: keyof typeof TONOS_INSIGNIA; className?: string }) {
  return (
    <span className={cx('inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold', TONOS_INSIGNIA[tono], className)}>
      {children}
    </span>
  );
}

/** Ítem de lista de movimientos: tile con ícono, textos y monto con signo. */
export function FilaMovimiento({
  titulo, subtitulo, valor, tipo, icono: Icono, onClick,
}: { titulo: string; subtitulo?: string; valor: number; tipo: 'ingreso' | 'egreso'; icono?: LucideIcon; onClick?: () => void }) {
  const IconoFinal = Icono ?? (tipo === 'ingreso' ? ArrowDownLeft : ArrowUpRight);
  return (
    <button
      type="button"
      onClick={onClick}
      className="foco flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-surface-2"
    >
      <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', tipo === 'ingreso' ? 'bg-pos-soft text-pos-text' : 'bg-surface-2 text-ink-2')}>
        <IconoFinal className="size-5" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{titulo}</span>
        {subtitulo && <span className="block truncate text-[12px] text-muted">{subtitulo}</span>}
      </span>
      <Monto valor={valor} tipo={tipo} className="text-[14px]" />
    </button>
  );
}
