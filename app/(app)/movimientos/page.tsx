'use client';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Minus, Plus, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { BarrasHorizontales } from '@/components/graficos/barras-h';
import { useDatos } from '@/components/proveedor';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { ConDatos } from '@/components/shell';
import { BotonPrimario, PastillaSuave } from '@/components/ui/botones';
import { Estadistica, FilaMovimiento, MontoHeroe } from '@/components/ui/datos';
import { EncabezadoPantalla, Tarjeta, Vacio } from '@/components/ui/estructura';
import { Segmentado } from '@/components/ui/segmentado';
import { AvisoMesFuera } from '@/components/aviso-mes';
import { planVsReal } from '@/lib/calculos';
import { etiquetaMes, mesesFueraDelPlan } from '@/lib/meses';
import { cop, delta, fechaLarga } from '@/lib/formato';
import { iconoDe } from '@/lib/iconos';
import type { Movimiento } from '@/lib/tipos';
import { quienFue } from '@/lib/miembros';

type Filtro = 'todos' | 'ingreso' | 'egreso';

export default function Movimientos() {
  return (
    <ConDatos>
      <VistaMovimientos />
    </ConDatos>
  );
}

function VistaMovimientos() {
  const { estado, periodoId, fila, abrirRegistro } = useDatos();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const r = planVsReal(estado, periodoId, fila);
  const lista = r.movs.filter(m => filtro === 'todos' || m.tipo === filtro);
  const conTarjeta = r.movs.filter(m => m.tipo === 'egreso' && m.medio === 'Tarjeta de crédito').reduce((s, m) => s + m.valor, 0);
  const fuera = mesesFueraDelPlan(estado);

  const porDia = new Map<string, Movimiento[]>();
  for (const m of lista) porDia.set(m.fecha, [...(porDia.get(m.fecha) ?? []), m]);

  return (
    <>
      <EncabezadoPantalla titulo="Movimientos" subtitulo={<>Lo que realmente entró y salió · <b className="font-semibold text-ink">frente al plan</b></>} />

      {fuera.map(f => (
        <div key={f.id} className="mt-4">
          <AvisoMesFuera
            mesId={f.id}
            titulo={f.cantidad === 1
              ? `1 movimiento de ${etiquetaMes(f.id)} no se está contando`
              : `${f.cantidad} movimientos de ${etiquetaMes(f.id)} no se están contando`}
            texto={`${etiquetaMes(f.id)} no está en el plan (${estado.periodos[0]?.etiqueta} – ${estado.periodos.at(-1)?.etiqueta}). Agrégalo para verlos y compararlos con su presupuesto.`}
          />
        </div>
      ))}

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-5">
          <section className="flex flex-col items-center gap-5 lg:rounded-3xl lg:bg-surface lg:p-6 lg:shadow-card">
            <SelectorPeriodo />
            <MontoHeroe centrado etiqueta={`Balance real de ${fila?.periodo.etiqueta ?? ''}`} valor={r.ingresos - r.egresos}
              detalle={`${r.movs.length} ${r.movs.length === 1 ? 'movimiento registrado' : 'movimientos registrados'}`} />
            <div className="flex gap-2">
              <PastillaSuave icono={Plus} tono="pos" onClick={() => abrirRegistro(null, 'ingreso')}>Ingreso</PastillaSuave>
              <PastillaSuave icono={Minus} tono="neg" onClick={() => abrirRegistro(null, 'egreso')}>Egreso</PastillaSuave>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Estadistica icono={ArrowDownLeft} etiqueta="Ingresos reales" valor={`+${cop(r.ingresos)}`} tono="pos"
              detalle={fila ? `Plan: ${cop(fila.ingresos)}` : undefined} />
            <Estadistica icono={ArrowUpRight} etiqueta="Egresos reales" valor={`−${cop(r.egresos)}`} tono="neg"
              detalle={fila ? `Plan: ${cop(fila.egresos)}` : undefined} />
          </div>

          {conTarjeta > 0 && (
            <div className="flex items-start gap-3 rounded-3xl bg-neg-soft p-4">
              <CreditCard className="mt-0.5 size-5 shrink-0 text-neg-text" />
              <p className="text-[13px] text-ink-2">
                <b className="font-semibold text-neg-text">{cop(conTarjeta)} con tarjeta de crédito</b> este mes. El plan es pagar en efectivo o débito
                mientras se liquidan las tarjetas.
              </p>
            </div>
          )}

          <Tarjeta titulo="Plan vs real por categoría" subtitulo="La marca naranja es lo presupuestado para el mes">
            {r.filas.length ? (
              <BarrasHorizontales
                mostrarPct={false}
                total={r.egresos}
                filas={r.filas
                  .sort((a, b) => b.real - a.real || b.plan - a.plan)
                  .map(f => ({
                    id: f.nombre,
                    nombre: f.nombre,
                    valor: f.real,
                    tope: f.plan,
                    extra: f.real > f.plan && f.plan > 0 ? <span className="text-[11px] font-semibold text-neg-text">+{cop(f.real - f.plan)}</span> : null,
                  }))}
              />
            ) : (
              <p className="text-[13px] text-muted">Sin presupuesto ni movimientos este mes.</p>
            )}
          </Tarjeta>
        </div>

        <div className="lg:col-span-7">
          <Tarjeta
            sinPadding
            titulo="Historial"
            accion={<Segmentado etiqueta="Filtrar" valor={filtro} onChange={setFiltro} className="w-[230px]"
              opciones={[{ valor: 'todos', etiqueta: 'Todos' }, { valor: 'ingreso', etiqueta: 'Ingresos', tono: 'pos' }, { valor: 'egreso', etiqueta: 'Egresos', tono: 'neg' }]} />}
          >
            <div className="px-3 pb-4 lg:px-4">
              {lista.length === 0 ? (
                <Vacio
                  icono={ReceiptText}
                  titulo="Aún no hay movimientos este mes"
                  texto="Registren cada salida, domicilio o compra: así encuentran la fuga antes de que se coma el plan."
                  accion={<BotonPrimario onClick={() => abrirRegistro()}><Plus /> Registrar el primero</BotonPrimario>}
                />
              ) : (
                [...porDia.entries()].map(([fecha, movs]) => {
                  const neto = movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.valor : -m.valor), 0);
                  return (
                    <div key={fecha} className="mt-2">
                      <div className="flex items-center justify-between px-2 py-2 text-[12px]">
                        <span className="font-semibold text-muted">{fechaLarga(fecha)}</span>
                        <span className="text-muted tabular-nums">{delta(neto)}</span>
                      </div>
                      {movs.map(m => (
                        <FilaMovimiento
                          key={m.id}
                          titulo={m.descripcion}
                          subtitulo={[estado.rubros.find(r => r.id === m.rubro_id)?.nombre ?? m.categoria, estado.rubros.find(r => r.id === m.tarjeta_id)?.nombre ?? m.medio, quienFue(estado, m.creado_por)].filter(Boolean).join(' · ')}
                          valor={m.valor}
                          tipo={m.tipo}
                          icono={m.tipo === 'egreso' ? iconoDe(m.categoria, estado.categorias) : undefined}
                          onClick={() => abrirRegistro(m)}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
