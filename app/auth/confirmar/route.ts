// Enlaces de los correos de Supabase (confirmar cuenta, invitación, recuperar contraseña): valida el
// token, abre la sesión y lleva a la pantalla que sigue.
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/servidor';

const TIPOS: EmailOtpType[] = ['signup', 'invite', 'recovery', 'email', 'magiclink', 'email_change'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as EmailOtpType | null;
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, url.origin));
  if (!tokenHash || !tipo || !TIPOS.includes(tipo)) return ir('/login?error=enlace');

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
  if (error || !data.user) return ir('/login?error=enlace');

  if (tipo === 'recovery') return ir('/restablecer');
  // Invitado a la app: aún no tiene contraseña
  if (tipo === 'invite' || data.user.user_metadata?.invitado) return ir('/bienvenida');
  return ir('/cuadernos?confirmada=1');
}
