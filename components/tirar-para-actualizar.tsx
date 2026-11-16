'use client';
// Tirar hacia abajo para actualizar (celular): desde arriba de la pantalla se arrastra hacia abajo,
// aparece el indicador y al soltar pasado el umbral se traen los cambios de las demás personas.
import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFinanzas } from './proveedor';
import { cx } from './ui/botones';

const UMBRAL = 70; // px de tirón (ya amortiguado) para actualizar
const MAXIMO = 110;

export function TirarParaActualizar() {
  const { refrescar, refrescando } = useFinanzas();
  const [tiron, setTiron] = useState(0);
  const tironRef = useRef(0);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const arrastrando = useRef(false);

  useEffect(() => {
    const mover = (v: number) => { tironRef.current = v; setTiron(v); };
    const alTocar = (e: TouchEvent) => {
      // Solo desde arriba del todo, con un dedo y sin una hoja abierta
      if (window.scrollY > 0 || e.touches.length !== 1 || document.querySelector('dialog[open]')) { inicio.current = null; return; }
      inicio.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      arrastrando.current = false;
    };
    const alMover = (e: TouchEvent) => {
      if (!inicio.current) return;
      const dy = e.touches[0].clientY - inicio.current.y;
      const dx = e.touches[0].clientX - inicio.current.x;
      if (!arrastrando.current) {
        // Un gesto lateral o hacia arriba no es "tirar para actualizar"
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) { if (Math.abs(dx) > 10 || dy < -6) inicio.current = null; return; }
        if (dy < 10 || window.scrollY > 0) return;
        arrastrando.current = true;
      }
      mover(Math.min(MAXIMO, Math.max(0, (dy - 10) * 0.5)));
    };
    const alSoltar = () => {
      if (arrastrando.current && tironRef.current >= UMBRAL) refrescar();
      inicio.current = null;
      arrastrando.current = false;
      mover(0);
    };
    window.addEventListener('touchstart', alTocar, { passive: true });
    window.addEventListener('touchmove', alMover, { passive: true });
    window.addEventListener('touchend', alSoltar);
    window.addEventListener('touchcancel', alSoltar);
    return () => {
      window.removeEventListener('touchstart', alTocar);
      window.removeEventListener('touchmove', alMover);
      window.removeEventListener('touchend', alSoltar);
      window.removeEventListener('touchcancel', alSoltar);
    };
  }, [refrescar]);

  const listo = tiron >= UMBRAL;
  const visible = refrescando || tiron > 0;
  // Baja desde fuera de la pantalla siguiendo el dedo; mientras actualiza se queda arriba girando
  const y = refrescando ? 14 : -52 + Math.min(tiron, MAXIMO) * 0.9;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[60] flex justify-center"
      style={{ transform: `translateY(${y}px)`, opacity: visible ? Math.min(1, refrescando ? 1 : tiron / 40) : 0, transition: tiron && !refrescando ? 'none' : 'transform 200ms ease-out, opacity 200ms ease-out' }}
      role="status"
      aria-live="polite"
    >
      <span className={cx('grid size-11 place-items-center rounded-full bg-surface shadow-card ring-1 ring-line transition-colors',
        listo || refrescando ? 'text-accent-strong' : 'text-muted')}>
        <RefreshCw
          className={cx('size-5', refrescando && 'animate-spin')}
          style={refrescando ? undefined : { transform: `rotate(${tiron * 3.2}deg) scale(${listo ? 1.1 : 1})`, transition: 'transform 120ms' }}
        />
      </span>
      <span className="sr-only">{refrescando ? 'Actualizando los datos' : listo ? 'Suelta para actualizar' : ''}</span>
    </div>
  );
}
