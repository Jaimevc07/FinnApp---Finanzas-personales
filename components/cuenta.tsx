'use client';
// Ajustes → tu cuenta, el cuaderno actual y las personas que tienen acceso a él (con su permiso).
import {
  BookOpen, Check, Copy, Eye, History, KeyRound, LogOut, Mail, Pencil, Send, Share2, ShieldCheck, Trash2, UserMinus, UserPlus, UserRoundCheck, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { iniciales, primerNombre } from '@/lib/miembros';
import type { Invitacion, Miembro, Permiso } from '@/lib/tipos';
import { useDatos } from './proveedor';
import { BotonAcento, BotonSecundario, PastillaSuave, cx } from './ui/botones';
import { Campo, Entrada } from './ui/campos';
import { Insignia } from './ui/datos';
import { Tarjeta } from './ui/estructura';
import { Hoja } from './ui/hoja';
import { Segmentado } from './ui/segmentado';

export const PERMISOS: Record<Permiso, { titulo: string; texto: string }> = {
  propietario: { titulo: 'Propietario', texto: 'Ve y edita todo, invita personas y cambia sus permisos.' },
  editor: { titulo: 'Puede editar', texto: 'Ve todo y puede registrar y cambiar datos (lectura y escritura).' },
  lector: { titulo: 'Solo ver', texto: 'Ve todo, pero no puede cambiar nada (solo lectura).' },
};

/** Círculo con las iniciales de una persona. */
export function Avatar({ nombre, className, apagado }: { nombre: string; className?: string; apagado?: boolean }) {
  return (
    <span aria-hidden className={cx('grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold',
      apagado ? 'bg-surface-2 text-muted' : 'bg-ink text-on-ink', className)}>
      {iniciales(nombre)}
    </span>
  );
}

export function InsigniaPermiso({ permiso }: { permiso: Permiso }) {
  if (permiso === 'propietario') return <Insignia tono="accent"><ShieldCheck className="size-3" /> Propietario</Insignia>;
  if (permiso === 'editor') return <Insignia><Pencil className="size-3" /> Puede editar</Insignia>;
  return <Insignia><Eye className="size-3" /> Solo ver</Insignia>;
}

/* ---------------- Tu cuenta ---------------- */
type EdicionCuenta = { tipo: 'nombre' | 'contrasena'; m: Miembro };

export function TarjetaCuenta() {
  const { estado, cerrarSesion } = useDatos();
  const [edicion, setEdicion] = useState<EdicionCuenta | null>(null);
  const yo = estado.miembros.find(m => m.usuario_id === estado.yo);
  if (!yo) return null;
  return (
    <Tarjeta titulo="Tu cuenta" subtitulo="Con esta cuenta quedan registrados tus movimientos y cambios">
      <div className="flex items-center gap-3">
        <Avatar nombre={yo.nombre} className="size-12 text-[15px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{yo.nombre}</p>
          <p className="truncate text-[12px] text-muted">{yo.correo}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <PastillaSuave icono={Pencil} tono="neutro" onClick={() => setEdicion({ tipo: 'nombre', m: yo })}>Cambiar nombre</PastillaSuave>
        <PastillaSuave icono={KeyRound} tono="neutro" onClick={() => setEdicion({ tipo: 'contrasena', m: yo })}>Cambiar contraseña</PastillaSuave>
        <PastillaSuave icono={LogOut} tono="neutro" onClick={() => { if (confirm('¿Cerrar sesión en este dispositivo?')) cerrarSesion(); }}>Cerrar sesión</PastillaSuave>
      </div>
      <HojaCuenta edicion={edicion} onCerrar={() => setEdicion(null)} />
    </Tarjeta>
  );
}

/** Cambiar el nombre propio o poner una contraseña nueva (la propia, o la de otro si administras la app). */
function HojaCuenta({ edicion, onCerrar }: { edicion: EdicionCuenta | null; onCerrar: () => void }) {
  const { estado, actualizarMiembro, avisar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!edicion) return;
    setNombre(edicion.m.nombre);
    setContrasena('');
  }, [edicion]);
  const esYo = edicion?.m.usuario_id === estado.yo;
  const titulo = !edicion ? '' : edicion.tipo === 'nombre' ? 'Cambiar tu nombre' : esYo ? 'Cambiar tu contraseña' : `Contraseña nueva para ${edicion.m.nombre}`;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!edicion) return;
    if (edicion.tipo === 'contrasena' && contrasena.length < 8) return avisar('La contraseña debe tener al menos 8 caracteres');
    setEnviando(true);
    try {
      if (edicion.tipo === 'nombre') await actualizarMiembro(edicion.m.usuario_id, { nombre: nombre.trim() });
      else await actualizarMiembro(edicion.m.usuario_id, { contrasena });
      avisar(edicion.tipo === 'nombre' ? 'Nombre actualizado' : esYo ? 'Contraseña cambiada' : `Contraseña nueva para ${edicion.m.nombre}: compártesela en persona`);
      onCerrar();
    } catch { /* el aviso ya se mostró */ } finally {
      setEnviando(false);
    }
  }

  return (
    <Hoja siempreActiva abierta={!!edicion} onCerrar={onCerrar} titulo={titulo}
      pie={<BotonAcento type="submit" form="form-cuenta" className="w-full" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</BotonAcento>}>
      <form id="form-cuenta" onSubmit={guardar} className="flex flex-col gap-4">
        {edicion?.tipo === 'nombre' ? (
          <Campo etiqueta="Nombre" htmlFor="cu-nombre">
            <Entrada id="cu-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} autoFocus required />
          </Campo>
        ) : (
          <Campo etiqueta="Contraseña nueva" htmlFor="cu-contrasena" ayuda="Mínimo 8 caracteres.">
            <Entrada id="cu-contrasena" type="text" autoComplete="new-password" value={contrasena} onChange={e => setContrasena(e.target.value)} autoFocus required minLength={8} />
          </Campo>
        )}
      </form>
    </Hoja>
  );
}

