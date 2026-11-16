'use client';
// Página del enlace para unirse a la app: la persona escribe su nombre, correo y contraseña y queda
// con su propia cuenta (sin cuadernos de quien la invitó). Si el correo ya tenía cuenta, entra con su
// contraseña. Si Supabase pide confirmar el correo, se le avisa que lo revise.
import { CircleAlert, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { primerNombre } from '@/lib/miembros';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { borrarCopiaLocal } from './proveedor';
import { BotonPrimario, BotonSecundario } from './ui/botones';
import { Campo, Entrada } from './ui/campos';
import { Esqueleto } from './ui/estructura';
import { Marca } from './ui/marca';

type Info = { invitado_por: string | null; estado: 'pendiente' | 'usado' | 'vencido'; sesion: { correo: string; miembro: boolean } | null };

function traducir(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'Contraseña incorrecta';
  if (/email not confirmed/i.test(msg)) return 'Aún no confirmas tu correo: abre el enlace que te llegó';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera un momento';
  return msg;
}

export function Unirse({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ver, setVer] = useState(false);
  const [yaTiene, setYaTiene] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState('');
  const [reenviado, setReenviado] = useState(false);
  const url = `/api/unirse/${encodeURIComponent(token)}`;

  useEffect(() => {
    fetch(url, { cache: 'no-store' })
      .then(async r => { if (!r.ok) { setNoExiste(true); return; } setInfo(await r.json()); })
      .catch(() => setNoExiste(true));
  }, [url]);

  async function enviar(body: Record<string, string>) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (d.codigo === 'cuenta-existe') setYaTiene(true);
      throw new Error(d.codigo === 'cuenta-existe' ? 'Ese correo ya tiene cuenta: escribe tu contraseña para entrar' : d.error || 'No se pudo crear la cuenta');
    }
    return d as { confirmar: boolean; correo: string };
  }

  async function unirse(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const c = correo.trim().toLowerCase();
    if (!nombre.trim()) return setError('Escribe tu nombre');
    if (!info?.sesion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return setError('Escribe un correo válido');
    if (!info?.sesion && contrasena.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    setEnviando(true);
    try {
      const supabase = supabaseNavegador();
      if (info?.sesion) {
        await enviar({ nombre: nombre.trim() });
      } else if (yaTiene) {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email: c, password: contrasena });
        if (e1) throw new Error(traducir(e1.message));
        await enviar({ nombre: nombre.trim() });
      } else {
        const r = await enviar({ nombre: nombre.trim(), correo: c, contrasena });
        if (r.confirmar) { setPorConfirmar(r.correo); setEnviando(false); return; }
        const { error: e1 } = await supabase.auth.signInWithPassword({ email: c, password: contrasena });
        if (e1) throw new Error(traducir(e1.message));
      }
      borrarCopiaLocal();
      window.location.href = '/cuadernos';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-ink shadow-fin"><Marca className="size-9" claro /></span>
        {info ? (
          <>
            <p className="mt-5 text-[13px] text-muted">{info.invitado_por ? `${primerNombre(info.invitado_por)} te invitó a` : 'Te invitaron a'}</p>
            <h1 className="mt-1 text-[24px] leading-tight font-bold tracking-tight">Finanzas Hogar</h1>
            <p className="mt-2 max-w-[320px] text-[13px] text-muted">Crea tu cuenta para organizar tu presupuesto, tus gastos y tus metas. Tus cuadernos son solo tuyos hasta que los compartas.</p>
          </>
        ) : noExiste ? (
          <h1 className="mt-5 text-[22px] font-bold tracking-tight">Este enlace no existe</h1>
        ) : (
          <Esqueleto className="mt-5 h-16 w-56" />
        )}
      </div>

      <section className="mt-7 rounded-3xl bg-surface p-5 shadow-card lg:p-6">
        {noExiste ? (
          <p className="text-[14px] text-ink-2">Revisa que el enlace esté completo o pide a quien te invitó que te envíe uno nuevo.</p>
        ) : !info ? (
          <div className="flex flex-col gap-4" aria-busy="true"><Esqueleto className="h-[72px]" /><Esqueleto className="h-[72px]" /><Esqueleto className="h-12" /></div>
        ) : porConfirmar ? (
          <div className="flex flex-col gap-4 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pos-soft text-pos-text"><MailCheck className="size-6" /></span>
            <div>
              <p className="text-[16px] font-semibold">Revisa tu correo</p>
              <p className="mt-1 text-[13px] text-ink-2">Te enviamos un enlace a <b className="font-semibold">{porConfirmar}</b> para confirmar tu cuenta. Al abrirlo entras a la app.</p>
              <p className="mt-2 text-[12px] text-muted">¿No llega? Revisa la carpeta de spam.</p>
            </div>
            <BotonSecundario className="w-full" disabled={reenviado} onClick={async () => {
              const r = await fetch('/api/auth/reenviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: porConfirmar }) });
              const d = await r.json().catch(() => ({}));
              if (r.ok) setReenviado(true); else setError(d.error || 'No se pudo enviar el correo');
            }}>{reenviado ? 'Correo enviado otra vez' : 'Enviar el correo otra vez'}</BotonSecundario>
            {error && <p role="alert" className="rounded-2xl bg-neg-soft p-3 text-[13px] font-semibold text-neg-text">{error}</p>}
          </div>
        ) : info.sesion?.miembro ? (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-ink-2">Ya tienes cuenta en la app como <b className="font-semibold">{info.sesion.correo}</b>. Este enlace es para alguien nuevo: compártelo con esa persona.</p>
            <BotonPrimario href="/cuadernos" className="w-full">Ir a mis cuadernos</BotonPrimario>
          </div>
        ) : info.estado !== 'pendiente' ? (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-ink-2">
              {info.estado === 'usado' ? 'Este enlace ya se usó: cada enlace sirve para una persona.' : 'Este enlace venció.'} Pide a quien te invitó que te copie uno nuevo. Si ya tienes cuenta, entra con tu correo.
            </p>
            <BotonPrimario href="/login" className="w-full">Ir a iniciar sesión</BotonPrimario>
          </div>
        ) : (
          <form onSubmit={unirse} className="flex flex-col gap-4" noValidate>
            {info.sesion && (
              <p className="rounded-2xl bg-surface-2 p-3 text-[13px] text-ink-2">Entraste como <b className="font-semibold">{info.sesion.correo}</b>.</p>
            )}
            <Campo etiqueta="Tu nombre" htmlFor="un-nombre">
              <Entrada id="un-nombre" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" maxLength={60} placeholder="Ej: Laura" autoFocus />
            </Campo>
            {!info.sesion && (
              <>
                <Campo etiqueta="Tu correo" htmlFor="un-correo" ayuda="Con él entras a la app.">
                  <Entrada id="un-correo" type="email" inputMode="email" autoComplete="email" value={correo}
                    onChange={e => { setCorreo(e.target.value); setYaTiene(false); }} placeholder="laura@correo.com" />
                </Campo>
                <Campo etiqueta={yaTiene ? 'Tu contraseña' : 'Crea una contraseña'} htmlFor="un-contrasena"
                  ayuda={yaTiene ? 'Ese correo ya tiene cuenta: entra con tu contraseña.' : 'Mínimo 8 caracteres.'}>
                  <div className="relative">
                    <Entrada id="un-contrasena" type={ver ? 'text' : 'password'} value={contrasena} onChange={e => setContrasena(e.target.value)}
                      autoComplete={yaTiene ? 'current-password' : 'new-password'} className="pr-12" />
                    <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}
                      className="foco absolute inset-y-0 right-0 grid w-12 place-items-center rounded-2xl text-muted hover:text-ink">
                      {ver ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                    </button>
                  </div>
                </Campo>
              </>
            )}
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-neg-soft p-3 text-[13px] font-semibold text-neg-text">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
            <BotonPrimario type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Un momento…' : info.sesion ? 'Unirme y entrar' : yaTiene ? 'Entrar' : 'Crear mi cuenta'}
            </BotonPrimario>
            {!info.sesion && <p className="text-center text-[12px] text-muted">¿Ya tienes cuenta? <a href="/login" className="foco font-semibold text-accent-strong">Inicia sesión</a></p>}
          </form>
        )}
      </section>
    </main>
  );
}
