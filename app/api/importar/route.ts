import { cuerpo, responder } from '@/lib/servidor/http';
import { importar } from '@/lib/servidor/repo';
import type { Estado } from '@/lib/tipos';

export async function POST(req: Request) {
  return responder(async () => importar((await cuerpo(req)) as unknown as Estado));
}
