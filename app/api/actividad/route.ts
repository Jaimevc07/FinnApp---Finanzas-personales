// Historial de quién hizo qué en el cuaderno: ?limite=50&usuario=<id>&antes=<id> (para cargar más).
import { enCuaderno } from '@/lib/servidor/db';
import { conCuaderno, json } from '@/lib/servidor/http';
import { listarActividad } from '@/lib/servidor/repo';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return conCuaderno(async (_q, c) => {
    const p = new URL(req.url).searchParams;
    return json(await enCuaderno(c.id, () => listarActividad({
      limite: Number(p.get('limite')) || 50, usuario: p.get('usuario'), antes: Number(p.get('antes')) || null,
    })));
  });
}
