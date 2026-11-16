// Cuadernos, su gente y las invitaciones. Estas tablas se administran con el usuario del servidor
// (no con el rol de datos), así que cada consulta filtra el cuaderno a mano y valida el permiso.
import { randomBytes } from 'node:crypto';
import semilla from '../semilla.json';
import type { Estado, Invitacion, InvitacionRecibida, Miembro, Permiso, ResumenCuaderno } from '../tipos';
import { ejecutar, enCuaderno, insertar, sembrar, todas, transaccion, una, vaciar } from './db';
import { cuentaAuth, contrasenaDe, nombreDe } from './miembros';
import { guardarConfig, leerEstado, registrar } from './repo';
import { comoMiembro, ErrorAcceso, exigirPermiso, olvidarMiembros, quien, type CuadernoActual, type Quien } from './sesion';

type Fila = Record<string, unknown>;
const PERMISO_TEXTO: Record<Permiso, string> = { propietario: 'propietario', editor: 'puede editar', lector: 'solo ver' };
const icono = (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v) ? v : null);
const nombreCuaderno = (v: unknown) => {
  const n = String(v ?? '').trim().slice(0, 60);
  if (!n) throw new Error('Escribe el nombre del cuaderno');
  return n;
};
const correoDe = (v: unknown) => {
  const c = String(v ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new Error('Escribe un correo válido');
  return c;
};
const exigirQuien = (): Quien & { cuaderno: CuadernoActual } => {
  const q = quien();
  if (!q?.cuaderno) throw new ErrorAcceso('Elige un cuaderno', 409, 'elige-cuaderno');
  return q as Quien & { cuaderno: CuadernoActual };
};

/* ---------- Estado completo: datos del cuaderno + su gente ---------- */
/** Datos del cuaderno (con el rol de datos) más miembros, invitaciones y permiso (con el usuario del servidor). */
export async function estadoCompleto(q: Quien, c: CuadernoActual): Promise<Estado> {
  const [e, miembros, invitaciones] = await Promise.all([
    enCuaderno(c.id, leerEstado),
    todas<Miembro>(`SELECT m.usuario_id::text AS usuario_id, m.nombre, m.correo, m.rol, cm.activo, cm.permiso
      FROM cuaderno_miembros cm JOIN miembros m ON m.usuario_id = cm.usuario_id
      WHERE cm.cuaderno_id = ? ORDER BY cm.creado`, c.id),
    c.permiso === 'propietario'
      ? todas<Invitacion>(`SELECT id, correo, permiso, token, creado, vence, invitado_por::text AS invitado_por FROM invitaciones
          WHERE cuaderno_id = ? AND aceptada IS NULL AND rechazada IS NULL AND vence > now() ORDER BY creado DESC`, c.id)
      : Promise.resolve([] as Invitacion[]),
  ]);
  return { ...e, miembros, invitaciones, yo: q.id, cuaderno: c };
}

/* ---------- Pre-vista: mis cuadernos e invitaciones ---------- */
export async function misCuadernos(q: Quien): Promise<ResumenCuaderno[]> {
  return todas<ResumenCuaderno>(`
    SELECT c.id, c.nombre, c.icono, cm.permiso,
      (SELECT COALESCE(json_agg(json_build_object('nombre', m.nombre, 'usuario_id', m.usuario_id) ORDER BY x.creado), '[]')
         FROM cuaderno_miembros x JOIN miembros m ON m.usuario_id = x.usuario_id WHERE x.cuaderno_id = c.id AND x.activo) AS personas,
      (SELECT MAX(fecha) FROM actividad a WHERE a.cuaderno_id = c.id) AS ultimo_cambio
    FROM cuaderno_miembros cm JOIN cuadernos c ON c.id = cm.cuaderno_id
    WHERE cm.usuario_id = ? AND cm.activo
    ORDER BY c.creado`, q.id);
}

export async function invitacionesParaMi(q: Quien): Promise<InvitacionRecibida[]> {
  return todas<InvitacionRecibida>(`
    SELECT i.id, c.nombre AS cuaderno, i.permiso, m.nombre AS invitado_por, i.creado
    FROM invitaciones i JOIN cuadernos c ON c.id = i.cuaderno_id LEFT JOIN miembros m ON m.usuario_id = i.invitado_por
    WHERE lower(i.correo) = ? AND i.aceptada IS NULL AND i.rechazada IS NULL AND i.vence > now()
      AND NOT EXISTS (SELECT 1 FROM cuaderno_miembros cm WHERE cm.cuaderno_id = i.cuaderno_id AND cm.usuario_id = ? AND cm.activo)
    ORDER BY i.creado DESC`, q.correo.toLowerCase(), q.id);
}

/** Crea un cuaderno con el ejemplo del Excel o en blanco (categorías y meses, sin montos). */
export async function crearCuaderno(q: Quien, b: Fila): Promise<number> {
  const nombre = nombreCuaderno(b.nombre);
  const id = await insertar('INSERT INTO cuadernos (nombre, icono, creado_por) VALUES (?, ?, ?)', nombre, icono(b.icono), q.id);
  try {
    await ejecutar(`INSERT INTO cuaderno_miembros (cuaderno_id, usuario_id, permiso) VALUES (?, ?, 'propietario')`, id, q.id);
    const c: CuadernoActual = { id, nombre, icono: icono(b.icono), permiso: 'propietario' };
    await comoMiembro({ ...q, cuaderno: c }, () => enCuaderno(id, async () => {
      await sembrar(semilla);
      if (b.inicio !== 'ejemplo') await vaciar(false);
      await guardarConfig({ hogar: nombre }, false);
      await registrar('ajustes', `creó el cuaderno «${nombre}»`, b.inicio === 'ejemplo' ? 'Con los datos de ejemplo' : 'En blanco');
    }));
  } catch (e) {
    await ejecutar('DELETE FROM cuadernos WHERE id = ?', id);
    throw e;
  }
  olvidarMiembros();
  return id;
}

/* ---------- Cuaderno actual ---------- */
export async function editarCuaderno(b: Fila) {
  const q = exigirQuien();
  exigirPermiso(q.cuaderno, 'propietario');
  const nombre = b.nombre !== undefined ? nombreCuaderno(b.nombre) : q.cuaderno.nombre;
  const ic = 'icono' in b ? icono(b.icono) : q.cuaderno.icono;
  await ejecutar('UPDATE cuadernos SET nombre = ?, icono = ? WHERE id = ?', nombre, ic, q.cuaderno.id);
  await guardarConfig({ hogar: nombre }, false);
  if (nombre !== q.cuaderno.nombre) await registrar('ajustes', `cambió el nombre del cuaderno a «${nombre}»`);
  olvidarMiembros();
}

/** Borra el cuaderno con todos sus datos (solo quien es propietario). */
export async function eliminarCuaderno(q: Quien, c: CuadernoActual) {
  exigirPermiso(c, 'propietario');
  await ejecutar('DELETE FROM cuadernos WHERE id = ?', c.id);
  olvidarMiembros();
}

/** Salir de un cuaderno ajeno (el último propietario no puede salir: debe eliminarlo o pasar la propiedad). */
export async function salirDelCuaderno(q: Quien, c: CuadernoActual) {
  if (c.permiso === 'propietario') {
    const otros = await una<{ n: number }>(`SELECT COUNT(*)::int AS n FROM cuaderno_miembros WHERE cuaderno_id = ? AND permiso = 'propietario' AND activo AND usuario_id <> ?`, c.id, q.id);
    if (!otros?.n) throw new Error('Eres el único propietario: elimina el cuaderno o haz propietario a otra persona antes de salir');
  }
  await comoMiembro({ ...q, cuaderno: c }, () => enCuaderno(c.id, async () => {
    await ejecutar('UPDATE cuaderno_miembros SET activo = false WHERE cuaderno_id = ? AND usuario_id = ?', c.id, q.id);
    await registrar('miembros', 'salió del cuaderno');
  }, false));
  olvidarMiembros();
}

/* ---------- Gente del cuaderno actual ---------- */
export async function cambiarPersona(usuario: string, b: Fila) {
  const q = exigirQuien();
  exigirPermiso(q.cuaderno, 'propietario');
  if (!/^[0-9a-f-]{36}$/i.test(usuario)) throw new Error('Persona no válida');
  if (usuario === q.id) throw new Error('No puedes cambiar tu propio permiso');
  const p = await una<{ nombre: string; permiso: Permiso; activo: boolean }>(`SELECT m.nombre, cm.permiso, cm.activo FROM cuaderno_miembros cm
    JOIN miembros m ON m.usuario_id = cm.usuario_id WHERE cm.cuaderno_id = ? AND cm.usuario_id = ?`, q.cuaderno.id, usuario);
  if (!p) throw new Error('Esa persona no está en el cuaderno');
  if (b.permiso !== undefined) {
    const permiso: Permiso = b.permiso === 'propietario' ? 'propietario' : b.permiso === 'lector' ? 'lector' : 'editor';
    await ejecutar('UPDATE cuaderno_miembros SET permiso = ? WHERE cuaderno_id = ? AND usuario_id = ?', permiso, q.cuaderno.id, usuario);
    if (permiso !== p.permiso) await registrar('miembros', `cambió el permiso de ${p.nombre} a «${PERMISO_TEXTO[permiso]}»`);
  }
  if (b.activo !== undefined) {
    const activo = !!b.activo;
    await ejecutar('UPDATE cuaderno_miembros SET activo = ? WHERE cuaderno_id = ? AND usuario_id = ?', activo, q.cuaderno.id, usuario);
    if (activo !== p.activo) await registrar('miembros', activo ? `le devolvió el acceso a ${p.nombre}` : `quitó a ${p.nombre} del cuaderno`);
  }
  olvidarMiembros();
}

/* ---------- Invitaciones ---------- */
/** Crea (o renueva) la invitación de un correo con un permiso. Devuelve el token del enlace. */
export async function invitar(b: Fila): Promise<string> {
  const q = exigirQuien();
  exigirPermiso(q.cuaderno, 'propietario');
  const correo = correoDe(b.correo);
  const permiso = b.permiso === 'lector' ? 'lector' : 'editor';
  const ya = await una(`SELECT 1 FROM cuaderno_miembros cm JOIN miembros m ON m.usuario_id = cm.usuario_id
    WHERE cm.cuaderno_id = ? AND cm.activo AND lower(m.correo) = ?`, q.cuaderno.id, correo);
  if (ya) throw new Error('Esa persona ya está en el cuaderno');
  const previa = await una<{ id: number; token: string }>(`SELECT id, token FROM invitaciones
    WHERE cuaderno_id = ? AND lower(correo) = ? AND aceptada IS NULL AND rechazada IS NULL AND vence > now()`, q.cuaderno.id, correo);
  let token: string;
  if (previa) {
    token = previa.token;
    await ejecutar(`UPDATE invitaciones SET permiso = ?, vence = now() + interval '14 days', invitado_por = ? WHERE id = ?`, permiso, q.id, previa.id);
  } else {
    token = randomBytes(24).toString('base64url');
    await ejecutar('INSERT INTO invitaciones (cuaderno_id, correo, permiso, token, invitado_por) VALUES (?, ?, ?, ?, ?)', q.cuaderno.id, correo, permiso, token, q.id);
  }
  await registrar('miembros', `invitó a ${correo}`, `Permiso: ${PERMISO_TEXTO[permiso]}`, `invitacion:${correo}`);
  return token;
}

export async function cancelarInvitacion(id: number) {
  const q = exigirQuien();
  exigirPermiso(q.cuaderno, 'propietario');
  const i = await una<{ correo: string }>('DELETE FROM invitaciones WHERE id = ? AND cuaderno_id = ? AND aceptada IS NULL RETURNING correo', id, q.cuaderno.id);
  if (i) await registrar('miembros', `canceló la invitación de ${i.correo}`);
}

type InvitacionCompleta = {
  id: number; cuaderno_id: number; cuaderno: string; correo: string; permiso: Exclude<Permiso, 'propietario'>;
  invitado_por: string | null; aceptada: string | null; rechazada: string | null; vencida: boolean;
};
const porToken = (token: string) => una<InvitacionCompleta>(`
  SELECT i.id, i.cuaderno_id, c.nombre AS cuaderno, i.correo, i.permiso, m.nombre AS invitado_por, i.aceptada, i.rechazada, i.vence <= now() AS vencida
  FROM invitaciones i JOIN cuadernos c ON c.id = i.cuaderno_id LEFT JOIN miembros m ON m.usuario_id = i.invitado_por
  WHERE i.token = ?`, token);

/** Lo que muestra la página del enlace de invitación (pública: el token es el secreto). */
export async function infoInvitacion(token: string) {
  const i = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await porToken(token) : undefined;
  if (!i) return null;
  const cuenta = await una('SELECT 1 FROM miembros WHERE lower(correo) = ? AND activo', i.correo.toLowerCase());
  return {
    cuaderno: i.cuaderno, correo: i.correo, permiso: i.permiso, invitado_por: i.invitado_por,
    estado: i.aceptada ? 'aceptada' : i.rechazada ? 'rechazada' : i.vencida ? 'vencida' : 'pendiente',
    cuentaExiste: !!cuenta,
  };
}

/** Une a la persona al cuaderno de la invitación y deja constancia. */
async function unirse(i: InvitacionCompleta, q: Quien) {
  await transaccion(async () => {
    await ejecutar(`INSERT INTO cuaderno_miembros (cuaderno_id, usuario_id, permiso) VALUES (?, ?, ?)
      ON CONFLICT (cuaderno_id, usuario_id) DO UPDATE SET permiso = excluded.permiso, activo = true`, i.cuaderno_id, q.id, i.permiso);
    await ejecutar('UPDATE invitaciones SET aceptada = now(), aceptada_por = ? WHERE id = ?', q.id, i.id);
  });
  const c: CuadernoActual = { id: i.cuaderno_id, nombre: i.cuaderno, icono: null, permiso: i.permiso };
  await comoMiembro({ ...q, cuaderno: c }, () => enCuaderno(i.cuaderno_id,
    () => registrar('miembros', 'se unió al cuaderno', `Invitación de ${i.invitado_por ?? 'alguien'} · ${PERMISO_TEXTO[i.permiso]}`), false));
  olvidarMiembros();
}

/**
 * Acepta una invitación por su enlace. Con sesión: el correo de la cuenta debe ser el invitado.
 * Sin sesión: si el correo no tiene cuenta, la crea (nombre y contraseña); si ya la tiene, pide iniciar sesión.
 */
export async function aceptarPorToken(token: string, sesion: { id: string; correo: string } | null, b: Fila): Promise<number> {
  const i = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await porToken(token) : undefined;
  if (!i) throw new Error('La invitación no existe');
  if (i.aceptada) throw new Error('Esta invitación ya se usó');
  if (i.rechazada || i.vencida) throw new Error('Esta invitación venció. Pide una nueva');
  const correo = i.correo.toLowerCase();
  let q: Quien | undefined;
  if (sesion) {
    if (sesion.correo !== correo) throw new ErrorAcceso(`Esta invitación es para ${i.correo}. Cierra sesión y entra con esa cuenta.`, 403, 'sin-permiso');
    q = await una<Quien>('SELECT usuario_id::text AS id, nombre, correo, rol FROM miembros WHERE usuario_id = ?', sesion.id);
    if (!q) {
      // Tiene sesión de Supabase pero aún no cuenta en la app (p. ej. entró con Google): se crea
      const nombre = nombreDe(b.nombre ?? correo.split('@')[0]);
      await ejecutar(`INSERT INTO miembros (usuario_id, nombre, correo) VALUES (?, ?, ?)
        ON CONFLICT (usuario_id) DO UPDATE SET activo = true`, sesion.id, nombre, correo);
      q = { id: sesion.id, nombre, correo, rol: 'miembro' };
    }
  } else {
    if (await una('SELECT 1 FROM miembros WHERE lower(correo) = ?', correo)) {
      throw new ErrorAcceso('Ya tienes cuenta con ese correo: inicia sesión para aceptar', 401, 'sin-sesion');
    }
    const nombre = nombreDe(b.nombre), contrasena = contrasenaDe(b.contrasena);
    const id = await cuentaAuth(correo, contrasena, nombre);
    await ejecutar(`INSERT INTO miembros (usuario_id, nombre, correo) VALUES (?, ?, ?)
      ON CONFLICT (usuario_id) DO UPDATE SET nombre = excluded.nombre, correo = excluded.correo, activo = true`, id, nombre, correo);
    q = { id, nombre, correo, rol: 'miembro' };
  }
  await unirse(i, q);
  return i.cuaderno_id;
}

/** Desde la pre-vista: aceptar o rechazar una invitación dirigida al correo de la cuenta. */
export async function responderInvitacion(q: Quien, id: number, aceptar: boolean): Promise<number | null> {
  const fila = await una<{ token: string; correo: string }>('SELECT token, correo FROM invitaciones WHERE id = ?', id);
  if (!fila || fila.correo.toLowerCase() !== q.correo.toLowerCase()) throw new Error('La invitación no existe');
  const i = (await porToken(fila.token))!;
  if (i.aceptada || i.rechazada || i.vencida) throw new Error('Esta invitación ya no está disponible');
  if (!aceptar) {
    await ejecutar('UPDATE invitaciones SET rechazada = now() WHERE id = ?', id);
    return null;
  }
  await unirse(i, q);
  return i.cuaderno_id;
}
