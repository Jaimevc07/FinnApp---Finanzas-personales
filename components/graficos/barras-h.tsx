// Barras horizontales ordenadas: partes de un todo con muchas categorías (en vez de un donut).
import type { ReactNode } from 'react';
import { cop, pct } from '@/lib/formato';
import { cx } from '../ui/botones';

export type FilaBarra = { id: string | number; nombre: string; valor: number; extra?: ReactNode; tope?: number };

export function BarrasHorizontales({ filas, total, mostrarPct = true }: { filas: FilaBarra[]; total: number; mostrarPct?: boolean }) {
  const max = Math.max(1, ...filas.map(f => Math.max(f.valor, f.tope ?? 0)));
  return (
    <ul className="flex flex-col gap-4">
      {filas.map(f => {
        const excede = f.tope !== undefined && f.valor > f.tope;
        return (
          <li key={f.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] font-medium">{f.nombre}</span>
                {f.extra}
              </span>
              <span className="shrink-0 text-[13px] tabular-nums">
                <b className="font-semibold">{cop(f.valor)}</b>
                {mostrarPct && <span className="ml-1.5 text-muted">{pct(f.valor, total)}</span>}
              </span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-surface-2">
              <div
                className={cx('h-full rounded-full', excede ? 'bg-neg' : 'bg-ink')}
                style={{ width: `${Math.min(100, (f.valor / max) * 100)}%` }}
              />
              {f.tope !== undefined && f.tope > 0 && (
                <span
                  className="absolute -top-1 h-4 w-0.5 rounded-full bg-accent"
                  style={{ left: `calc(${Math.min(100, (f.tope / max) * 100)}% - 1px)` }}
                  title={`Presupuesto ${cop(f.tope)}`}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
