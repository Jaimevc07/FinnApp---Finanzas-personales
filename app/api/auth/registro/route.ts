// Pública, pero solo funciona una vez: crea la cuenta de quien administra el hogar cuando aún no hay miembros.
import { cuerpo } from '@/lib/servidor/http';
import { registrarPrimerMiembro } from '@/lib/servidor/miembros';
import { ErrorAcceso } from '@/lib/servidor/sesion';

export async function POST(req: Request) {
  try {
    await registrarPrimerMiembro(await cuerpo(req));
    return Response.json({ ok: true });
  } catch (e) {
    const estado = e instanceof ErrorAcceso ? e.estado : 400;
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo crear la cuenta' }, { status: estado });
  }
}
