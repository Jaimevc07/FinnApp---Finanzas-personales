'use client';
// Inicio de sesión con Supabase Auth (correo y contraseña; Google si está activo en Supabase).
// La primera vez, sin miembros, crea la cuenta de quien administra el hogar.
import { CircleAlert, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { BotonPrimario, BotonSecundario } from './ui/botones';
import { Campo, Entrada } from './ui/campos';
import { Esqueleto } from './ui/estructura';
import { Marca } from './ui/marca';

type Config = { registroAbierto: boolean; google: boolean };

const ERRORES: Record<string, string> = {
  'sin-acceso': 'Esta cuenta no tiene acceso a la app. Pídele a alguien que te invite a su cuaderno.',
  google: 'No se pudo iniciar sesión con Google. Intenta de nuevo.',
};

function traducir(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos';
  if (/email not confirmed/i.test(msg)) return 'La cuenta aún no está confirmada';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera un momento e intenta de nuevo';
  if (/fetch|network/i.test(msg)) return 'Sin conexión. Revisa tu internet';
  return msg;
}

/** Solo rutas internas al volver, para no redirigir a otro sitio. */
const destinoSeguro = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/login') ? v : '/cuadernos');

export function FormularioLogin() {
  const params = useSearchParams();
  const volver = destinoSeguro(params.get('volver'));
  const [config, setConfig] = useState<Config | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(ERRORES[params.get('error') ?? ''] ?? '');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config').then(r => r.json()).then(setConfig).catch(() => setConfig({ registroAbierto: false, google: false }));
  }, []);

  const registro = !!config?.registroAbierto;

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const supabase = supabaseNavegador();
      if (registro) {
        const r = await fetch('/api/auth/registro', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, correo, contrasena }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'No se pudo crear la cuenta');
      }
      const { error: e1 } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: contrasena });
      if (e1) throw new Error(traducir(e1.message));
      // Tener sesión en Supabase no basta: debe tener cuenta en la app
      const yo = await fetch('/api/auth/yo');
      if (yo.status === 403) {
        await supabase.auth.signOut();
        throw new Error(ERRORES['sin-acceso']);
      }
      if (!yo.ok) throw new Error('No se pudo iniciar sesión. Intenta de nuevo');
      window.location.href = volver;
    } catch (err) {
      setError(err instanceof Error ? traducir(err.message) : 'No se pudo iniciar sesión');
      setEnviando(false);
    }
  }

  async function conGoogle() {
    setError('');
    const { error: e1 } = await supabaseNavegador().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback${volver !== '/' ? `?volver=${encodeURIComponent(volver)}` : ''}` },
    });
    if (e1) setError(traducir(e1.message));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-ink shadow-fin">
          <Marca className="size-9" claro />
        </span>
        <h1 className="mt-5 text-[24px] font-bold tracking-tight">{registro ? 'Crea tu cuenta' : 'Finanzas Hogar'}</h1>
        <p className="mt-1 max-w-[320px] text-[14px] text-muted">
          {registro
            ? 'Es la primera vez: crea tu cuenta. Luego creas tus cuadernos e invitas a quien quieras.'
            : 'Inicia sesión para ver y registrar las finanzas del hogar.'}
        </p>
      </div>

      <section className="mt-7 rounded-3xl bg-surface p-5 shadow-card lg:p-6">
        {!config ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Esqueleto className="h-[72px]" />
            <Esqueleto className="h-[72px]" />
            <Esqueleto className="h-12" />
          </div>
        ) : (
          <form onSubmit={entrar} className="flex flex-col gap-4" noValidate>
            {registro && (
              <Campo etiqueta="Tu nombre" htmlFor="l-nombre">
                <Entrada id="l-nombre" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" placeholder="Ej: Jaime" maxLength={60} required />
              </Campo>
            )}
            <Campo etiqueta="Correo" htmlFor="l-correo">
              <Entrada id="l-correo" type="email" inputMode="email" value={correo} onChange={e => setCorreo(e.target.value)}
                autoComplete={registro ? 'email' : 'username'} placeholder="tu@correo.com" autoFocus required />
            </Campo>
            <Campo etiqueta="Contraseña" htmlFor="l-contrasena" ayuda={registro ? 'Mínimo 8 caracteres.' : undefined}>
              <div className="relative">
                <Entrada id="l-contrasena" type={ver ? 'text' : 'password'} value={contrasena} onChange={e => setContrasena(e.target.value)}
                  autoComplete={registro ? 'new-password' : 'current-password'} className="pr-12" minLength={registro ? 8 : undefined} required />
                <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}
                  className="foco absolute inset-y-0 right-0 grid w-12 place-items-center rounded-2xl text-muted hover:text-ink">
                  {ver ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
            </Campo>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-neg-soft p-3 text-[13px] font-semibold text-neg-text">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}

            <BotonPrimario type="submit" disabled={enviando || !correo || !contrasena || (registro && !nombre.trim())} className="mt-1 w-full">
              {enviando ? (registro ? 'Creando la cuenta…' : 'Entrando…') : registro ? 'Crear cuenta y entrar' : 'Entrar'}
            </BotonPrimario>

            {config.google && !registro && (
              <>
                <div className="flex items-center gap-3 text-[12px] text-muted" aria-hidden>
                  <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
                </div>
                <BotonSecundario onClick={conGoogle} className="w-full">Continuar con Google</BotonSecundario>
              </>
            )}
          </form>
        )}
      </section>

      <p className="mx-auto mt-5 max-w-[340px] text-center text-[12px] text-muted">
        <LockKeyhole className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
        {registro ? 'Las demás personas entran con una invitación a un cuaderno.' : '¿Olvidaste la contraseña? Pídele a quien administra la app una nueva.'}
      </p>
    </main>
  );
}
