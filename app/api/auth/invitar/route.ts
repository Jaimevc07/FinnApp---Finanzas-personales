// Invitar a alguien nuevo a la app (no a un cuaderno). Cualquier persona con cuenta puede invitar.
import { invitarALaApp, origenDe } from '@/lib/servidor/correo';
import { conCuenta, cuerpo, json } from '@/lib/servidor/http';

export async function POST(req: Request) {
  const b = await cuerpo(req);
  return conCuenta(async q => json(await invitarALaApp(q, b, origenDe(req))));
}
