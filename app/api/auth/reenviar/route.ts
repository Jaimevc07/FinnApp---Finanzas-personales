// Pública: vuelve a mandar el correo para confirmar una cuenta nueva.
import { origenDe, reenviarConfirmacion } from '@/lib/servidor/correo';
import { cuerpo, json, respuestaDeError } from '@/lib/servidor/http';

export async function POST(req: Request) {
  try {
    await reenviarConfirmacion(await cuerpo(req), origenDe(req));
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
