// Marca de la app: tres barras ascendentes, la última en naranja.
import { cx } from './botones';

export function Marca({ className, claro }: { className?: string; claro?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('size-6', className)} aria-hidden>
      <rect x="3" y="12.5" width="4.4" height="8.5" rx="1.3" fill={claro ? '#5a5a60' : 'var(--ink-2)'} opacity={claro ? 1 : 0.55} />
      <rect x="9.8" y="8" width="4.4" height="13" rx="1.3" fill={claro ? '#8a8a91' : 'var(--ink-2)'} opacity={claro ? 1 : 0.8} />
      <rect x="16.6" y="3" width="4.4" height="18" rx="1.3" fill="var(--accent)" />
    </svg>
  );
}
