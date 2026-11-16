import { enCuaderno } from '@/lib/servidor/db';
import { conCuaderno, responder } from '@/lib/servidor/http';
import { generarPlantilla, leerPlantilla, nombreArchivo } from '@/lib/servidor/plantilla';
import { aplicarPlantilla, leerEstado } from '@/lib/servidor/repo';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Descarga la plantilla de Excel con el plan actual · ?vacia=1 = misma estructura sin montos. */
export function GET(req: Request) {
  return conCuaderno(async (_q, c) => {
    const vacia = new URL(req.url).searchParams.get('vacia') === '1';
    const archivo = await generarPlantilla(await enCuaderno(c.id, leerEstado), vacia);
    return new Response(new Uint8Array(archivo), {
      headers: {
        'Content-Type': XLSX,
        'Content-Disposition': `attachment; filename="${nombreArchivo(vacia)}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}

/** Sube la plantilla llena (el cuerpo es el .xlsx) · ?conservarMovimientos=1 */
export async function POST(req: Request) {
  return responder(async () => {
    const conservar = new URL(req.url).searchParams.get('conservarMovimientos') === '1';
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) throw new Error('El archivo está vacío');
    if (buf.byteLength > 5_000_000) throw new Error('El archivo pesa más de 5 MB');
    await aplicarPlantilla(await leerPlantilla(buf), conservar);
  });
}
