import { iconoApp } from '@/lib/icono';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return iconoApp(64, { margen: 0.16, radio: 0.24 });
}
