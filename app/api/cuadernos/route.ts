// Pre-vista: los cuadernos de la cuenta y las invitaciones que recibió; crear un cuaderno.
import { crearCuaderno, invitacionesParaMi, misCuadernos } from '@/lib/servidor/cuadernos';
import { conCuenta, cuerpo, json } from '@/lib/servidor/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return conCuenta(async q => {
    const [cuadernos, invitaciones] = await Promise.all([misCuadernos(q), invitacionesParaMi(q)]);
    return json({ yo: q, cuadernos, invitaciones });
  });
}

/** { nombre, icono?, inicio: 'blanco' | 'ejemplo' } → { id } */
export function POST(req: Request) {
  return conCuenta(async q => json({ id: await crearCuaderno(q, await cuerpo(req)) }));
}
