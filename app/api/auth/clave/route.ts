// Con la sesión que abre un enlace del correo: datos de la bienvenida (GET) y poner la contraseña (POST).
import { datosBienvenida, ponerContrasena } from '@/lib/servidor/correo';
import { cuerpo, json, respuestaDeError } from '@/lib/servidor/http';
import { ErrorAcceso, sesionOpcional } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';

async function exigirSesion() {
  const s = await sesionOpcional();
  if (!s) throw new ErrorAcceso('El enlace venció. Pide uno nuevo.', 401);
  return s;
}

export async function GET() {
  try {
    return json(await datosBienvenida(await exigirSesion()));
  } catch (e) {
    return respuestaDeError(e);
  }
}

export async function POST(req: Request) {
  try {
    await ponerContrasena(await exigirSesion(), await cuerpo(req));
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
