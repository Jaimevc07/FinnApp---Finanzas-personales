// Ayudas para mostrar quién hizo qué (cliente y servidor).
import type { Estado, Miembro } from './tipos';

export const miembroDe = (e: Pick<Estado, 'miembros'> | null | undefined, id?: string | null): Miembro | undefined =>
  id ? e?.miembros?.find(m => m.usuario_id === id) : undefined;

/** "María José" → "María" */
export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

/** Nombre corto de un miembro por su id, o null si no se sabe (registros de antes del inicio de sesión). */
export const quienFue = (e: Pick<Estado, 'miembros'> | null | undefined, id?: string | null) => {
  const m = miembroDe(e, id);
  return m ? primerNombre(m.nombre) : null;
};

/** "María José" → "MJ" */
export function iniciales(nombre: string) {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const hora = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Fecha y hora en lenguaje cotidiano: "hace 5 min", "hoy 10:32", "ayer 18:04", "12 nov 10:32", "12 nov 2025". */
export function cuando(iso: string | null | undefined, ahora = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.round((ahora.getTime() - d.getTime()) / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dias === 0) return `hoy ${hora(d)}`;
  if (dias === 1) return `ayer ${hora(d)}`;
  if (d.getFullYear() === ahora.getFullYear()) return `${d.getDate()} ${MESES[d.getMonth()]} ${hora(d)}`;
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Día de una fecha para agrupar ("Hoy", "Ayer", "Sábado 12 nov"). */
export function diaDe(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  const nombre = d.toLocaleDateString('es-CO', { weekday: 'long' });
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== ahora.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}
