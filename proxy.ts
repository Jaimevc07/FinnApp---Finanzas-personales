// Exige sesión de Supabase para ver la app o usar la API, y renueva la sesión cuando hace falta.
// Sin cuaderno elegido, las pantallas llevan a la pre-vista de cuadernos (/cuadernos).
// Que la cuenta sea miembro del cuaderno y su permiso se validan en cada ruta de la API.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configSupabase } from './lib/supabase/config';

const PUBLICAS = new Set(['/login', '/auth/callback', '/api/auth/config', '/api/auth/registro']);
const PUBLICAS_PREFIJO = ['/invitacion/', '/api/invitacion/'];
/** Pantallas que no necesitan un cuaderno elegido */
const SIN_CUADERNO = ['/cuadernos', '/login', '/invitacion/', '/auth/'];

function redirigir(req: NextRequest, res: NextResponse, ruta: string, conVolver: boolean) {
  const destino = req.nextUrl.clone();
  const { pathname, search } = req.nextUrl;
  destino.pathname = ruta;
  destino.search = conVolver && pathname !== '/' ? `?volver=${encodeURIComponent(pathname + search)}` : '';
  const r = NextResponse.redirect(destino);
  for (const c of res.cookies.getAll()) r.cookies.set(c);
  return r;
}

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const { url, clave } = configSupabase();
  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: lista => {
        for (const { name, value } of lista) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) res.cookies.set(name, value, options);
      },
    },
  });
  // Verifica el token (con las claves públicas del proyecto) y lo renueva si venció.
  const { data } = await supabase.auth.getClaims();
  const { pathname } = req.nextUrl;
  const publica = PUBLICAS.has(pathname) || PUBLICAS_PREFIJO.some(p => pathname.startsWith(p));

  if (!data?.claims?.sub) {
    if (publica) return res;
    if (pathname.startsWith('/api/')) return Response.json({ error: 'Inicia sesión para continuar', codigo: 'sin-sesion' }, { status: 401 });
    return redirigir(req, res, '/login', true);
  }
  // Con sesión: las pantallas de la app necesitan un cuaderno elegido
  if (!pathname.startsWith('/api/') && !SIN_CUADERNO.some(p => pathname === p || pathname.startsWith(p)) && !req.cookies.get('fh-cuaderno')?.value) {
    return redirigir(req, res, '/cuadernos', false);
  }
  return res;
}

export const config = {
  // Deja pasar archivos estáticos, íconos, manifiesto y service worker.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|pwa|manifest.webmanifest|sw.js).*)'],
};
