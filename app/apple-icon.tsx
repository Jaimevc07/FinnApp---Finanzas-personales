import { iconoApp } from '@/lib/icono';

// iOS aplica sus propias esquinas redondeadas: el ícono va cuadrado y a sangre.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return iconoApp(180, { margen: 0.2, radio: 0 });
}
