// Con la sesión que abre el enlace del correo de recuperación: poner la contraseña nueva.
import { ponerContrasena } from '@/lib/servidor/correo';
import { cuerpo, json, respuestaDeError } from '@/lib/servidor/http';
import { ErrorAcceso, sesionOpcional } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const s = await sesionOpcional();
    if (!s) throw new ErrorAcceso('El enlace venció. Pide uno nuevo.', 401);
    await ponerContrasena(s, await cuerpo(req));
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
