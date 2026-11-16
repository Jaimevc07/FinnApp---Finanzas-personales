import { cuerpo, idDe, responder, type CtxId } from '@/lib/servidor/http';
import { pausarMeta, reanudarMeta } from '@/lib/servidor/repo';

/** Pausa la meta desde un mes: { desde: 'AAAA-MM' } */
export async function POST(req: Request, ctx: CtxId) {
  return responder(async () => pausarMeta(await idDe(ctx), await cuerpo(req)));
}

/** Reanuda la meta: { desde: 'AAAA-MM', aporte: número } */
export async function DELETE(req: Request, ctx: CtxId) {
  return responder(async () => reanudarMeta(await idDe(ctx), await cuerpo(req)));
}
