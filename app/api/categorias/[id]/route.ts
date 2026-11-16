import { cuerpo, idDe, responder, type CtxId } from '@/lib/servidor/http';
import { actualizarCategoria, borrarCategoria } from '@/lib/servidor/repo';

export async function PATCH(req: Request, ctx: CtxId) {
  return responder(async () => actualizarCategoria(await idDe(ctx), await cuerpo(req)));
}

/** Borra la categoría y todos sus rubros. */
export async function DELETE(_req: Request, ctx: CtxId) {
  return responder(async () => borrarCategoria(await idDe(ctx)));
}
