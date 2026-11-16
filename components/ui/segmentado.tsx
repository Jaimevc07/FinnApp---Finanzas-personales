'use client';
// Control segmentado: fondo surface-2, opción activa en surface con sombra.
import { cx } from './botones';

export type OpcionSegmentado<T extends string> = { valor: T; etiqueta: string; tono?: 'pos' | 'neg' };

export function Segmentado<T extends string>({
  opciones, valor, onChange, etiqueta, className,
}: { opciones: OpcionSegmentado<T>[]; valor: T; onChange: (v: T) => void; etiqueta: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cx('flex rounded-2xl bg-surface-2 p-1', className)}>
      {opciones.map(o => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(o.valor)}
            className={cx(
              'foco h-9 min-w-0 flex-1 truncate rounded-xl px-2 text-[13px] font-semibold transition',
              activo ? 'bg-surface shadow-card' : 'text-muted hover:text-ink',
              activo && (o.tono === 'pos' ? 'text-pos-text' : o.tono === 'neg' ? 'text-neg-text' : 'text-ink'),
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
