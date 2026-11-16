import { cambiarPersona } from '@/lib/servidor/cuadernos';
import { cuerpo, responder } from '@/lib/servidor/http';

type Ctx = { params: Promise<{ usuario: string }> };

/** Permiso o acceso de alguien en el cuaderno actual: { permiso?, activo? } (solo propietario). */
export async function PATCH(req: Request, ctx: Ctx) {
  return responder(async () => cambiarPersona((await ctx.params).usuario, await cuerpo(req)), { permiso: 'propietario', comoApp: false });
}
