'use client';
import { ChevronRight, Plus, ShoppingBasket } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { HojaLista } from '@/components/listas';
import { useDatos } from '@/components/proveedor';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { ConDatos } from '@/components/shell';
import { BotonPrimario, cx } from '@/components/ui/botones';
import { Insignia, Medidor, MontoHeroe } from '@/components/ui/datos';
import { EncabezadoPantalla, Tarjeta, Vacio } from '@/components/ui/estructura';
import { presupuestoLista, totalesLista } from '@/lib/calculos';
import { cop } from '@/lib/formato';
import { iconoLista } from '@/lib/iconos';

export default function Listas() {
  return (
    <ConDatos>
      <VistaListas />
    </ConDatos>
  );
}

function VistaListas() {
  const { estado, periodoId } = useDatos();
  const [creando, setCreando] = useState(false);
  const resumen = estado.listas.map(l => {
    const t = totalesLista(estado.items.filter(i => i.lista_id === l.id));
    return { lista: l, ...t, tope: presupuestoLista(estado, l, periodoId) };
  });
  const porComprar = resumen.reduce((s, r) => s + r.pendiente, 0);

  return (
    <>
      <EncabezadoPantalla titulo="Listas de compras" subtitulo={<>Una lista por cada compra · <b className="font-semibold text-ink">con su propio tope</b></>} />

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <section className="flex flex-col items-center gap-5 lg:sticky lg:top-6 lg:col-span-5 lg:rounded-3xl lg:bg-surface lg:p-6 lg:shadow-card">
          <SelectorPeriodo />
          <MontoHeroe centrado etiqueta="Por comprar en todas las listas" valor={porComprar}
            detalle={`${estado.listas.length} ${estado.listas.length === 1 ? 'lista' : 'listas'} · ${resumen.reduce((s, r) => s + r.cantidad - r.comprados, 0)} productos pendientes`} />
          <BotonPrimario onClick={() => setCreando(true)} className="min-w-[200px]">
            <Plus strokeWidth={2.4} /> Nueva lista
          </BotonPrimario>
        </section>

        <div className="lg:col-span-7">
          {resumen.length === 0 ? (
            <Tarjeta>
              <Vacio icono={ShoppingBasket} titulo="Aún no hay listas"
                texto="Crea una lista para el mercado, la droguería o cualquier compra, y agrega los productos con cantidad y precio."
                accion={<BotonPrimario onClick={() => setCreando(true)}><Plus /> Crear la primera</BotonPrimario>} />
            </Tarjeta>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
              {resumen.map(r => {
                const margen = r.tope - r.total;
                const Icono = iconoLista(r.lista);
                return (
                  <li key={r.lista.id}>
                    <Link href={`/listas/${r.lista.id}`}
                      className="foco group flex h-full flex-col rounded-3xl bg-surface p-5 shadow-card transition hover:-translate-y-0.5">
                      <div className="flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-2">
                          <Icono className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">{r.lista.nombre}</p>
                          <p className="text-[12px] text-muted">{r.comprados} de {r.cantidad} comprados</p>
                        </div>
                        <ChevronRight className="mt-1 size-5 text-muted transition group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-4 text-[22px] font-bold tracking-tight">{cop(r.total)}</p>
                      <Medidor className="mt-2" valor={r.total ? r.comprado / r.total : 0} tono="pos" etiqueta={`Comprado de ${r.lista.nombre}`} />
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {r.tope > 0 ? (
                          <Insignia tono={margen >= 0 ? 'pos' : 'neg'}>
                            {margen >= 0 ? `Margen ${cop(margen)}` : `Excede ${cop(-margen)}`}
                          </Insignia>
                        ) : (
                          <Insignia>Sin tope</Insignia>
                        )}
                        {r.lista.rubro_id && <Insignia tono="accent">Del presupuesto</Insignia>}
                      </div>
                    </Link>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => setCreando(true)}
                  className={cx('foco flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-[14px] font-semibold text-muted transition hover:border-ink hover:text-ink')}>
                  <Plus className="size-6" /> Nueva lista
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>

      <HojaLista lista={null} abierta={creando} onCerrar={() => setCreando(false)} />
    </>
  );
}
