'use client';
// Pastilla centrada con el mes seleccionado + flechas. Al tocarla abre la grilla de meses.
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { delta } from '@/lib/formato';
import { diaSueldo } from '@/lib/meses';
import { useDatos } from './proveedor';
import { cx } from './ui/botones';
import { Hoja } from './ui/hoja';
import { Insignia } from './ui/datos';

export function SelectorPeriodo({ className }: { className?: string }) {
  const { estado, periodoId, setPeriodoId, filas } = useDatos();
  const [abierto, setAbierto] = useState(false);
  const idx = estado.periodos.findIndex(p => p.id === periodoId);
  const p = estado.periodos[idx];
  const mover = (d: number) => {
    const n = estado.periodos[idx + d];
    if (n) setPeriodoId(n.id);
  };
  const anios = [...new Set(estado.periodos.map(x => x.id.slice(0, 4)))];

  return (
    <div className={cx('flex items-center justify-center gap-2', className)}>
      <button type="button" onClick={() => mover(-1)} disabled={idx <= 0} aria-label="Mes anterior"
        className="foco grid size-9 place-items-center rounded-full text-ink-2 transition hover:bg-surface disabled:opacity-30">
        <ChevronLeft className="size-[18px]" />
      </button>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="foco inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-line bg-surface pr-2 pl-1.5 shadow-card transition hover:bg-surface-2"
        aria-haspopup="dialog"
      >
        <span className="grid size-7 place-items-center rounded-full bg-ink text-on-ink">
          <CalendarDays className="size-[14px]" />
        </span>
        <span className="truncate text-[13px] font-semibold">{p?.etiqueta ?? '—'}</span>
        {p && <Insignia tono="pos" className="hidden min-[380px]:inline-flex">Sueldo {diaSueldo(p.cobro)}</Insignia>}
        <ChevronDown className="size-4 text-muted" />
      </button>
      <button type="button" onClick={() => mover(1)} disabled={idx >= estado.periodos.length - 1} aria-label="Mes siguiente"
        className="foco grid size-9 place-items-center rounded-full text-ink-2 transition hover:bg-surface disabled:opacity-30">
        <ChevronRight className="size-[18px]" />
      </button>

      <Hoja siempreActiva abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Elegir mes" subtitulo="Cada mes se cubre con el sueldo del mes anterior (el del día 30).">
        {anios.map(a => (
          <div key={a} className="mb-4">
            <p className="mb-2 text-[12px] font-semibold text-muted">{a}</p>
            <div className="grid grid-cols-3 gap-2">
              {estado.periodos.filter(x => x.id.startsWith(a)).map(x => {
                const f = filas.find(y => y.periodo.id === x.id);
                const sel = x.id === periodoId;
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => { setPeriodoId(x.id); setAbierto(false); }}
                    aria-pressed={sel}
                    className={cx(
                      'foco rounded-2xl border p-3 text-left transition',
                      sel ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2',
                    )}
                  >
                    <span className="block text-[14px] font-semibold">{x.etiqueta.slice(0, 3)}</span>
                    <span className={cx('block text-[11px]', sel ? 'text-accent-strong' : 'text-muted')}>Sueldo {diaSueldo(x.cobro)}</span>
                    {f && (
                      <span className={cx('mt-1 block text-[11px] font-semibold tabular-nums', f.flujo < 0 ? 'text-neg-text' : 'text-ink-2')}>
                        {delta(f.flujo)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="pb-2 text-[12px] text-muted">El valor bajo cada mes es lo que sobra (o falta): lo que entra menos lo que sale.</p>
      </Hoja>
    </div>
  );
}
