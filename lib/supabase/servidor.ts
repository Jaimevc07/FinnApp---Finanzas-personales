// Clientes de Supabase en el servidor: la sesión del usuario (cookies) y el administrador (clave secreta).
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { configSupabase } from './config';

/** Sesión de quien hace la petición (lee y renueva las cookies). */
export async function supabaseServidor(): Promise<SupabaseClient> {
  const { url, clave } = configSupabase();
  const almacen = await cookies();
  return createServerClient(url, clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: lista => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch { /* en un componente de servidor no se pueden escribir cookies: lo hace el proxy */ }
      },
    },
  });
}

/** Administrador de Auth: crea cuentas y cambia contraseñas. Solo en el servidor. */
let admin: SupabaseClient | undefined;
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const secreta = process.env.SUPABASE_SECRET_KEY;
    if (!secreta) throw new Error('Falta SUPABASE_SECRET_KEY para administrar las cuentas');
    admin = createClient(configSupabase().url, secreta, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
