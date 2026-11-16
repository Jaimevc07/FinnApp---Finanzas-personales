import { cuerpo, idDe, responder, type CtxId } from '@/lib/servidor/http';
import { actualizarRubro, eliminarRubro } from '@/lib/servidor/repo';

export async function PATCH(req: Request, ctx: CtxId) {
  return responder(async () => actualizarRubro(await idDe(ctx), await cuerpo(req)));
}

export async function DELETE(_req: Request, ctx: CtxId) {
  return responder(async () => eliminarRubro(await idDe(ctx)));
}
