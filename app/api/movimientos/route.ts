import { cuerpo, responder } from '@/lib/servidor/http';
import { crear } from '@/lib/servidor/repo';

export async function POST(req: Request) {
  return responder(async () => crear('movimientos', await cuerpo(req)));
}
