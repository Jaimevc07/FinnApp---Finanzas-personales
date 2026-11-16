// Cuentas por correo con Supabase Auth: confirmar la cuenta nueva, invitar a la app y recuperar la
// contraseña. Los correos los manda Supabase con las plantillas de supabase/plantillas-correo: cada
// enlace lleva a /auth/confirmar?token_hash=…&type=…, que abre la sesión en el servidor (sirve aunque
// el correo se abra en otro dispositivo).
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
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

async function buscarUsuario(correo: string): Promise<User | undefined> {
  const admin = supabaseAdmin().auth.admin;
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.listUsers({ page: pagina, perPage: 100 });
    if (error) throw new Error(traducirAuth(error.message));
    const u = data.users.find(x => x.email?.toLowerCase() === correo);
    if (u || data.users.length < 100) return u;
  }
  return undefined;
}

export type ResultadoInvitacionApp =
  | { estado: 'enviado'; correo: string }
  | { estado: 'enlace'; correo: string; enlace: string; motivo: 'reenvio' | 'correo' }
  | { estado: 'ya-tenia'; correo: string };

/**
 * Invita a alguien nuevo a la app (no a un cuaderno): Supabase le manda un correo para crear su cuenta.
 * Si el correo no sale (falta configurar SMTP) o ya se había invitado, devuelve un enlace para
 * enviárselo por WhatsApp o como prefieras. Al entrar, crea su contraseña en /bienvenida.
 */
export async function invitarALaApp(q: Quien, b: Fila, origen: string): Promise<ResultadoInvitacionApp> {
  const nombre = nombreDe(b.nombre), correo = correoDe(b.correo);
  if (await una('SELECT 1 FROM miembros WHERE lower(correo) = ? AND activo AND usuario_id <> ?', correo, q.id)) {
    const confirmado = await buscarUsuario(correo);
    if (confirmado?.email_confirmed_at || confirmado?.last_sign_in_at) throw new Error('Esa persona ya tiene cuenta en la app. Invítala a un cuaderno desde «Personas en este cuaderno».');
  }
  if (correo === q.correo.toLowerCase()) throw new Error('Ese es tu propio correo');
  const admin = supabaseAdmin().auth.admin;
  const datos = { nombre, invitado: true, invitado_por: q.nombre };
  const darAcceso = async (id: string) => {
    await ejecutar(`INSERT INTO miembros (usuario_id, nombre, correo) VALUES (?, ?, ?)
      ON CONFLICT (usuario_id) DO UPDATE SET activo = true`, id, nombre, correo);
    olvidarMiembros();
  };

  // 1. Correo de invitación de Supabase
  const inv = await admin.inviteUserByEmail(correo, { redirectTo: urlConfirmar(origen), data: datos });
  if (inv.data?.user && !inv.error) {
    await darAcceso(inv.data.user.id);
    return { estado: 'enviado', correo };
  }

  // 2. Ya existía en Supabase Auth
  const existente = await buscarUsuario(correo);
  if (existente && (existente.email_confirmed_at || existente.last_sign_in_at)) {
    // Cuenta real (con su contraseña): solo se le da acceso a la app; entra con su correo
    await darAcceso(existente.id);
    return { estado: 'ya-tenia', correo };
  }

  // 3. Invitación pendiente o el correo no salió: enlace para enviarlo a mano
  const tipo = existente ? 'magiclink' : 'invite';
  const link = await admin.generateLink(tipo === 'invite'
    ? { type: 'invite', email: correo, options: { redirectTo: urlConfirmar(origen), data: datos } }
    : { type: 'magiclink', email: correo, options: { redirectTo: urlConfirmar(origen) } });
  if (link.error || !link.data.user) throw new Error(traducirAuth(link.error?.message ?? inv.error?.message ?? 'No se pudo crear la invitación'));
  if (tipo === 'magiclink') await admin.updateUserById(link.data.user.id, { user_metadata: datos });
  await darAcceso(link.data.user.id);
  const enlace = `${urlConfirmar(origen)}?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=${tipo === 'invite' ? 'invite' : 'email'}`;
  return { estado: 'enlace', correo, enlace, motivo: existente ? 'reenvio' : 'correo' };
}

/**
 * Con la sesión abierta por un enlace del correo: pone la contraseña (al recuperarla) y, si viene de
 * una invitación a la app, también el nombre.
 */
export async function ponerContrasena(sesion: { id: string; correo: string }, b: Fila) {
  const m = await una<{ nombre: string }>('SELECT nombre FROM miembros WHERE usuario_id = ? AND activo', sesion.id);
  if (!m) throw new ErrorAcceso('Esta cuenta no tiene acceso a la app. Pide que te inviten.', 403, 'sin-cuenta');
  const contrasena = contrasenaDe(b.contrasena);
  const nombre = b.nombre !== undefined ? nombreDe(b.nombre) : undefined;
  const { error } = await supabaseAdmin().auth.admin.updateUserById(sesion.id, {
    password: contrasena,
    ...(nombre ? { user_metadata: { nombre, invitado: false } } : {}),
  });
  if (error) throw new Error(traducirAuth(error.message));
  if (nombre && nombre !== m.nombre) {
    await ejecutar('UPDATE miembros SET nombre = ? WHERE usuario_id = ?', nombre, sesion.id);
    olvidarMiembros();
  }
}

/** Lo que muestra /bienvenida: el nombre con que lo invitaron y quién. */
export async function datosBienvenida(sesion: { id: string; correo: string }) {
  const { data } = await supabaseAdmin().auth.admin.getUserById(sesion.id);
  const meta = (data.user?.user_metadata ?? {}) as { nombre?: string; invitado_por?: string };
  const m = await una<{ nombre: string }>('SELECT nombre FROM miembros WHERE usuario_id = ? AND activo', sesion.id);
  return { correo: sesion.correo, nombre: m?.nombre ?? meta.nombre ?? '', invitado_por: meta.invitado_por ?? null, acceso: !!m };
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
