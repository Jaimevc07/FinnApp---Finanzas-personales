import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Finanzas Hogar',
    short_name: 'Finanzas',
    description: 'Presupuesto, plan de deudas, metas y registro de movimientos del hogar.',
    lang: 'es-CO',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f3f0',
    theme_color: '#f4f3f0',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/pwa/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Registrar movimiento', short_name: 'Registrar', url: '/movimientos?nuevo=1' },
      { name: 'Listas de compras', short_name: 'Listas', url: '/listas' },
    ],
  };
}
