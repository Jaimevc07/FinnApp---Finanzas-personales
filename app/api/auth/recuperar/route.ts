// Pública: manda el correo para poner una contraseña nueva. Responde igual exista o no la cuenta.
import { origenDe, recuperarContrasena } from '@/lib/servidor/correo';
import { cuerpo, json, respuestaDeError } from '@/lib/servidor/http';

export async function POST(req: Request) {
  try {
    await recuperarContrasena(await cuerpo(req), origenDe(req));
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
