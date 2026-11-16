import type { Metadata } from 'next';
import { PonerClave } from '@/components/clave';

export const metadata: Metadata = { title: 'Bienvenida' };

export default function Bienvenida() {
  return <PonerClave modo="bienvenida" />;
}
