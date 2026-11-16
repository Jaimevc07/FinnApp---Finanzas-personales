// Cuentas de la app (Supabase Auth). Se crean desde el servidor con la clave secreta, ya confirmadas:
// la primera vez (quien administra) y al aceptar una invitación a un cuaderno.
import { supabaseAdmin } from '../supabase/servidor';
import { ejecutar, transaccion, una } from './db';
import { registrar } from './repo';
import { ErrorAcceso, olvidarMiembros, quien } from './sesion';

type Fila = Record<string, unknown>;

export const nombreDe = (v: unknown) => {
  const n = String(v ?? '').trim().slice(0, 60);
  if (!n) throw new Error('Escribe el nombre');
  return n;
};
const correoDe = (v: unknown) => {
  const c = String(v ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new Error('Escribe un correo válido');
  return c;
};
export const contrasenaDe = (v: unknown) => {
  const c = String(v ?? '');
  if (c.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
  if (c.length > 72) throw new Error('La contraseña es demasiado larga');
  return c;
};

/** Mensajes de Supabase Auth en español. */
function traducir(msg: string) {
  if (/weak|password should/i.test(msg)) return 'La contraseña es muy débil: usa al menos 8 caracteres con letras y números';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera un momento';
  return msg;
}

export async function hayMiembros() {
  return !!(await una('SELECT 1 FROM miembros WHERE activo LIMIT 1'));
}

/** Crea la cuenta en Supabase Auth (o, si ya existía con ese correo, le pone la contraseña). Devuelve su id. */
export async function cuentaAuth(correo: string, contrasena: string, nombre: string): Promise<string> {
  const admin = supabaseAdmin().auth.admin;
  const { data, error } = await admin.createUser({ email: correo, password: contrasena, email_confirm: true, user_metadata: { nombre } });
  if (data?.user) return data.user.id;
  if (error && /already|registered|exists/i.test(error.message)) {
    for (let pagina = 1; pagina <= 20; pagina++) {
      const { data: lista, error: e2 } = await admin.listUsers({ page: pagina, perPage: 100 });
      if (e2) throw new Error(traducir(e2.message));
      const u = lista.users.find(x => x.email?.toLowerCase() === correo);
      if (u) {
        const { error: e3 } = await admin.updateUserById(u.id, { password: contrasena, email_confirm: true });
        if (e3) throw new Error(traducir(e3.message));
        return u.id;
      }
      if (lista.users.length < 100) break;
    }
  }
  throw new Error(traducir(error?.message ?? 'No se pudo crear la cuenta'));
}

/**
 * La primera vez (sin cuentas): crea la cuenta de quien administra la app. Queda como propietario
 * de los cuadernos que no tengan a nadie (p. ej. los datos que ya existían).
 */
export async function registrarPrimerMiembro(b: Fila) {
  const nombre = nombreDe(b.nombre), correo = correoDe(b.correo), contrasena = contrasenaDe(b.contrasena);
  if (await hayMiembros()) throw new ErrorAcceso('La app ya tiene cuentas: inicia sesión o pide una invitación', 403);
  const id = await cuentaAuth(correo, contrasena, nombre);
  await transaccion(async () => {
    await ejecutar('LOCK TABLE miembros IN EXCLUSIVE MODE');
    if (await hayMiembros()) throw new ErrorAcceso('La app ya tiene cuentas: inicia sesión o pide una invitación', 403);
    await ejecutar(`INSERT INTO miembros (usuario_id, nombre, correo, rol) VALUES (?, ?, ?, 'admin')
      ON CONFLICT (usuario_id) DO UPDATE SET nombre = excluded.nombre, correo = excluded.correo, rol = 'admin', activo = true`, id, nombre, correo);
    await ejecutar(`INSERT INTO cuaderno_miembros (cuaderno_id, usuario_id, permiso)
      SELECT c.id, ?, 'propietario' FROM cuadernos c
      WHERE NOT EXISTS (SELECT 1 FROM cuaderno_miembros cm WHERE cm.cuaderno_id = c.id AND cm.activo)
      ON CONFLICT (cuaderno_id, usuario_id) DO UPDATE SET permiso = 'propietario', activo = true`, id);
  });
  olvidarMiembros();
}

/**
 * Cambios de una cuenta: nombre y contraseña los cambia la persona misma; quien administra la app
 * también puede ponerle una contraseña nueva a otra persona (si la olvidó).
 */
export async function actualizarMiembro(id: string, b: Fila) {
  const q = quien();
  if (!q) throw new ErrorAcceso('Inicia sesión para continuar', 401);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Persona no válida');
  const m = await una<{ nombre: string }>('SELECT nombre FROM miembros WHERE usuario_id = ?', id);
  if (!m) throw new Error('Persona no encontrada');
  const esYo = q.id === id;
  if (!esYo && (b.nombre !== undefined || q.rol !== 'admin')) {
    throw new ErrorAcceso('Solo puedes cambiar tu propia cuenta', 403);
  }
  const hechos: string[] = [];
  if (b.nombre !== undefined) {
    const nombre = nombreDe(b.nombre);
    await ejecutar('UPDATE miembros SET nombre = ? WHERE usuario_id = ?', nombre, id);
    if (nombre !== m.nombre) hechos.push(`cambió su nombre a ${nombre}`);
  }
  if (b.contrasena !== undefined) {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { password: contrasenaDe(b.contrasena) });
    if (error) throw new Error(traducir(error.message));
    hechos.push(esYo ? 'cambió su contraseña' : `le puso una contraseña nueva a ${m.nombre}`);
  }
  olvidarMiembros();
  for (const h of hechos) await registrar('miembros', h);
}
