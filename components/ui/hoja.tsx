'use client';
// Hoja inferior en móvil / diálogo centrado en escritorio. Usa <dialog> nativo:
// atrapa el foco, cierra con Esc y oscurece el fondo sin librerías.
// En un cuaderno de solo lectura, las hojas de edición se ven pero no se pueden cambiar
// (salvo las que solo navegan o son de la propia cuenta: siempreActiva).
import { Eye, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { BotonCircular, cx } from './botones';
import { useSoloLectura } from './solo-lectura';

// Mientras haya una hoja abierta, la página de atrás no se mueve. overflow:hidden no basta en
// iPhone, así que el body queda fijo en su posición y al cerrar vuelve al mismo punto.
// Lleva la cuenta de las hojas abiertas porque una puede abrir otra encima.
let abiertas = 0;
let posicion = 0;

function bloquearScroll() {
  if (abiertas++ > 0) return;
  posicion = window.scrollY;
  const b = document.body.style;
  b.position = 'fixed';
  b.top = `-${posicion}px`;
  b.left = '0';
  b.right = '0';
  b.width = '100%';
  document.documentElement.style.overflow = 'hidden';
}

function soltarScroll() {
  if (--abiertas > 0) return;
  abiertas = 0;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.width = '';
  document.documentElement.style.overflow = '';
  window.scrollTo({ top: posicion, behavior: 'instant' });
}

export function Hoja({
  abierta, onCerrar, titulo, subtitulo, children, pie, siempreActiva, ancha,
}: {
  abierta: boolean; onCerrar: () => void; titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode; siempreActiva?: boolean;
  /** En escritorio: diálogo ancho y de alto fijo; el contenido maneja su propio scroll (p. ej. en columnas). */
  ancha?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bloqueada = useSoloLectura() && !siempreActiva;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return;
    bloquearScroll();
    return soltarScroll;
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      className={cx('hoja', ancha && 'hoja-ancha')}
      onClose={onCerrar}
      onCancel={e => { e.preventDefault(); onCerrar(); }}
      onClick={e => { if (e.target === ref.current) onCerrar(); }}
      aria-label={titulo}
    >
      {abierta && (
        <div className={cx('flex max-h-[92dvh] flex-col', ancha && 'lg:h-[min(820px,90dvh)]')}>
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface-3 lg:hidden" aria-hidden />
          <div className={cx('flex items-start gap-3 px-5 pt-4 pb-3', ancha && 'lg:border-b lg:border-line lg:px-6 lg:pt-5 lg:pb-4')}>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold tracking-tight">{titulo}</h2>
              {subtitulo && <p className="mt-0.5 text-[12px] text-muted">{subtitulo}</p>}
            </div>
            <BotonCircular etiqueta="Cerrar" onClick={onCerrar}>
              <X />
            </BotonCircular>
          </div>
          <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4', ancha && 'lg:overflow-hidden lg:px-6 lg:pt-4 lg:pb-0')}>
            {bloqueada ? (
              <>
                <p className="mb-4 flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-[12px] font-semibold text-ink-2">
                  <Eye className="size-4 shrink-0" /> Solo puedes ver: en este cuaderno no tienes permiso de edición.
                </p>
                <fieldset disabled className="contents">{children}</fieldset>
              </>
            ) : children}
          </div>
          {pie && !bloqueada && <div className={cx('border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]', ancha && 'lg:px-6 lg:pb-5')}>{pie}</div>}
        </div>
      )}
    </dialog>
  );
}
