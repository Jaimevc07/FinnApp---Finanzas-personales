// Quién hace cada petición y en qué cuaderno: sesión de Supabase Auth + cuenta de la app + permiso en el cuaderno.
import { AsyncLocalStorage } from 'node:async_hooks';
import { cookies, headers } from 'next/headers';
import { supabaseServidor } from '../supabase/servidor';
import type { Permiso } from '../tipos';
import { una } from './db';

export type CuadernoActual = { id: number; nombre: string; icono: string | null; permiso: Permiso };
export type Quien = { id: string; nombre: string; correo: string; rol: 'admin' | 'miembro'; cuaderno?: CuadernoActual };

/** Por qué no se puede: sin sesión, sin cuenta en la app, sin cuaderno elegido, sin acceso al cuaderno o sin permiso. */
export type CodigoAcceso = 'sin-sesion' | 'sin-cuenta' | 'elige-cuaderno' | 'sin-cuaderno' | 'sin-permiso' | 'cuenta-existe';

export class ErrorAcceso extends Error {
  constructor(mensaje: string, public estado: 401 | 403 | 409, public codigo: CodigoAcceso = estado === 401 ? 'sin-sesion' : 'sin-permiso') {
    super(mensaje);
  }
}

/** Nombre de la cookie con el cuaderno elegido en este navegador. */
export const COOKIE_CUADERNO = 'fh-cuaderno';

// Next empaqueta cada ruta por separado: el estado compartido vive en globalThis para que todas
// las rutas del mismo proceso vean lo mismo (p. ej. al quitarle el acceso a alguien).
const g = globalThis as unknown as {
  __finanzasPeticion?: AsyncLocalStorage<Quien>;
  __finanzasMiembros?: Map<string, { q: Quien | null; hasta: number }>;
  __finanzasPermisos?: Map<string, { c: CuadernoActual | null; hasta: number }>;
};

// Durante una petición, quien la hizo y en qué cuaderno (para guardar "quién hizo qué").
const enPeticion = (g.__finanzasPeticion ??= new AsyncLocalStorage<Quien>());
export const quien = (): Quien | null => enPeticion.getStore() ?? null;
export const comoMiembro = <T>(q: Quien, fn: () => Promise<T>) => enPeticion.run(q, fn);

// Cuentas y permisos se recuerdan 30 s por instancia para no consultar la base en cada petición.
const recordados = (g.__finanzasMiembros ??= new Map());
const permisos = (g.__finanzasPermisos ??= new Map());
export const olvidarMiembros = () => { recordados.clear(); permisos.clear(); };

/** La cuenta de la sesión actual. Sin sesión → 401; con sesión pero sin cuenta activa en la app → 403. */
export async function miembroActual(): Promise<Quien> {
  const { data, error } = await (await supabaseServidor()).auth.getClaims();
  const id = data?.claims?.sub;
  if (error || !id) throw new ErrorAcceso('Inicia sesión para continuar', 401);
  const r = recordados.get(id);
  let q = r && r.hasta > Date.now() ? r.q : undefined;
  if (q === undefined) {
    q = (await una<Quien>('SELECT usuario_id::text AS id, nombre, correo, rol FROM miembros WHERE usuario_id = ? AND activo', id)) ?? null;
    recordados.set(id, { q, hasta: Date.now() + 30_000 });
  }
  if (!q) throw new ErrorAcceso('Esta cuenta no tiene acceso a la app. Pide una invitación a un cuaderno.', 403, 'sin-cuenta');
  return q;
}

/** Sesión sin exigir cuenta (p. ej. para aceptar una invitación con la sesión abierta). */
export async function sesionOpcional(): Promise<{ id: string; correo: string } | null> {
  const { data } = await (await supabaseServidor()).auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub, correo: String(c.email ?? '').toLowerCase() } : null;
}

/**
 * Cuaderno de la petición: el encabezado x-cuaderno (lo manda la app, así cada pestaña sigue en el
 * suyo) o, si no viene (descargas), la cookie del cuaderno elegido. Exige ser miembro activo.
 */
export async function cuadernoActual(q: Quien): Promise<CuadernoActual> {
  const h = await headers();
  const crudo = h.get('x-cuaderno') ?? (await cookies()).get(COOKIE_CUADERNO)?.value;
  const id = Number(crudo);
  if (!crudo || !Number.isInteger(id) || id <= 0) throw new ErrorAcceso('Elige un cuaderno', 409, 'elige-cuaderno');
  const clave = `${q.id}:${id}`;
  const r = permisos.get(clave);
  let c = r && r.hasta > Date.now() ? r.c : undefined;
  if (c === undefined) {
    c = (await una<CuadernoActual>(`SELECT c.id, c.nombre, c.icono, cm.permiso FROM cuaderno_miembros cm
      JOIN cuadernos c ON c.id = cm.cuaderno_id WHERE cm.cuaderno_id = ? AND cm.usuario_id = ? AND cm.activo`, id, q.id)) ?? null;
    permisos.set(clave, { c, hasta: Date.now() + 30_000 });
  }
  if (!c) throw new ErrorAcceso('No tienes acceso a este cuaderno', 403, 'sin-cuaderno');
  return c;
}

const NIVEL: Record<Permiso, number> = { lector: 1, editor: 2, propietario: 3 };

/** Exige al menos un permiso en el cuaderno de la petición. */
export function exigirPermiso(c: CuadernoActual, minimo: Permiso) {
  if (NIVEL[c.permiso] >= NIVEL[minimo]) return;
  throw new ErrorAcceso(minimo === 'propietario'
    ? 'Solo quien es propietario del cuaderno puede hacer esto'
    : 'Este cuaderno es de solo lectura para ti: puedes ver todo, pero no editar', 403, 'sin-permiso');
}
