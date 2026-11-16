// Datos públicos del proyecto de Supabase (se incrustan en el navegador al compilar).
// Se leen con el nombre literal para que Next pueda reemplazarlos en el cliente.
export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return { url, clave };
}
