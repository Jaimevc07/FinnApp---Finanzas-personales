import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // La plantilla de Excel se arma y se lee en el servidor con exceljs: se carga desde node_modules, sin empaquetar.
  serverExternalPackages: ['exceljs'],
  // La vista "Mercado" ahora es "Listas de compras".
  async redirects() {
    return [{ source: '/mercado', destination: '/listas', permanent: true }];
  },
  // El service worker nunca debe quedar en caché HTTP: así las actualizaciones llegan de inmediato.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
