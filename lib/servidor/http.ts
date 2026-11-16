// Envoltorio común de las rutas API: valida la sesión, el cuaderno y el permiso, ejecuta la acción
// dentro del cuaderno como ese miembro (para guardar quién hizo qué) y responde con el estado completo.
import type { Permiso } from '../tipos';
import { estadoCompleto } from './cuadernos';
import { enCuaderno } from './db';
import {
  comoMiembro, cuadernoActual, ErrorAcceso, exigirPermiso, miembroActual, type CuadernoActual, type Quien,
} from './sesion';

export async function cuerpo(req: Request): Promise<Record<string, unknown>> {
  const txt = await req.text();
  if (txt.length > 2_000_000) throw new Error('Archivo demasiado grande');
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    throw new Error('JSON no válido');
  }
}

const SIN_CACHE = { 'Cache-Control': 'no-store' };
export const json = (datos: unknown, estado = 200) => Response.json(datos, { status: estado, headers: SIN_CACHE });

export function respuestaDeError(e: unknown) {
  if (e instanceof ErrorAcceso) return json({ error: e.message, codigo: e.codigo }, e.estado);
  const msg = e instanceof Error ? e.message : 'Error inesperado';
  console.error('[api]', msg);
  return json({ error: msg }, 400);
}

type Opciones = {
  /** Responder con el estado completo (por defecto) o solo { ok } (guardados frecuentes) */
  estado?: boolean;
  /** Permiso mínimo en el cuaderno (por defecto: editor) */
  permiso?: Permiso;
  /** false = la acción administra el cuaderno (miembros, invitaciones) con el usuario del servidor */
  comoApp?: boolean;
};

/** Ejecuta una acción en el cuaderno de la petición y responde con su estado (o { ok }). */
export async function responder(fn: () => unknown | Promise<unknown>, o: boolean | Opciones = {}) {
  const opc: Opciones = typeof o === 'boolean' ? { estado: o } : o;
  try {
    const q = await miembroActual();
    const c = await cuadernoActual(q);
    exigirPermiso(c, opc.permiso ?? 'editor');
    await comoMiembro({ ...q, cuaderno: c }, () => enCuaderno(c.id, async () => { await fn(); }, opc.comoApp ?? true));
    if (opc.estado === false) return json({ ok: true });
    // El nombre o el permiso pudieron cambiar con la acción: se vuelven a leer
    const actual = await cuadernoActual(q).catch(() => c);
    return json(await estadoCompleto(q, actual));
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** Lecturas del cuaderno de la petición (permiso mínimo: lector). */
export async function conCuaderno(fn: (q: Quien, c: CuadernoActual) => Promise<Response>, permiso: Permiso = 'lector') {
  try {
    const q = await miembroActual();
    const c = await cuadernoActual(q);
    exigirPermiso(c, permiso);
    return await comoMiembro({ ...q, cuaderno: c }, () => fn(q, c));
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** Rutas de la cuenta, sin cuaderno (pre-vista, invitaciones recibidas). */
export async function conCuenta(fn: (q: Quien) => Promise<Response>) {
  try {
    const q = await miembroActual();
    return await comoMiembro(q, () => fn(q));
  } catch (e) {
    return respuestaDeError(e);
  }
}

export type CtxId = { params: Promise<{ id: string }> };

export async function idDe(ctx: CtxId) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw new Error('Id no válido');
  return id;
}
