// Pública: qué mostrar en la pantalla de inicio de sesión (no revela datos del hogar).
import { configSupabase } from '@/lib/supabase/config';
import { hayMiembros } from '@/lib/servidor/miembros';

export const dynamic = 'force-dynamic';

// ¿Está activo el inicio de sesión con Google en Supabase? Se consulta cada 5 minutos.
let google: { valor: boolean; hasta: number } | undefined;
async function googleActivo() {
  if (google && google.hasta > Date.now()) return google.valor;
  const { url, clave } = configSupabase();
  const valor = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: clave }, cache: 'no-store' })
    .then(r => r.json()).then(d => !!d?.external?.google).catch(() => false);
  google = { valor, hasta: Date.now() + 5 * 60_000 };
  return valor;
}

export async function GET() {
  try {
    const [miembros, conGoogle] = await Promise.all([hayMiembros(), googleActivo()]);
    return Response.json({ registroAbierto: !miembros, google: conGoogle }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
