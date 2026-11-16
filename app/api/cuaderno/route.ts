// El cuaderno actual: cambiar nombre o ícono, o eliminarlo con todos sus datos (solo propietario).
import { editarCuaderno, eliminarCuaderno } from '@/lib/servidor/cuadernos';
import { conCuaderno, cuerpo, json, responder } from '@/lib/servidor/http';

export async function PATCH(req: Request) {
  return responder(async () => editarCuaderno(await cuerpo(req)), { permiso: 'propietario', comoApp: false });
}

export function DELETE() {
  return conCuaderno(async (q, c) => {
    await eliminarCuaderno(q, c);
    return json({ ok: true });
  }, 'propietario');
}
