import { idDe, responder, type CtxId } from '@/lib/servidor/http';
import { reiniciarLista } from '@/lib/servidor/repo';

/** Marca todos los productos de la lista como Pendiente. */
export async function POST(_req: Request, ctx: CtxId) {
  return responder(async () => reiniciarLista(await idDe(ctx)));
}
