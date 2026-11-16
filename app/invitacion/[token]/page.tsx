import type { Metadata } from 'next';
import { AceptarInvitacion } from '@/components/invitacion';

export const metadata: Metadata = { title: 'Invitación' };

export default async function Invitacion({ params }: { params: Promise<{ token: string }> }) {
  return <AceptarInvitacion token={(await params).token} />;
}
