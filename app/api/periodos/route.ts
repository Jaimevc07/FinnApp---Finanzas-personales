import { cuerpo, responder } from '@/lib/servidor/http';
import { agregarPeriodo, borrarPeriodo } from '@/lib/servidor/repo';

/** { posicion: 'anterior' | 'siguiente' } · anterior = antes del primer mes (en $ 0), siguiente = copia el último */
export async function POST(req: Request) {
  return responder(async () => {
    const b = await cuerpo(req);
    await agregarPeriodo(b.posicion === 'anterior' ? 'anterior' : 'siguiente');
  });
}

/** ?cual=primero | ultimo (por defecto el último) */
export async function DELETE(req: Request) {
  return responder(() => borrarPeriodo(new URL(req.url).searchParams.get('cual') === 'primero' ? 'primero' : 'ultimo'));
}
