// Ícono de la app para ImageResponse: tres barras ascendentes, la última en naranja.
import { ImageResponse } from 'next/og';

export function iconoApp(tamano: number, { margen = 0.2, radio = 0.22 } = {}) {
  const s = tamano;
  const util = s * (1 - margen * 2);
  const ancho = util * 0.2;
  const alturas = [0.42, 0.66, 0.92];
  return new ImageResponse(
    (
      <div
        style={{
          width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#111113', borderRadius: radio * s,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: util * 0.1, height: util * 0.72 }}>
          {alturas.map((h, i) => (
            <div
              key={i}
              style={{
                width: ancho, height: util * 0.72 * h, borderRadius: ancho * 0.28,
                background: i === 2 ? '#f26411' : i === 1 ? '#6b6a71' : '#3b3b40',
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
