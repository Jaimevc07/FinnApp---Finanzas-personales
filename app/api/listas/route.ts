import { cuerpo, responder } from '@/lib/servidor/http';
import { crearLista } from '@/lib/servidor/repo';

/** { nombre, rubro_id?: número, presupuesto?: número } */
export async function POST(req: Request) {
  return responder(async () => { await crearLista(await cuerpo(req)); });
}
