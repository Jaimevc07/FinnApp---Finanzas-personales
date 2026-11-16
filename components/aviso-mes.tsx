'use client';
// Aviso cuando un mes (el mes en curso o el de un movimiento) no está en el plan,
// con el botón para agregarlo si queda justo antes o después.
import { CalendarPlus, CalendarX2 } from 'lucide-react';
import { useState } from 'react';
import { etiquetaMes, posicionParaAgregar } from '@/lib/meses';
import { useDatos } from './proveedor';
import { BotonAcento, PastillaSuave, cx } from './ui/botones';

export function useAgregarMes() {
  const { estado, agregarPeriodo, setPeriodoId, avisar } = useDatos();
  const [agregando, setAgregando] = useState(false);
  const agregar = async (mesId: string) => {
    const posicion = posicionParaAgregar(estado, mesId);
    if (!posicion) return;
    setAgregando(true);
    try {
      await agregarPeriodo(posicion);
      setPeriodoId(mesId);
      avisar(`${etiquetaMes(mesId)} agregado al plan${posicion === 'anterior' ? ' en $ 0: llena su presupuesto' : ''}`);
    } catch { /* aviso ya mostrado */ } finally {
      setAgregando(false);
    }
  };
  return { agregar, agregando, puede: (mesId: string) => !!posicionParaAgregar(estado, mesId) };
}

/** Tarjeta de aviso (Inicio y Movimientos). */
export function AvisoMesFuera({ mesId, titulo, texto }: { mesId: string; titulo: string; texto: string }) {
  const { agregar, agregando, puede } = useAgregarMes();
  return (
    <section className="flex items-start gap-4 rounded-3xl bg-surface p-5 shadow-card lg:p-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-warn-soft text-warn-text">
        <CalendarX2 className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{titulo}</p>
        <p className="mt-1 text-[13px] text-muted">{texto}</p>
        {puede(mesId) && (
          <BotonAcento className="mt-4 h-10 px-4 text-[14px]" disabled={agregando} onClick={() => agregar(mesId)}>
            <CalendarPlus /> {agregando ? 'Agregando…' : `Agregar ${etiquetaMes(mesId)} al plan`}
          </BotonAcento>
        )}
      </div>
    </section>
  );
}

/** Versión compacta para el formulario de registro. */
export function AvisoMesFueraCompacto({ mesId, className }: { mesId: string; className?: string }) {
  const { estado } = useDatos();
  const { agregar, agregando, puede } = useAgregarMes();
  const primero = estado.periodos[0]?.etiqueta, ultimo = estado.periodos.at(-1)?.etiqueta;
  return (
    <div className={cx('rounded-2xl bg-warn-soft p-4 text-[13px]', className)}>
      <p className="font-semibold text-warn-text">{etiquetaMes(mesId)} no está en el plan ({primero} – {ultimo})</p>
      <p className="mt-0.5 text-ink-2">Si lo guardas así, no se cuenta en ningún mes.</p>
      {puede(mesId) && (
        <PastillaSuave icono={CalendarPlus} className="mt-3" disabled={agregando} onClick={() => agregar(mesId)}>
          {agregando ? 'Agregando…' : `Agregar ${etiquetaMes(mesId)} al plan`}
        </PastillaSuave>
      )}
    </div>
  );
}
