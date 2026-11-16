'use client';
// Elegir varios meses del plan (rubros que solo aplican en algunos meses). Agrupados por año.
import { MESES } from '@/lib/meses';
import type { Periodo } from '@/lib/tipos';
import { cx } from './botones';

export function SelectorMeses({ periodos, seleccion, onCambio, etiqueta, sobreGris }: {
  periodos: Periodo[];
  seleccion: string[];
  onCambio: (ids: string[]) => void;
  etiqueta: string;
  /** El selector va dentro de una caja gris: los meses sin elegir van en blanco */
  sobreGris?: boolean;
}) {
  const anios = [...new Set(periodos.map(p => p.id.slice(0, 4)))];
  const alternar = (id: string) =>
    onCambio(seleccion.includes(id) ? seleccion.filter(x => x !== id) : [...seleccion, id].sort());

  return (
    <div role="group" aria-label={etiqueta} className="flex flex-col gap-2.5">
      {anios.map(a => (
        <div key={a}>
          <p className="mb-1.5 text-[11px] font-semibold text-muted">{a}</p>
          <div className="grid grid-cols-6 gap-1.5">
            {periodos.filter(p => p.id.startsWith(a)).map(p => {
              const on = seleccion.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={p.etiqueta}
                  onClick={() => alternar(p.id)}
                  className={cx(
                    'foco h-11 rounded-xl text-[13px] font-semibold transition active:scale-[0.96]',
                    on ? 'bg-accent-soft text-accent-strong ring-2 ring-accent' : sobreGris ? 'bg-surface text-ink-2' : 'bg-surface-2 text-ink-2',
                  )}
                >
                  {MESES[Number(p.id.slice(5, 7)) - 1]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
