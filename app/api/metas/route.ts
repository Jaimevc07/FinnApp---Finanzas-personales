import { cuerpo, responder } from '@/lib/servidor/http';
import { crearMeta } from '@/lib/servidor/repo';

/** { nombre, detalle, objetivo, periodo_objetivo, modo: aportes|caja, ahorrado, aportes?: { 'AAAA-MM': valor } } */
export async function POST(req: Request) {
  return responder(async () => crearMeta(await cuerpo(req)));
}