/* ---------------- Invitar a la app ---------------- */
type Invitado = { estado: 'enviado' | 'ya-tenia' | 'enlace'; correo: string; nombre: string; enlace?: string; motivo?: 'reenvio' | 'correo' };

/** Invitar a alguien nuevo a la app (no a un cuaderno): tendrá su propia cuenta y sus propios cuadernos. */
export function TarjetaInvitarApp() {
  const [abierta, setAbierta] = useState(false);
  return (
    <Tarjeta titulo="Invitar a la app" subtitulo="Para que alguien nuevo tenga su propia cuenta y arme sus propios cuadernos"
      accion={<PastillaSuave icono={UserPlus} onClick={() => setAbierta(true)}>Invitar</PastillaSuave>}>
      <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-[12px] text-ink-2">
        <Mail className="mt-0.5 size-4 shrink-0 text-muted" />
        <span>Le llega un correo para crear su contraseña. No verá tus cuadernos: si quieres compartirle uno, invítala desde «Personas en este cuaderno».</span>
      </p>
      <HojaInvitarApp abierta={abierta} onCerrar={() => setAbierta(false)} />
    </Tarjeta>
  );
}

function HojaInvitarApp({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const { estado, avisar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<Invitado | null>(null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { if (abierta) { setNombre(''); setCorreo(''); setListo(null); setCopiado(false); } }, [abierta]);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!nombre.trim()) return avisar('Escribe el nombre');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return avisar('Escribe un correo válido');
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/invitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), correo: c }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo invitar');
      setListo({ ...d, nombre: nombre.trim() });
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'No se pudo invitar');
    } finally {
      setEnviando(false);
    }
  }

  const yo = estado.miembros.find(m => m.usuario_id === estado.yo);
  const mensaje = listo?.enlace
    ? `Hola ${primerNombre(listo.nombre)}: ${yo ? primerNombre(yo.nombre) : 'Te'} te invitó a Finanzas Hogar, una app para organizar las finanzas. Entra con este enlace y crea tu contraseña: ${listo.enlace}`
    : '';
  const puedeCompartir = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Hoja siempreActiva abierta={abierta} onCerrar={onCerrar}
      titulo={listo ? (listo.estado === 'enlace' ? 'Envíale el enlace' : 'Invitación lista') : 'Invitar a la app'}
      subtitulo={listo ? listo.correo : 'Tendrá su propia cuenta. No verá tus cuadernos a menos que la invites a uno.'}
      pie={listo
        ? <BotonSecundario className="w-full" onClick={onCerrar}>Cerrar</BotonSecundario>
        : <BotonAcento type="submit" form="form-invitar-app" className="w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar invitación'}</BotonAcento>}>
      {!listo ? (
        <form id="form-invitar-app" onSubmit={invitar} className="flex flex-col gap-4">
          <Campo etiqueta="Nombre" htmlFor="ia-nombre">
            <Entrada id="ia-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} autoComplete="off" placeholder="Ej: Laura" autoFocus />
          </Campo>
          <Campo etiqueta="Correo" htmlFor="ia-correo">
            <Entrada id="ia-correo" type="email" inputMode="email" autoComplete="off" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="laura@correo.com" />
          </Campo>
          <p className="text-[12px] text-muted">Le llega un correo de Finanzas Hogar con un enlace para crear su contraseña. El enlace sirve una sola vez.</p>
        </form>
      ) : listo.estado === 'enviado' ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-pos-soft text-pos-text"><Send className="size-5" /></span>
          <p className="text-[14px] text-ink-2">Le enviamos un correo a <b className="font-semibold">{listo.correo}</b> para que cree su contraseña. Si no le llega, que revise la carpeta de spam.</p>
        </div>
      ) : listo.estado === 'ya-tenia' ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-pos-soft text-pos-text"><UserRoundCheck className="size-5" /></span>
          <p className="text-[14px] text-ink-2"><b className="font-semibold">{listo.correo}</b> ya tenía cuenta: ahora puede entrar a la app con su correo y contraseña (o recuperarla desde el inicio de sesión).</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="rounded-2xl bg-warn-soft p-3 text-[12px] font-semibold text-warn-text">
            {listo.motivo === 'reenvio'
              ? 'Ya la habías invitado y aún no entra. Envíale este enlace nuevo.'
              : 'El correo no salió (falta configurar el envío de correos en Supabase). Envíale este enlace por WhatsApp o como prefieras.'}
          </p>
          <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
            <p className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{listo.enlace}</p>
            <PastillaSuave icono={copiado ? Check : Copy} tono="neutro" onClick={async () => {
              try { await navigator.clipboard.writeText(listo.enlace!); setCopiado(true); avisar('Enlace copiado'); } catch { avisar('No se pudo copiar: selecciónalo y cópialo'); }
            }}>{copiado ? 'Copiado' : 'Copiar'}</PastillaSuave>
          </div>
          <BotonAcento className="w-full" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener')}><Send /> Enviar por WhatsApp</BotonAcento>
          <BotonSecundario className="w-full" onClick={() => { window.location.href = `mailto:${listo.correo}?subject=${encodeURIComponent('Te invito a Finanzas Hogar')}&body=${encodeURIComponent(mensaje)}`; }}><Mail /> Enviar por correo</BotonSecundario>
          {puedeCompartir && <BotonSecundario className="w-full" onClick={() => navigator.share({ title: 'Finanzas Hogar', text: mensaje }).catch(() => {})}><Share2 /> Compartir…</BotonSecundario>}
          <p className="text-[12px] text-muted">El enlace es personal y sirve una sola vez: quien lo abra entra a esa cuenta.</p>
        </div>
      )}
    </Hoja>
  );
}

