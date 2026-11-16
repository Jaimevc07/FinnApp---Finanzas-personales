import { cuerpo, responder } from '@/lib/servidor/http';
import { guardarConfig } from '@/lib/servidor/repo';

export async function PUT(req: Request) {
  return responder(async () => guardarConfig(await cuerpo(req)), false);
}
