'use client';
// Cliente de Supabase en el navegador: solo para iniciar y cerrar sesión (los datos van por la API de la app).
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configSupabase } from './config';

let cliente: SupabaseClient | undefined;
export function supabaseNavegador(): SupabaseClient {
  if (!cliente) {
    const { url, clave } = configSupabase();
    cliente = createBrowserClient(url, clave);
  }
  return cliente;
}
