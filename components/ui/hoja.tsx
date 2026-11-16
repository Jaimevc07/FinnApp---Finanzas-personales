'use client';
// Hoja inferior en móvil / diálogo centrado en escritorio. Usa <dialog> nativo:
// atrapa el foco, cierra con Esc y oscurece el fondo sin librerías.
// En un cuaderno de solo lectura, las hojas de edición se ven pero no se pueden cambiar
// (salvo las que solo navegan o son de la propia cuenta: siempreActiva).
import { Eye, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { BotonCircular } from './botones';
import { useSoloLectura } from './solo-lectura';

export function Hoja({
  abierta, onCerrar, titulo, subtitulo, children, pie, siempreActiva,
}: { abierta: boolean; onCerrar: () => void; titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode; siempreActiva?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const bloqueada = useSoloLectura() && !siempreActiva;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      className="hoja"
      onClose={onCerrar}
      onCancel={e => { e.preventDefault(); onCerrar(); }}
      onClick={e => { if (e.target === ref.current) onCerrar(); }}
      aria-label={titulo}
    >
      {abierta && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface-3 lg:hidden" aria-hidden />
          <div className="flex items-start gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold tracking-tight">{titulo}</h2>
              {subtitulo && <p className="mt-0.5 text-[12px] text-muted">{subtitulo}</p>}
            </div>
            <BotonCircular etiqueta="Cerrar" onClick={onCerrar}>
              <X />
            </BotonCircular>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            {bloqueada ? (
              <>
                <p className="mb-4 flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-[12px] font-semibold text-ink-2">
                  <Eye className="size-4 shrink-0" /> Solo puedes ver: en este cuaderno no tienes permiso de edición.
                </p>
                <fieldset disabled className="contents">{children}</fieldset>
              </>
            ) : children}
          </div>
          {pie && !bloqueada && <div className="border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">{pie}</div>}
        </div>
      )}
    </dialog>
  );
}
