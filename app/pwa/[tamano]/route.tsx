import { iconoApp } from '@/lib/icono';

// Íconos del manifiesto PWA: /pwa/192, /pwa/512 y /pwa/maskable (fondo completo, zona segura del 80 %).
export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ tamano: '192' }, { tamano: '512' }, { tamano: 'maskable' }];
}

export async function GET(_req: Request, ctx: { params: Promise<{ tamano: string }> }) {
  const { tamano } = await ctx.params;
  if (tamano === 'maskable') return iconoApp(512, { margen: 0.26, radio: 0 });
  const n = tamano === '192' ? 192 : 512;
  return iconoApp(n, { margen: 0.2, radio: 0 });
}
