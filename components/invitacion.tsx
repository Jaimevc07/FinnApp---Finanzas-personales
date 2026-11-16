'use client';
// Página del enlace de invitación: muestra a qué cuaderno y con qué permiso, y permite unirse
// creando la cuenta (si el correo no tiene una), iniciando sesión o, con la sesión abierta, aceptando.
import { CircleAlert, Eye, EyeOff, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { elegirCuaderno } from '@/lib/cuaderno-cliente';
import { primerNombre } from '@/lib/miembros';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import type { Permiso } from '@/lib/tipos';
import { InsigniaPermiso, PERMISOS } from './cuenta';
import { borrarCopiaLocal } from './proveedor';
import { BotonPrimario, BotonSecundario } from './ui/botones';
import { Campo, Entrada } from './ui/campos';
import { Esqueleto } from './ui/estructura';
import { Marca } from './ui/marca';

type Info = {
  cuaderno: string; correo: string; permiso: Exclude<Permiso, 'propietario'>; invitado_por: string | null;
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'vencida'; cuentaExiste: boolean; sesion: { correo: string } | null;
};

function traducir(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'Contraseña incorrecta';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera un momento';
  return msg;
}

export function AceptarInvitacion({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`/api/invitacion/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) { setNoExiste(true); return; } setInfo(await r.json()); })
      .catch(() => setNoExiste(true));
  }, [token]);

  async function aceptar(body: Record<string, string> = {}) {
    const r = await fetch(`/api/invitacion/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo aceptar la invitación');
    return d.cuadernoId as number;
  }

  async function unirse(e?: React.FormEvent) {
    e?.preventDefault();
    if (!info) return;
    setError('');
    setEnviando(true);
    try {
      const supabase = supabaseNavegador();
      let id: number;
      if (info.sesion) {
        id = await aceptar();
      } else if (info.cuentaExiste) {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email: info.correo, password: contrasena });
        if (e1) throw new Error(traducir(e1.message));
        id = await aceptar();
      } else {
        if (!nombre.trim()) throw new Error('Escribe tu nombre');
        if (contrasena.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
        id = await aceptar({ nombre: nombre.trim(), contrasena });
        const { error: e1 } = await supabase.auth.signInWithPassword({ email: info.correo, password: contrasena });
        if (e1) throw new Error(traducir(e1.message));
      }
      borrarCopiaLocal();
      elegirCuaderno(id);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
      setEnviando(false);
    }
  }

  async function cambiarDeCuenta() {
    await supabaseNavegador().auth.signOut().catch(() => {});
    borrarCopiaLocal();
    window.location.reload();
  }

  const otraCuenta = !!info?.sesion && info.sesion.correo !== info.correo.toLowerCase();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-ink shadow-fin"><Marca className="size-9" claro /></span>
        {info ? (
          <>
            <p className="mt-5 text-[13px] text-muted">{info.invitado_por ? `${primerNombre(info.invitado_por)} te invitó a` : 'Te invitaron a'}</p>
            <h1 className="mt-1 text-[24px] leading-tight font-bold tracking-tight">«{info.cuaderno}»</h1>
            <div className="mt-2"><InsigniaPermiso permiso={info.permiso} /></div>
            <p className="mt-2 max-w-[320px] text-[13px] text-muted">{PERMISOS[info.permiso].texto}</p>
          </>
        ) : noExiste ? (
          <h1 className="mt-5 text-[22px] font-bold tracking-tight">Esta invitación no existe</h1>
        ) : (
          <Esqueleto className="mt-5 h-16 w-56" />
        )}
      </div>

      <section className="mt-7 rounded-3xl bg-surface p-5 shadow-card lg:p-6">
        {noExiste ? (
          <p className="text-[14px] text-ink-2">Revisa que el enlace esté completo o pide a quien te invitó que te envíe uno nuevo.</p>
        ) : !info ? (
          <div className="flex flex-col gap-4" aria-busy="true"><Esqueleto className="h-[72px]" /><Esqueleto className="h-12" /></div>
        ) : info.estado !== 'pendiente' ? (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-ink-2">
              {info.estado === 'aceptada' ? 'Esta invitación ya se usó. Si eres tú, entra con tu cuenta.' : 'Esta invitación ya no está disponible. Pide a quien te invitó que te envíe una nueva.'}
            </p>
            <BotonPrimario href="/cuadernos" className="w-full">Ir a mis cuadernos</BotonPrimario>
          </div>
        ) : otraCuenta ? (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 rounded-2xl bg-warn-soft p-3 text-[13px] font-semibold text-warn-text">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> Entraste como {info.sesion!.correo}, pero esta invitación es para {info.correo}.
            </p>
            <BotonPrimario className="w-full" onClick={cambiarDeCuenta}>Cerrar sesión y usar {info.correo}</BotonPrimario>
          </div>
        ) : (
          <form onSubmit={unirse} className="flex flex-col gap-4" noValidate>
            <p className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-[13px] text-ink-2">
              <Mail className="size-4 shrink-0 text-muted" /> <span className="min-w-0 truncate">{info.correo}</span>
            </p>
            {!info.sesion && !info.cuentaExiste && (
              <Campo etiqueta="Tu nombre" htmlFor="inv-nombre">
                <Entrada id="inv-nombre" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" maxLength={60} placeholder="Ej: María" autoFocus />
              </Campo>
            )}
            {!info.sesion && (
              <Campo etiqueta={info.cuentaExiste ? 'Tu contraseña' : 'Crea una contraseña'} htmlFor="inv-contrasena"
                ayuda={info.cuentaExiste ? 'Ya tienes cuenta con este correo: entra con tu contraseña.' : 'Mínimo 8 caracteres. Con ella entrarás a la app.'}>
                <div className="relative">
                  <Entrada id="inv-contrasena" type={ver ? 'text' : 'password'} value={contrasena} onChange={e => setContrasena(e.target.value)}
                    autoComplete={info.cuentaExiste ? 'current-password' : 'new-password'} className="pr-12" autoFocus={info.cuentaExiste} />
                  <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}
                    className="foco absolute inset-y-0 right-0 grid w-12 place-items-center rounded-2xl text-muted hover:text-ink">
                    {ver ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </div>
              </Campo>
            )}
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-neg-soft p-3 text-[13px] font-semibold text-neg-text">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
            <BotonPrimario type="submit" className="w-full" disabled={enviando || (!info.sesion && !contrasena)}>
              {enviando ? 'Uniéndote…' : info.sesion ? 'Aceptar y entrar' : info.cuentaExiste ? 'Entrar y aceptar' : 'Crear cuenta y unirme'}
            </BotonPrimario>
            {info.sesion && <BotonSecundario className="w-full" href="/cuadernos">Ahora no</BotonSecundario>}
          </form>
        )}
      </section>
    </main>
  );
}
