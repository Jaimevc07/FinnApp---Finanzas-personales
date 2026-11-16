import type { Metadata } from 'next';
import { PonerClave } from '@/components/clave';

export const metadata: Metadata = { title: 'Contraseña nueva' };

export default function Restablecer() {
  return <PonerClave modo="restablecer" />;
}
