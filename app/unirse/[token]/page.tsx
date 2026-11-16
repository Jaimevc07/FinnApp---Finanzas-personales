import type { Metadata } from 'next';
import { Unirse } from '@/components/unirse';

export const metadata: Metadata = { title: 'Únete a Finanzas Hogar' };

export default async function PaginaUnirse({ params }: { params: Promise<{ token: string }> }) {
  return <Unirse token={(await params).token} />;
}
