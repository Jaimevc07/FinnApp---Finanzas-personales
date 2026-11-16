import { cuerpo, responder } from '@/lib/servidor/http';
import { crearCategoria } from '@/lib/servidor/repo';

/** { nombre, seccion: ingreso|operativo|evento|deuda|ahorro, control? } */
export async function POST(req: Request) {
  return responder(async () => crearCategoria(await cuerpo(req)));
}
