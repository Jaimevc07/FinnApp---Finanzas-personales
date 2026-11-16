'use client';
// Selector de ícono dentro de una hoja: muestra el actual y despliega el catálogo agrupado.
import { Package, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { claveIcono, GRUPOS_ICONOS, opcionIcono } from '@/lib/iconos';
import { PastillaSuave, cx } from './botones';

export function SelectorIcono({ valor, onCambio, nombre, respaldo, etiqueta = 'Ícono' }: {
  /** Clave elegida; nulo = automático según el nombre */
  valor: string | null;
  onCambio: (clave: string | null) => void;
  /** Nombre del elemento, para sugerir el ícono automático */
  nombre: string;
  /** Ícono cuando el nombre no sugiere ninguno */
  respaldo: string;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = opcionIcono(claveIcono(valor, nombre, respaldo));
  const Icono = actual?.icono ?? Package;

  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
          <Icono className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-muted">{etiqueta}</p>
          <p className="truncate text-[14px] font-semibold">{valor ? actual?.nombre : `Automático · ${actual?.nombre ?? 'Otros'}`}</p>
        </div>
        <PastillaSuave tono="neutro" className="bg-surface!" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
          {abierto ? 'Listo' : 'Cambiar'}
        </PastillaSuave>
      </div>

      {abierto && (
        <div className="mt-3 grid max-h-[320px] content-start gap-3 overflow-y-auto overscroll-contain pr-1">
          {valor && (
            <button type="button" onClick={() => onCambio(null)}
              className="foco flex h-11 shrink-0 items-center gap-2 rounded-xl bg-surface px-3 text-[13px] font-semibold text-ink-2 hover:text-ink">
              <Wand2 className="size-4" /> Automático según el nombre
            </button>
          )}
          {GRUPOS_ICONOS.map(g => (
            <div key={g.titulo} role="group" aria-label={g.titulo}>
              <p className="mb-1.5 text-[11px] font-semibold text-muted">{g.titulo}</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
                {g.opciones.map(op => {
                  const elegido = op.clave === valor;
                  return (
                    <button
                      key={op.clave}
                      type="button"
                      aria-pressed={elegido}
                      aria-label={op.nombre}
                      title={op.nombre}
                      onClick={() => onCambio(op.clave)}
                      className={cx(
                        'foco grid h-11 place-items-center rounded-xl transition active:scale-[0.96]',
                        elegido ? 'bg-accent-soft text-accent-strong ring-2 ring-accent' : 'bg-surface text-ink-2 hover:text-ink',
                      )}
                    >
                      <op.icono className="size-5" strokeWidth={1.9} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
