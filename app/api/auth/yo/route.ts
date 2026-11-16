// La cuenta de la sesión actual (401 sin sesión, 403 si no tiene cuenta en la app).
import { conCuenta, json } from '@/lib/servidor/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return conCuenta(async q => json(q));
}
