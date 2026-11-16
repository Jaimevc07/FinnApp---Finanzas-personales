import { cuerpo, responder } from '@/lib/servidor/http';
import { vaciarMes } from '@/lib/servidor/repo';

/** { periodo: 'AAAA-MM', secciones: ['operativo','ahorro',…] } → deja esos valores del mes en $ 0 */
export async function POST(req: Request) {
  return responder(async () => {
    const b = await cuerpo(req);
    await vaciarMes(String(b.periodo), Array.isArray(b.secciones) ? b.secciones.map(String) : []);
  });
}
