import { cuerpo, responder } from '@/lib/servidor/http';
import { copiarMes } from '@/lib/servidor/repo';

/** { desde: 'AAAA-MM', hacia: 'AAAA-MM', secciones: ['ingreso','operativo',…] } */
export async function POST(req: Request) {
  return responder(async () => {
    const b = await cuerpo(req);
    await copiarMes(String(b.desde), String(b.hacia), Array.isArray(b.secciones) ? b.secciones.map(String) : []);
  });
}
