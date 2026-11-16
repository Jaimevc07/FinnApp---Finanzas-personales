// Pública: la página del enlace para unirse a la app. El token es el secreto.
import { infoEnlace, origenDe, unirseConEnlace } from '@/lib/servidor/correo';
import { cuerpo, json, respuestaDeError } from '@/lib/servidor/http';
import { sesionOpcional } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const info = await infoEnlace((await ctx.params).token, await sesionOpcional());
    if (!info) return json({ error: 'El enlace no existe' }, 404);
    return json(info);
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** Unirse: { nombre, correo, contrasena } (o con sesión, { nombre }). → { confirmar, correo } */
export async function POST(req: Request, ctx: Ctx) {
  try {
    return json(await unirseConEnlace((await ctx.params).token, await sesionOpcional(), await cuerpo(req), origenDe(req)));
  } catch (e) {
    return respuestaDeError(e);
  }
}