/* ---------------- Este cuaderno ---------------- */
export function TarjetaCuaderno() {
  const { estado, esPropietario, editarCuaderno, eliminarCuaderno, salirDelCuaderno, cambiarDeCuaderno, avisar } = useDatos();
  const [renombrar, setRenombrar] = useState(false);
  const [nombre, setNombre] = useState('');
  const c = estado.cuaderno;
  if (!c) return null;

  return (
    <Tarjeta titulo="Este cuaderno" subtitulo="Cada cuaderno tiene sus propios datos y su propia gente">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong"><BookOpen className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{c.nombre}</p>
          <div className="mt-1"><InsigniaPermiso permiso={c.permiso} /></div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <PastillaSuave icono={BookOpen} onClick={cambiarDeCuaderno}>Cambiar de cuaderno</PastillaSuave>
        <PastillaSuave icono={History} tono="neutro" href="/actividad">Actividad</PastillaSuave>
        {esPropietario && <PastillaSuave icono={Pencil} tono="neutro" onClick={() => { setNombre(c.nombre); setRenombrar(true); }}>Cambiar nombre</PastillaSuave>}
        {!esPropietario && (
          <PastillaSuave icono={LogOut} tono="neutro" onClick={async () => {
            if (!confirm(`¿Salir de «${c.nombre}»? Dejarás de verlo hasta que te vuelvan a invitar.`)) return;
            await salirDelCuaderno().catch(() => {});
          }}>Salir del cuaderno</PastillaSuave>
        )}
        {esPropietario && (
          <PastillaSuave icono={Trash2} tono="neg" onClick={async () => {
            const escrito = prompt(`Esto borra «${c.nombre}» con todo su presupuesto, movimientos, metas y listas, para todas las personas. No se puede deshacer.\n\nEscribe el nombre del cuaderno para confirmar:`);
            if (escrito === null) return;
            if (escrito.trim() !== c.nombre) return avisar('El nombre no coincide: no se borró nada');
            await eliminarCuaderno().catch(() => {});
          }}>Eliminar cuaderno</PastillaSuave>
        )}
      </div>
      <Hoja abierta={renombrar} onCerrar={() => setRenombrar(false)} titulo="Nombre del cuaderno" siempreActiva
        pie={<BotonAcento type="submit" form="form-cuaderno" className="w-full">Guardar</BotonAcento>}>
        <form id="form-cuaderno" onSubmit={async e => {
          e.preventDefault();
          if (!nombre.trim()) return avisar('Escribe el nombre');
          await editarCuaderno({ nombre: nombre.trim() }).then(() => { avisar('Nombre actualizado'); setRenombrar(false); }).catch(() => {});
        }}>
          <Campo etiqueta="Nombre" htmlFor="cd-nombre">
            <Entrada id="cd-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} autoFocus placeholder="Ej: Hogar, Viaje a Europa, Negocio" />
          </Campo>
        </form>
      </Hoja>
    </Tarjeta>
  );
}

