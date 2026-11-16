// Cuentas por correo con Supabase Auth: confirmar la cuenta nueva, unirse a la app con un enlace y
// recuperar la contraseña. Los correos los manda Supabase con las plantillas de supabase/plantillas-correo: cada
// enlace lleva a /auth/confirmar?token_hash=…&type=…, que abre la sesión en el servidor (sirve aunque
// el correo se abra en otro dispositivo).
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configSupabase } from '../supabase/config';
import { supabaseAdmin } from '../supabase/servidor';
import { ejecutar, una } from './db';
import { contrasenaDe, cuentaAuth, nombreDe } from './miembros';
import { ErrorAcceso, olvidarMiembros, type Quien } from './sesion';

type Fila = Record<string, unknown>;

/** Cliente público sin sesión guardada: pide los correos de confirmación y de recuperación. */
function publico(): SupabaseClient {
  const { url, clave } = configSupabase();
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' } });
}

/** A dónde vuelve el enlace del correo (debe estar en Auth → URL Configuration → Redirect URLs). */
export const urlConfirmar = (origen: string) => `${origen}/auth/confirmar`;

export const correoDe = (v: unknown) => {
  const c = String(v ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new Error('Escribe un correo válido');
  return c;
};

export function traducirAuth(msg: string) {
  if (/weak|password should/i.test(msg)) return 'La contraseña es muy débil: usa al menos 8 caracteres con letras y números';
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Se enviaron muchos correos seguidos. Espera unos minutos e intenta de nuevo';
  if (/not authorized/i.test(msg)) return 'Supabase aún no puede enviar correos a ese correo: falta configurar el envío de correos (SMTP) en Supabase';
  if (/sending|smtp|email.*(send|deliver)/i.test(msg)) return 'Supabase no pudo enviar el correo. Revisa la configuración del correo (SMTP) en Supabase';
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'Ese correo no es válido';
  return msg;
}

/** Errores de Supabase cuando no pudo mandar el correo */
const NO_SALIO = /sending|smtp|not authorized|email.*(send|deliver)/i;
const LIMITE = /rate limit|too many|security purposes/i;

const CUENTA_EXISTE ='Ese correo ya tiene cuenta: entra con tu contraseña (o recupérala desde el inicio de sesión)';

/**
 * Crea una cuenta que se confirma por correo. Si en Supabase está desactivado "Confirm email", queda
 * confirmada de una vez. → { id, confirmada }
 */
export async function crearCuentaConCorreo(correo: string, contrasena: string, nombre: string, origen: string) {
  const { data, error } = await publico().auth.signUp({
    email: correo, password: contrasenaDe(contrasena),
    options: { emailRedirectTo: urlConfirmar(origen), data: { nombre } },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new ErrorAcceso(CUENTA_EXISTE, 409, 'cuenta-existe');
    // El correo no salió (sin SMTP propio Supabase solo escribe al equipo del proyecto y unos pocos
    // correos por hora): para no dejar a la persona por fuera, la cuenta se crea ya confirmada, como antes.
    if (NO_SALIO.test(error.message) || LIMITE.test(error.message)) return { id: await cuentaAuth(correo, contrasena, nombre), confirmada: true };
    throw new Error(traducirAuth(error.message));
  }
  // Un correo ya confirmado devuelve un usuario sin identidades (Supabase no revela que existe)
  if (!data.user || !data.user.identities?.length) throw new ErrorAcceso(CUENTA_EXISTE, 409, 'cuenta-existe');
  return { id: data.user.id, confirmada: !!data.session || !!data.user.email_confirmed_at };
}

/** Vuelve a mandar el correo para confirmar la cuenta. */
export async function reenviarConfirmacion(b: Fila, origen: string) {
  const { error } = await publico().auth.resend({ type: 'signup', email: correoDe(b.correo), options: { emailRedirectTo: urlConfirmar(origen) } });
  if (error) throw new Error(traducirAuth(error.message));
}

/** Manda el correo para poner una contraseña nueva. No dice si el correo tiene cuenta. */
export async function recuperarContrasena(b: Fila, origen: string) {
  const { error } = await publico().auth.resetPasswordForEmail(correoDe(b.correo), { redirectTo: urlConfirmar(origen) });
  if (error && (/rate limit|too many|security purposes/i.test(error.message) || NO_SALIO.test(error.message))) throw new Error(traducirAuth(error.message));
}

/* ---------- Enlaces para unirse a la app ---------- */
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
type Enlace = { id: number; invitado_por: string | null; usado: string | null; vencido: boolean };
const enlacePorToken = (token: string) => TOKEN.test(token)
  ? una<Enlace>(`SELECT e.id, m.nombre AS invitado_por, e.usado, e.vence <= now() AS vencido
      FROM enlaces_app e LEFT JOIN miembros m ON m.usuario_id = e.creado_por WHERE e.token = ?`, token)
  : Promise.resolve(undefined);

/**
 * Crea un enlace para que alguien nuevo se una a la app con su propia cuenta (sin cuadernos: no ve
 * los de quien invita). Sirve para una persona y vence a los 7 días.
 */
export async function crearEnlace(q: Quien, origen: string) {
  const token = randomBytes(24).toString('base64url');
  await ejecutar('INSERT INTO enlaces_app (token, creado_por) VALUES (?, ?)', token, q.id);
  return { enlace: `${origen}/unirse/${token}` };
}

/** Lo que muestra la página del enlace (pública: el token es el secreto). */
export async function infoEnlace(token: string, sesion: { id: string; correo: string } | null) {
  const e = await enlacePorToken(token);
  if (!e) return null;
  const miembro = !!sesion && !!(await una('SELECT 1 FROM miembros WHERE usuario_id = ? AND activo', sesion.id));
  return {
    invitado_por: e.invitado_por,
    estado: (e.usado ? 'usado' : e.vencido ? 'vencido' : 'pendiente') as 'usado' | 'vencido' | 'pendiente',
    sesion: sesion ? { correo: sesion.correo, miembro } : null,
  };
}

const darAcceso = async (id: string, nombre: string, correo: string) => {
  await ejecutar(`INSERT INTO miembros (usuario_id, nombre, correo) VALUES (?, ?, ?)
    ON CONFLICT (usuario_id) DO UPDATE SET activo = true`, id, nombre, correo);
  olvidarMiembros();
};

/**
 * Se une a la app con el enlace. Sin sesión crea la cuenta { nombre, correo, contrasena }, que se
 * confirma por correo si Supabase lo pide. Con sesión (ya tenía cuenta en Supabase pero no en la app)
 * solo le da acceso. → { confirmar, correo }
 */
export async function unirseConEnlace(token: string, sesion: { id: string; correo: string } | null, b: Fila, origen: string) {
  const e = await enlacePorToken(token);
  if (!e) throw new Error('Este enlace no existe');
  if (sesion && await una('SELECT 1 FROM miembros WHERE usuario_id = ? AND activo', sesion.id)) return { confirmar: false, correo: sesion.correo };
  if (e.usado) throw new Error('Este enlace ya se usó. Pide uno nuevo a quien te invitó');
  if (e.vencido) throw new Error('Este enlace venció. Pide uno nuevo a quien te invitó');
  const nombre = nombreDe(b.nombre);
  const correo = sesion?.correo ?? correoDe(b.correo);
  if (!sesion && await una('SELECT 1 FROM miembros WHERE lower(correo) = ?', correo)) throw new ErrorAcceso(CUENTA_EXISTE, 409, 'cuenta-existe');
  const contrasena = sesion ? '' : contrasenaDe(b.contrasena);
  // Se aparta el enlace antes de crear la cuenta: así no lo usan dos personas a la vez
  const apartado = await una("UPDATE enlaces_app SET usado = now() WHERE id = ? AND usado IS NULL AND vence > now() RETURNING id", e.id);
  if (!apartado) throw new Error('Este enlace ya se usó. Pide uno nuevo a quien te invitó');
  try {
    const cuenta = sesion ? { id: sesion.id, confirmada: true } : await crearCuentaConCorreo(correo, contrasena, nombre, origen);
    await darAcceso(cuenta.id, nombre, correo);
    await ejecutar('UPDATE enlaces_app SET usado_por = ? WHERE id = ?', cuenta.id, e.id);
    return { confirmar: !cuenta.confirmada, correo };
  } catch (err) {
    await ejecutar('UPDATE enlaces_app SET usado = NULL WHERE id = ?', e.id);
    throw err;
  }
}

/** Con la sesión abierta por el enlace del correo de recuperación: pone la contraseña nueva. */
export async function ponerContrasena(sesion: { id: string; correo: string }, b: Fila) {
  const { error } = await supabaseAdmin().auth.admin.updateUserById(sesion.id, { password: contrasenaDe(b.contrasena) });
  if (error) throw new Error(traducirAuth(error.message));
}

/** El origen de la app para armar los enlaces de los correos (en Vercel, el dominio público). */
export function origenDe(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (env) return env;
  const u = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') ?? u.host;
  const proto = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '');
  return `${proto}://${host}`;
}
