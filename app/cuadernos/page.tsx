import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PreVistaCuadernos } from '@/components/cuadernos';

export const metadata: Metadata = { title: 'Tus cuadernos' };

export default function Cuadernos() {
  return (
    <Suspense>
      <PreVistaCuadernos />
    </Suspense>
  );
}
