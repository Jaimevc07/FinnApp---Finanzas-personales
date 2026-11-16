'use client';
// Después de abrir un enlace del correo: la bienvenida de quien fue invitado a la app (nombre y
// contraseña) o poner una contraseña nueva (recuperar).
import { CircleAlert, Eye, EyeOff, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { primerNombre } from '@/lib/miembros';
import { BotonPrimario } from './ui/botones';
import { Campo, Entrada } from './ui/campos';
import { Esqueleto } from './ui/estructura';
import { Marca } from './ui/marca';

type Datos = { correo: string; nombre: string; invitado_por: string | null; acceso: boolean };

export function PonerClave({ modo }: { modo: 'bienvenida' | 'restablecer' }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [sinSesion, setSinSesion] = useState(false);
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const bienvenida = modo === 'bienvenida';

  useEffect(() => {
    fetch('/api/auth/clave', { cache: 'no-store' })
      .then(async r => {
        if (r.status === 401) { setSinSesion(true); return; }
        const d = await r.json();
        setDatos(d);
        setNombre(d.nombre ?? '');
      })
      .catch(() => setSinSesion(true));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (bienvenida && !nombre.trim()) return setError('Escribe tu nombre');
    if (contrasena.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/clave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bienvenida ? { nombre: nombre.trim(), contrasena } : { contrasena }),
      });
      const d = await r.json().catch(() => ({}));
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
        <h1 className="mt-5 text-[24px] font-bold tracking-tight">{bienvenida ? 'Te damos la bienvenida' : 'Contraseña nueva'}</h1>
        <p className="mt-1 max-w-[320px] text-[14px] text-muted">
          {bienvenida
            ? <>{datos?.invitado_por ? `${primerNombre(datos.invitado_por)} te invitó a Finanzas Hogar. ` : ''}Crea tu contraseña para entrar cuando quieras.</>
            : 'Escribe la contraseña con la que vas a entrar de ahora en adelante.'}
        </p>
      </div>

      <section className="mt-7 rounded-3xl bg-surface p-5 shadow-card lg:p-6">
        {sinSesion ? (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-ink-2">El enlace venció o ya se usó. {bienvenida ? 'Pide a quien te invitó que te envíe uno nuevo.' : 'Pide otro desde «¿Olvidaste tu contraseña?».'}</p>
            <BotonPrimario href="/login" className="w-full">Ir a iniciar sesión</BotonPrimario>
          </div>
        ) : !datos ? (
          <div className="flex flex-col gap-4" aria-busy="true"><Esqueleto className="h-[72px]" /><Esqueleto className="h-[72px]" /><Esqueleto className="h-12" /></div>
        ) : !datos.acceso ? (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-ink-2">La cuenta {datos.correo} no tiene acceso a la app. Pide a alguien que te invite.</p>
            <BotonPrimario href="/login" className="w-full">Ir a iniciar sesión</BotonPrimario>
          </div>
        ) : (
          <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
            <p className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-[13px] text-ink-2">
              <Mail className="size-4 shrink-0 text-muted" /> <span className="min-w-0 truncate">{datos.correo}</span>
            </p>
            {bienvenida && (
              <Campo etiqueta="Tu nombre" htmlFor="cl-nombre">
                <Entrada id="cl-nombre" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" maxLength={60} placeholder="Ej: María" />
              </Campo>
            )}
            <Campo etiqueta={bienvenida ? 'Crea una contraseña' : 'Contraseña nueva'} htmlFor="cl-contrasena" ayuda="Mínimo 8 caracteres.">
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
              {enviando ? 'Guardando…' : bienvenida ? 'Crear contraseña y entrar' : 'Guardar y entrar'}
            </BotonPrimario>
          </form>
        )}
      </section>
    </main>
  );
}
