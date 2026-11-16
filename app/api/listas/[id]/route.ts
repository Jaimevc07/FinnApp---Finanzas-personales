import { cuerpo, idDe, responder, type CtxId } from '@/lib/servidor/http';
import { actualizarLista, borrarLista } from '@/lib/servidor/repo';

export async function PATCH(req: Request, ctx: CtxId) {
  return responder(async () => actualizarLista(await idDe(ctx), await cuerpo(req)));
}

/** Borra la lista y sus productos. */
export async function DELETE(_req: Request, ctx: CtxId) {
  return responder(async () => borrarLista(await idDe(ctx)));
}
