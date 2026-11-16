// Pública: la página del enlace de invitación. El token es el secreto.
import { aceptarPorToken, infoInvitacion } from '@/lib/servidor/cuadernos';
import { cuerpo, json, respuestaDeError } from '@/lib/servidor/http';
import { sesionOpcional } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const info = await infoInvitacion((await ctx.params).token);
    if (!info) return json({ error: 'La invitación no existe' }, 404);
    const sesion = await sesionOpcional();
    return json({ ...info, sesion: sesion ? { correo: sesion.correo } : null });
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** Aceptar: con sesión (mismo correo) o creando la cuenta { nombre, contrasena }. → { cuadernoId } */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const cuadernoId = await aceptarPorToken((await ctx.params).token, await sesionOpcional(), await cuerpo(req));
    return json({ cuadernoId });
  } catch (e) {
    return respuestaDeError(e);
  }
}