/* ---------------- Personas en este cuaderno ---------------- */
const enlaceDe = (inv: Pick<Invitacion, 'token'>) => `${location.origin}/invitacion/${inv.token}`;

export function TarjetaPersonas() {
  const { estado, esPropietario, cambiarPersona, cancelarInvitacion, avisar } = useDatos();
  const [invitando, setInvitando] = useState(false);
  const [editando, setEditando] = useState<Miembro | null>(null);
  const [compartir, setCompartir] = useState<Invitacion | null>(null);
  const [contrasena, setContrasena] = useState<{ tipo: 'contrasena'; m: Miembro } | null>(null);
  const yo = estado.miembros.find(m => m.usuario_id === estado.yo);
  const adminApp = yo?.rol === 'admin';
  const activos = estado.miembros.filter(m => m.activo);
  const fuera = estado.miembros.filter(m => !m.activo);
  const invitaciones = estado.invitaciones ?? [];

  return (
    <Tarjeta
      titulo="Personas en este cuaderno"
      subtitulo={esPropietario ? 'Invita a quien quieras y decide si puede editar o solo ver' : 'Quiénes ven este cuaderno'}
      accion={esPropietario ? <PastillaSuave icono={UserPlus} onClick={() => setInvitando(true)}>Invitar</PastillaSuave> : undefined}
    >
      <ul className="flex flex-col divide-y divide-line">
        {[...activos, ...fuera].map(m => {
          const esYo = m.usuario_id === estado.yo;
          return (
            <li key={m.usuario_id} className="flex items-center gap-3 py-2.5">
              <Avatar nombre={m.nombre} apagado={!m.activo} />
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-[14px] font-semibold', !m.activo && 'text-muted')}>
                  {m.nombre}{esYo && <span className="font-normal text-muted"> (tú)</span>}
                </p>
                <p className="truncate text-[12px] text-muted">{m.correo}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {m.activo ? <InsigniaPermiso permiso={m.permiso} /> : <Insignia>Ya no está en el cuaderno</Insignia>}
                </div>
              </div>
              {!esYo && (esPropietario || (adminApp && m.activo)) && (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {esPropietario && m.activo && <PastillaSuave icono={Pencil} tono="neutro" onClick={() => setEditando(m)} aria-label={`Cambiar permiso de ${m.nombre}`}>Permiso</PastillaSuave>}
                  {esPropietario && !m.activo && (
                    <PastillaSuave icono={UserRoundCheck} tono="neutro" onClick={() => cambiarPersona(m.usuario_id, { activo: true }).then(() => avisar(`${m.nombre} vuelve al cuaderno`)).catch(() => {})}>Devolver acceso</PastillaSuave>
                  )}
                  {adminApp && m.activo && <PastillaSuave icono={KeyRound} tono="neutro" onClick={() => setContrasena({ tipo: 'contrasena', m })} aria-label={`Contraseña nueva para ${m.nombre}`}>Contraseña</PastillaSuave>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {esPropietario && invitaciones.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1 text-[12px] font-semibold text-muted">Invitaciones pendientes</p>
          <ul className="flex flex-col divide-y divide-line">
            {invitaciones.map(i => (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"><Mail className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{i.correo}</p>
                  <div className="mt-1"><InsigniaPermiso permiso={i.permiso} /></div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <PastillaSuave icono={Send} onClick={() => setCompartir(i)}>Enviar</PastillaSuave>
                  <PastillaSuave icono={X} tono="neutro" aria-label={`Cancelar la invitación de ${i.correo}`}
                    onClick={() => { if (confirm(`¿Cancelar la invitación de ${i.correo}? El enlace dejará de funcionar.`)) cancelarInvitacion(i.id).catch(() => {}); }}>Cancelar</PastillaSuave>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {esPropietario && activos.length === 1 && !invitaciones.length && (
        <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[12px] text-ink-2">
          Invita a tu pareja, familia o a quien te ayude con las finanzas. Cada cambio queda con el nombre de quien lo hizo.
        </p>
      )}

      <HojaInvitar abierta={invitando} onCerrar={() => setInvitando(false)} onCreada={i => { setInvitando(false); setCompartir(i); }} />
      <HojaPermiso persona={editando} onCerrar={() => setEditando(null)} />
      <HojaCompartir invitacion={compartir} onCerrar={() => setCompartir(null)} />
      <HojaCuenta edicion={contrasena} onCerrar={() => setContrasena(null)} />
    </Tarjeta>
  );
}

/** Invitar por correo con permiso de editar o solo ver. */
function HojaInvitar({ abierta, onCerrar, onCreada }: { abierta: boolean; onCerrar: () => void; onCreada: (i: Invitacion) => void }) {
  const { estado, invitar, avisar } = useDatos();
  const [correo, setCorreo] = useState('');
  const [permiso, setPermiso] = useState<Exclude<Permiso, 'propietario'>>('editor');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (abierta) { setCorreo(''); setPermiso('editor'); } }, [abierta]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const c = correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return avisar('Escribe un correo válido');
    setEnviando(true);
    try {
      await invitar(c, permiso);
      // El estado nuevo trae la invitación con su enlace: HojaCompartir la busca por correo
      onCreada({ id: 0, correo: c, permiso, token: '', creado: '', vence: '', invitado_por: null });
    } catch { /* aviso ya mostrado */ } finally {
      setEnviando(false);
    }
  }

  return (
    <Hoja siempreActiva abierta={abierta} onCerrar={onCerrar} titulo={`Invitar a «${estado.cuaderno?.nombre ?? 'este cuaderno'}»`}
      subtitulo="Se crea un enlace personal para esa persona. Lo envías por correo, WhatsApp o como prefieras."
      pie={<BotonAcento type="submit" form="form-invitar" className="w-full" disabled={enviando}>{enviando ? 'Creando…' : 'Crear invitación'}</BotonAcento>}>
      <form id="form-invitar" onSubmit={crear} className="flex flex-col gap-4">
        <Campo etiqueta="Correo de la persona" htmlFor="inv-correo">
          <Entrada id="inv-correo" type="email" inputMode="email" autoComplete="off" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="maria@correo.com" autoFocus required />
        </Campo>
        <Campo etiqueta="¿Qué podrá hacer?">
          <Segmentado etiqueta="Permiso" valor={permiso} onChange={setPermiso} opciones={[
            { valor: 'editor', etiqueta: 'Ver y editar' },
            { valor: 'lector', etiqueta: 'Solo ver' },
          ]} />
        </Campo>
        <p className="text-[12px] text-muted">{PERMISOS[permiso].texto} Si ya tiene cuenta, también verá la invitación al entrar a la app.</p>
      </form>
    </Hoja>
  );
}

/** Cambiar el permiso de alguien o quitarlo del cuaderno. */
function HojaPermiso({ persona, onCerrar }: { persona: Miembro | null; onCerrar: () => void }) {
  const { cambiarPersona, avisar } = useDatos();
  const [permiso, setPermiso] = useState<Permiso>('editor');
  useEffect(() => { if (persona) setPermiso(persona.permiso); }, [persona]);
  if (!persona) return <Hoja abierta={false} onCerrar={onCerrar} titulo=""><span /></Hoja>;
  return (
    <Hoja siempreActiva abierta={!!persona} onCerrar={onCerrar} titulo={`Permiso de ${primerNombre(persona.nombre)}`} subtitulo={persona.correo}
      pie={
        <div className="flex gap-2">
          <BotonSecundario className="px-4 text-neg-text" aria-label={`Quitar a ${persona.nombre} del cuaderno`} onClick={async () => {
            if (!confirm(`¿Quitar a ${persona.nombre} de este cuaderno? Dejará de verlo; sus registros conservan su nombre.`)) return;
            await cambiarPersona(persona.usuario_id, { activo: false }).then(() => { avisar(`${persona.nombre} ya no está en el cuaderno`); onCerrar(); }).catch(() => {});
          }}><UserMinus /></BotonSecundario>
          <BotonAcento className="flex-1" onClick={async () => {
            await cambiarPersona(persona.usuario_id, { permiso }).then(() => { avisar('Permiso actualizado'); onCerrar(); }).catch(() => {});
          }}>Guardar</BotonAcento>
        </div>
      }>
      <div role="radiogroup" aria-label="Permiso" className="flex flex-col gap-2">
        {(['editor', 'lector', 'propietario'] as Permiso[]).map(p => {
          const on = permiso === p;
          return (
            <button key={p} type="button" role="radio" aria-checked={on} onClick={() => setPermiso(p)}
              className={cx('foco flex w-full items-start gap-3 rounded-2xl p-3 text-left transition', on ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2 hover:bg-surface-3')}>
              <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', on ? 'border-accent-fill bg-accent-fill text-accent-ink' : 'border-line bg-surface')}>
                {on && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{PERMISOS[p].titulo}</span>
                <span className="block text-[12px] text-muted">{PERMISOS[p].texto}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Hoja>
  );
}

/** Enviar el enlace de una invitación: correo (abre el programa de correo), WhatsApp, compartir o copiar. */
function HojaCompartir({ invitacion, onCerrar }: { invitacion: Invitacion | null; onCerrar: () => void }) {
  const { estado, avisar } = useDatos();
  const [copiado, setCopiado] = useState(false);
  // Al crearla, el token llega con el estado nuevo: se busca por correo
  const inv = invitacion && (invitacion.token ? invitacion : estado.invitaciones?.find(i => i.correo === invitacion.correo));
  useEffect(() => setCopiado(false), [invitacion]);
  if (!inv) return <Hoja abierta={false} onCerrar={onCerrar} titulo=""><span /></Hoja>;
  const enlace = enlaceDe(inv);
  const yo = estado.miembros.find(m => m.usuario_id === estado.yo);
  const cuaderno = estado.cuaderno?.nombre ?? 'mi cuaderno';
  const mensaje = `Hola: ${yo ? primerNombre(yo.nombre) : 'Te'} te invitó a «${cuaderno}» en Finanzas Hogar (${PERMISOS[inv.permiso].titulo.toLowerCase()}). Entra con este enlace para unirte: ${enlace}`;
  const asunto = `Invitación a «${cuaderno}» en Finanzas Hogar`;
  const puedeCompartir = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Hoja siempreActiva abierta={!!invitacion} onCerrar={onCerrar} titulo="Enviar la invitación"
      subtitulo={`Para ${inv.correo} · ${PERMISOS[inv.permiso].titulo}. El enlace vence en 14 días y solo sirve para ese correo.`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
          <p className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{enlace}</p>
          <PastillaSuave icono={copiado ? Check : Copy} tono="neutro" onClick={async () => {
            try { await navigator.clipboard.writeText(enlace); setCopiado(true); avisar('Enlace copiado'); } catch { avisar('No se pudo copiar: selecciónalo y cópialo'); }
          }}>{copiado ? 'Copiado' : 'Copiar'}</PastillaSuave>
        </div>
        <BotonAcento className="w-full" onClick={() => { window.location.href = `mailto:${inv.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`; }}>
          <Mail /> Enviar por correo
        </BotonAcento>
        <BotonSecundario className="w-full" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener')}>
          <Send /> Enviar por WhatsApp
        </BotonSecundario>
        {puedeCompartir && (
          <BotonSecundario className="w-full" onClick={() => navigator.share({ title: asunto, text: mensaje }).catch(() => {})}><Share2 /> Compartir…</BotonSecundario>
        )}
        <p className="text-[12px] text-muted">
          Al abrirlo, la persona crea su cuenta (o entra con la que tiene) y queda en el cuaderno. Puedes volver a enviarlo desde «Invitaciones pendientes».
        </p>
      </div>
    </Hoja>
  );
}
