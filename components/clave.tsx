'use client';
// Después de abrir el enlace del correo de recuperación: poner una contraseña nueva.
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { BotonPrimario } from './ui/botones';
import { Campo, Entrada } from './ui/campos';
import { Marca } from './ui/marca';

export function PonerClave() {
  const [sinSesion, setSinSesion] = useState(false);
  const [contrasena, setContrasena] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (contrasena.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/clave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrasena }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { setSinSesion(true); return; }
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar la contraseña');
      window.location.href = '/cuadernos';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña');
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-ink shadow-fin"><Marca className="size-9" claro /></span>
        <h1 className="mt-5 text-[24px] font-bold tracking-tight">Contraseña nueva</h1>
        <p className="mt-1 max-w-[320px] text-[14px] text-muted">
          Escribe la contraseña con la que vas a entrar de ahora en adelante.
        </p>
      </div>

      <section className="mt-7 rounded-3xl bg-surface p-5 shadow-card lg:p-6">
        {sinSesion ? (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-ink-2">El enlace venció o ya se usó. Pide otro desde «¿Olvidaste tu contraseña?».</p>
            <BotonPrimario href="/login" className="w-full">Ir a iniciar sesión</BotonPrimario>
          </div>
        ) : (
          <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
            <Campo etiqueta="Contraseña nueva" htmlFor="cl-contrasena" ayuda="Mínimo 8 caracteres.">
              <div className="relative">
                <Entrada id="cl-contrasena" type={ver ? 'text' : 'password'} value={contrasena} onChange={e => setContrasena(e.target.value)}
                  autoComplete="new-password" className="pr-12" autoFocus minLength={8} />
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
            <BotonPrimario type="submit" className="w-full" disabled={enviando || !contrasena}>
              {enviando ? 'Guardando…' : 'Guardar y entrar'}
            </BotonPrimario>
          </form>
        )}
      </section>
    </main>
  );
}
