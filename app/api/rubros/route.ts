import { cuerpo, responder } from '@/lib/servidor/http';
import { crearRubro } from '@/lib/servidor/repo';

/** { categoria_id, nombre, saldo?, saldo_usd?, tasa?, valores?: { 'AAAA-MM': valor }, autos?: ['AAAA-MM'] } */
export async function POST(req: Request) {
  return responder(async () => { await crearRubro(await cuerpo(req)); });
}
