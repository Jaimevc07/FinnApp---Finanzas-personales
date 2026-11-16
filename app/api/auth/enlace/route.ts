// Invitar a la app: crea un enlace para que alguien nuevo se una con su propia cuenta.
// Cualquier persona con cuenta puede crearlo.
import { crearEnlace, origenDe } from '@/lib/servidor/correo';
import { conCuenta, json } from '@/lib/servidor/http';

export async function POST(req: Request) {
  return conCuenta(async q => json(await crearEnlace(q, origenDe(req))));
}
