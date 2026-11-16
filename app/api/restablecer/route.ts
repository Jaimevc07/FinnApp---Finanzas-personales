import { cuerpo, responder } from '@/lib/servidor/http';
import { restablecer } from '@/lib/servidor/repo';
import type { ModoRestablecer } from '@/lib/tipos';

/**
 * { modo, conservarMovimientos }
 * - ceros: conserva los nombres (rubros, deudas, metas, productos) y deja todos los montos en $0
 * - vacio: borra rubros, deudas, metas y listas; quedan las categorías y los meses
 * - excel: vuelve a cargar los datos del Visual Board
 */
export async function POST(req: Request) {
  return responder(async () => {
    const b = await cuerpo(req);
    const modo: ModoRestablecer = b.modo === 'excel' || b.modo === 'vacio' ? b.modo : 'ceros';
    await restablecer(modo, !!b.conservarMovimientos);
  });
}
