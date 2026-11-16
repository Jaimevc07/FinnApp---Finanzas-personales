'use client';
// Pre-vista: los cuadernos de la cuenta (cada uno con sus propios datos y su gente), las invitaciones
// recibidas y crear un cuaderno nuevo. Al elegir uno se entra a la app con sus datos.
import { BookOpen, ChevronRight, CircleAlert, Clock, LogOut, Mail, Plus, Sparkles, SquareDashed } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { cuadernoElegido, elegirCuaderno, olvidarCuaderno } from '@/lib/cuaderno-cliente';
import { resolverIcono } from '@/lib/iconos';
import { cuando, primerNombre } from '@/lib/miembros';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import type { InvitacionRecibida, ResumenCuaderno } from '@/lib/tipos';
import { Avatar, InsigniaPermiso, PERMISOS } from './cuenta';
import { borrarCopiaLocal } from './proveedor';
import { BotonAcento, BotonCircular, PastillaSuave, cx } from './ui/botones';
import { Campo, Entrada } from './ui/campos';
import { Esqueleto, Tarjeta } from './ui/estructura';
import { Hoja } from './ui/hoja';
import { Marca } from './ui/marca';
import { SelectorIcono } from './ui/selector-icono';

type Datos = { yo: { id: string; nombre: string; correo: string }; cuadernos: ResumenCuaderno[]; invitaciones: InvitacionRecibida[] };

