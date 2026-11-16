import { estadoCompleto } from '@/lib/servidor/cuadernos';
import { conCuaderno, json } from '@/lib/servidor/http';

export const dynamic = 'force-dynamic';

/** Todos los datos del cuaderno de la petición, con su gente y el permiso de quien los ve. */
export function GET() {
  return conCuaderno(async (q, c) => json(await estadoCompleto(q, c)));
}
