import { salirDelCuaderno } from '@/lib/servidor/cuadernos';
import { conCuaderno, json } from '@/lib/servidor/http';

/** Salir del cuaderno actual (deja de verlo; sus registros conservan su nombre). */
export function POST() {
  return conCuaderno(async (q, c) => {
    await salirDelCuaderno(q, c);
    return json({ ok: true });
  });
}
