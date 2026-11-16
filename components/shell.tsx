'use client';
// Estructura de la app: barra lateral, contenido, barra inferior, hoja de registro y avisos.
import { CloudOff, Eye } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, type ReactNode } from 'react';
import { HojaRegistro } from './hoja-registro';
import { TirarParaActualizar } from './tirar-para-actualizar';
import { BarraLateral, NavegacionInferior } from './navegacion';
import { useFinanzas } from './proveedor';
import { cx } from './ui/botones';
import { Esqueleto } from './ui/estructura';

function AbrirDesdeAtajo() {
  // Atajo del ícono instalado: /movimientos?nuevo=1 abre directamente el registro.
  const params = useSearchParams();
  const { abrirRegistro, estado } = useFinanzas();
  useEffect(() => {
    if (estado && params.get('nuevo') === '1') abrirRegistro();
  }, [params, estado, abrirRegistro]);
  return null;
}

export function Shell({ children }: { children: ReactNode }) {
  const { aviso, avisoAccion, conexion, estado, puedeEditar } = useFinanzas();
  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral />
      <main className="min-w-0 flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12">
        {conexion === 'sin-conexion' && (
          <div className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-[12px] font-medium text-on-ink">
            <CloudOff className="size-4" /> Sin conexión con el servidor: ves la última copia guardada.
          </div>
        )}
        {estado && !puedeEditar && (
          <div className="flex items-center justify-center gap-2 bg-surface-2 px-4 py-2 text-[12px] font-medium text-ink-2">
            <Eye className="size-4 shrink-0" /> Solo lectura en «{estado.cuaderno?.nombre}»: puedes ver todo, pero no editar.
          </div>
        )}
        <div className="mx-auto w-full max-w-[480px] px-4 md:max-w-[720px] lg:max-w-[1200px] lg:px-8">{children}</div>
      </main>
      <NavegacionInferior />
      <TirarParaActualizar />
      <HojaRegistro />
      <Suspense>
        <AbrirDesdeAtajo />
      </Suspense>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-8"
      >
        {aviso && (
          <p className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink py-3 pr-2 pl-4 text-[13px] font-medium text-on-ink shadow-fin">
            <span className={cx(!avisoAccion && 'pr-2')}>{aviso}</span>
            {avisoAccion && (
              <button type="button" onClick={avisoAccion.fn}
                className="foco -my-2 h-10 shrink-0 rounded-xl px-3 font-bold underline underline-offset-2 transition hover:opacity-80">
                {avisoAccion.etiqueta}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Muestra esqueletos hasta que llegan los datos. */
export function ConDatos({ children }: { children: ReactNode }) {
  const { estado, periodoId } = useFinanzas();
  if (!estado || !periodoId) {
    return (
      <div className="flex flex-col gap-4 pt-6" aria-busy="true" aria-label="Cargando">
        <Esqueleto className="h-10 w-2/3" />
        <Esqueleto className="mx-auto h-12 w-1/2" />
        <Esqueleto className="mx-auto aspect-[1.586] w-full max-w-[340px]" />
        <Esqueleto className="h-40" />
      </div>
    );
  }
  return <>{children}</>;
}
