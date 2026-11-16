'use client';
// Cuaderno elegido en este navegador (cookie fh-cuaderno). La app lo manda en cada petición
// con el encabezado x-cuaderno, así cada pestaña sigue trabajando en el suyo.
const COOKIE = 'fh-cuaderno';

export function cuadernoElegido(): number | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)fh-cuaderno=(\d+)/);
  return m ? Number(m[1]) : null;
}

export function elegirCuaderno(id: number) {
  document.cookie = `${COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function olvidarCuaderno() {
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
}
