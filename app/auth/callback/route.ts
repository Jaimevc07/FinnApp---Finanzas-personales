// Vuelta del inicio de sesión con Google (u otro proveedor): cambia el código por la sesión.
import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get('code');
  const volver = url.searchParams.get('volver');
  // Solo rutas internas, para no redirigir a otro sitio
  const destino = volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';
  if (codigo) {
    const { error } = await (await supabaseServidor()).auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=google', url.origin));
}
