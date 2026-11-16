import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { RegistrarSW } from '@/components/registrar-sw';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Finanzas Hogar', template: '%s · Finanzas Hogar' },
  description: 'Presupuesto, plan de deudas, metas y registro de movimientos del hogar.',
  applicationName: 'Finanzas Hogar',
  appleWebApp: { capable: true, title: 'Finanzas', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f3f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
  ],
};

// Aplica el tema guardado antes de pintar, para evitar el destello claro/oscuro.
const temaInicial = `try{var t=localStorage.getItem('fh-tema');if(t==='claro')document.documentElement.dataset.theme='light';else if(t==='oscuro')document.documentElement.dataset.theme='dark';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
