import { cuerpo, responder } from '@/lib/servidor/http';
import { crear } from '@/lib/servidor/repo';

/** { lista_id, producto, categoria, cantidad, precio, estado } */
export async function POST(req: Request) {
  return responder(async () => crear('items', await cuerpo(req)));
}
