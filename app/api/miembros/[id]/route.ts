import { cuerpo, responder } from '@/lib/servidor/http';
import { actualizarMiembro } from '@/lib/servidor/miembros';

type Ctx = { params: Promise<{ id: string }> };

/** Tu nombre o tu contraseña { nombre?, contrasena? }. Quien administra la app puede poner contraseñas nuevas. */
export async function PATCH(req: Request, ctx: Ctx) {
  return responder(async () => actualizarMiembro((await ctx.params).id, await cuerpo(req)), { permiso: 'lector', comoApp: false });
}
