'use client';
import { ArrowLeft } from 'lucide-react';
import { ListaActividad } from '@/components/actividad';
import { ConDatos } from '@/components/shell';
import { BotonCircular } from '@/components/ui/botones';
import { EncabezadoPantalla } from '@/components/ui/estructura';

export default function Actividad() {
  return (
    <ConDatos>
      <EncabezadoPantalla
        titulo="Actividad del hogar"
        subtitulo="Quién registró o cambió qué"
        izquierda={<BotonCircular etiqueta="Volver a Ajustes" href="/ajustes"><ArrowLeft /></BotonCircular>}
      />
      <div className="mx-auto mt-4 w-full max-w-[720px]">
        <ListaActividad />
      </div>
    </ConDatos>
  );
}
