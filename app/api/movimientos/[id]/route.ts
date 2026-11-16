import { cuerpo, idDe, responder, type CtxId } from '@/lib/servidor/http';
import { actualizar, borrar } from '@/lib/servidor/repo';

export async function PATCH(req: Request, ctx: CtxId) {
  return responder(async () => actualizar('movimientos', await idDe(ctx), await cuerpo(req)));
}

export async function DELETE(_req: Request, ctx: CtxId) {
  return responder(async () => borrar('movimientos', await idDe(ctx)));
}