export function PreVistaCuadernos() {
  const params = useSearchParams();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(params.get('error') === 'sin-acceso' ? 'Ya no tienes acceso a ese cuaderno.' : '');
  const [creando, setCreando] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [ultimo, setUltimo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/cuadernos', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { window.location.href = '/login?volver=%2Fcuadernos'; return; }
    if (d.codigo === 'sin-cuenta') {
      await supabaseNavegador().auth.signOut().catch(() => {});
      window.location.href = '/login?error=sin-acceso';
      return;
    }
    if (!r.ok) { setError(d.error || 'No se pudieron cargar los cuadernos'); return; }
    setDatos(d);
  }, []);

  useEffect(() => { setUltimo(cuadernoElegido()); cargar(); }, [cargar]);

  const entrar = (id: number) => {
    setOcupado(id);
    elegirCuaderno(id);
    window.location.href = '/';
  };

  async function responder(inv: InvitacionRecibida, aceptar: boolean) {
    setOcupado(-inv.id);
    const r = await fetch(`/api/invitaciones/${inv.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aceptar }) });
    const d = await r.json().catch(() => ({}));
    setOcupado(null);
    if (!r.ok) { setError(d.error || 'No se pudo responder la invitación'); return; }
    if (aceptar && d.cuadernoId) entrar(d.cuadernoId);
    else cargar();
  }

  async function salir() {
    if (!confirm('¿Cerrar sesión en este dispositivo?')) return;
    await supabaseNavegador().auth.signOut().catch(() => {});
    borrarCopiaLocal();
    olvidarCuaderno();
    window.location.href = '/login';
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[480px] px-4 pb-16 md:max-w-[760px] lg:max-w-[1040px]">
      <header className="flex items-center gap-3 pt-[max(env(safe-area-inset-top),16px)] pb-2 lg:pt-8">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ink"><Marca className="size-6" claro /></span>
        <p className="min-w-0 flex-1 text-[15px] font-bold tracking-tight">Finanzas Hogar</p>
        {datos && <Avatar nombre={datos.yo.nombre} className="size-10" />}
        <BotonCircular etiqueta="Cerrar sesión" onClick={salir}><LogOut /></BotonCircular>
      </header>

      <section className="mt-6 lg:mt-10">
        <p className="text-[13px] text-muted">{datos ? `Hola, ${primerNombre(datos.yo.nombre)}` : 'Hola'}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight lg:text-[36px]">Tus cuadernos</h1>
        <p className="mt-1 max-w-[520px] text-[14px] text-muted">
          Cada cuaderno tiene su propio presupuesto, deudas, metas, listas y movimientos, y su propia gente. Elige uno para entrar.
        </p>
      </section>

      {error && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl bg-neg-soft p-3 text-[13px] font-semibold text-neg-text">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {datos && datos.invitaciones.length > 0 && (
        <Tarjeta className="mt-6" titulo="Te invitaron" subtitulo="Acepta para ver el cuaderno con el permiso que te dieron">
          <ul className="flex flex-col divide-y divide-line">
            {datos.invitaciones.map(i => (
              <li key={i.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong"><Mail className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{i.cuaderno}</p>
                    <p className="truncate text-[12px] text-muted">{i.invitado_por ? `Invitación de ${primerNombre(i.invitado_por)}` : 'Invitación'} · {cuando(i.creado)}</p>
                    <div className="mt-1"><InsigniaPermiso permiso={i.permiso} /></div>
                  </div>
                </div>
                <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                  <PastillaSuave tono="neutro" className="justify-center" disabled={ocupado !== null} onClick={() => responder(i, false)}>Rechazar</PastillaSuave>
                  <PastillaSuave className="justify-center" disabled={ocupado !== null} onClick={() => responder(i, true)}>{ocupado === -i.id ? 'Uniéndote…' : 'Aceptar'}</PastillaSuave>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!datos ? (
          [0, 1, 2].map(i => <Esqueleto key={i} className="h-[168px] rounded-3xl" />)
        ) : (
          <>
            {datos.cuadernos.map(c => {
              // Sin ícono elegido: libro (adivinar por el nombre confunde, p. ej. "María" → mar)
              const Icono = c.icono ? resolverIcono(c.icono, c.nombre, 'book-open') : BookOpen;
              const visibles = c.personas.slice(0, 4);
              return (
                <button key={c.id} type="button" onClick={() => entrar(c.id)} disabled={ocupado !== null}
                  className={cx('foco group flex min-h-[168px] flex-col rounded-3xl bg-surface p-5 text-left shadow-card transition hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60',
                    ultimo === c.id && 'ring-2 ring-accent')}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong"><Icono className="size-6" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[16px] leading-snug font-semibold">{c.nombre}</p>
                      <div className="mt-1.5"><InsigniaPermiso permiso={c.permiso} /></div>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div className="flex items-center">
                      <div className="flex -space-x-2">
                        {visibles.map(p => <Avatar key={p.usuario_id} nombre={p.nombre} className="size-8 text-[11px] ring-2 ring-surface" />)}
                      </div>
                      <span className="ml-2 text-[12px] text-muted">
                        {c.personas.length === 1 ? 'Solo tú' : `${c.personas.length} personas`}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-right text-[11px] text-muted">
                      {ocupado === c.id ? 'Abriendo…' : ultimo === c.id ? 'El último que abriste' : c.ultimo_cambio ? <><Clock className="size-3" /> {cuando(c.ultimo_cambio)}</> : 'Sin cambios aún'}
                    </span>
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={() => setCreando(true)}
              className="foco flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line p-5 text-center transition hover:border-accent hover:bg-surface">
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-fill text-accent-ink"><Plus className="size-6" strokeWidth={2.4} /></span>
              <span className="text-[15px] font-semibold">Nuevo cuaderno</span>
              <span className="max-w-[240px] text-[12px] text-muted">Para otro hogar, un viaje, un negocio o lo que quieras llevar aparte</span>
            </button>
          </>
        )}
      </div>

      {datos && !datos.cuadernos.length && !datos.invitaciones.length && (
        <p className="mt-6 text-center text-[13px] text-muted">Aún no tienes cuadernos. Crea el primero o pide que te inviten a uno.</p>
      )}

      <HojaNuevoCuaderno abierta={creando} onCerrar={() => setCreando(false)} onCreado={entrar} />
    </main>
  );
}

function HojaNuevoCuaderno({ abierta, onCerrar, onCreado }: { abierta: boolean; onCerrar: () => void; onCreado: (id: number) => void }) {
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState<string | null>(null);
  const [inicio, setInicio] = useState<'blanco' | 'ejemplo'>('blanco');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (abierta) { setNombre(''); setIcono(null); setInicio('blanco'); setError(''); } }, [abierta]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('Escribe el nombre del cuaderno');
    setEnviando(true);
    setError('');
    const r = await fetch('/api/cuadernos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), icono, inicio }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'No se pudo crear el cuaderno'); setEnviando(false); return; }
    onCreado(d.id);
  }

  const OPCIONES = [
    { valor: 'blanco' as const, titulo: 'En blanco', texto: 'Con las categorías y los meses del plan, todo en $ 0. Lo llenas a tu medida.', icono: SquareDashed },
    { valor: 'ejemplo' as const, titulo: 'Con datos de ejemplo', texto: 'Con el presupuesto de ejemplo del Excel, para ver cómo funciona y ajustarlo.', icono: Sparkles },
  ];

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Nuevo cuaderno" subtitulo="Tendrá sus propios datos. Después podrás invitar a otras personas."
      pie={<BotonAcento type="submit" form="form-cuaderno-nuevo" className="w-full" disabled={enviando}>{enviando ? 'Creando…' : 'Crear y entrar'}</BotonAcento>}>
      <form id="form-cuaderno-nuevo" onSubmit={crear} className="flex flex-col gap-4">
        <Campo etiqueta="Nombre" htmlFor="nc-nombre">
          <Entrada id="nc-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} autoFocus placeholder="Ej: Hogar, Viaje a Europa, Negocio" />
        </Campo>
        <SelectorIcono valor={icono} onCambio={setIcono} nombre={nombre} respaldo="book-open" />
        <div role="radiogroup" aria-label="Cómo empieza" className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-muted">¿Cómo empieza?</p>
          {OPCIONES.map(o => {
            const on = inicio === o.valor;
            return (
              <button key={o.valor} type="button" role="radio" aria-checked={on} onClick={() => setInicio(o.valor)}
                className={cx('foco flex w-full items-start gap-3 rounded-2xl p-3 text-left transition', on ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2 hover:bg-surface-3')}>
                <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', on ? 'bg-surface text-accent-strong' : 'bg-surface text-ink-2')}><o.icono className="size-5" /></span>
                <span>
                  <span className="block text-[14px] font-semibold">{o.titulo}</span>
                  <span className="block text-[12px] text-muted">{o.texto}</span>
                </span>
              </button>
            );
          })}
        </div>
        {error && <p role="alert" className="rounded-2xl bg-neg-soft p-3 text-[13px] font-semibold text-neg-text">{error}</p>}
        <p className="flex items-center gap-1.5 text-[12px] text-muted"><BookOpen className="size-3.5" /> Serás {PERMISOS.propietario.titulo.toLowerCase()}: puedes invitar personas y darles permiso de editar o solo ver.</p>
      </form>
    </Hoja>
  );
}

