import { cancelarInvitacion, responderInvitacion } from '@/lib/servidor/cuadernos';
import { conCuenta, cuerpo, idDe, json, responder, type CtxId } from '@/lib/servidor/http';

/** Cancelar una invitación del cuaderno actual (solo propietario). */
export async function DELETE(_req: Request, ctx: CtxId) {
  return responder(async () => cancelarInvitacion(await idDe(ctx)), { permiso: 'propietario', comoApp: false });
}

/** Responder una invitación recibida (desde la pre-vista): { aceptar: boolean } → { cuadernoId } */
export async function POST(req: Request, ctx: CtxId) {
  return conCuenta(async q => {
    const b = await cuerpo(req);
    return json({ cuadernoId: await responderInvitacion(q, await idDe(ctx), !!b.aceptar) });
  });
}
