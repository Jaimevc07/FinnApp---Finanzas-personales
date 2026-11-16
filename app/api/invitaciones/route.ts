import { invitar } from '@/lib/servidor/cuadernos';
import { cuerpo, responder } from '@/lib/servidor/http';

/** Invita a alguien al cuaderno actual: { correo, permiso: 'editor' | 'lector' } (solo propietario). */
export async function POST(req: Request) {
  return responder(async () => invitar(await cuerpo(req)), { permiso: 'propietario', comoApp: false });
}
