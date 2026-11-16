import { cuerpo, idDe, responder, type CtxId } from '@/lib/servidor/http';
import { actualizarMeta, borrarMeta } from '@/lib/servidor/repo';

export async function PATCH(req: Request, ctx: CtxId) {
  return responder(async () => actualizarMeta(await idDe(ctx), await cuerpo(req)));
}

/** Borra la meta y su rubro de aportes. */
export async function DELETE(_req: Request, ctx: CtxId) {
  return responder(async () => borrarMeta(await idDe(ctx)));
}
