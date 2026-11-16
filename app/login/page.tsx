import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioLogin } from '@/components/login';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default function Login() {
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  );
}
