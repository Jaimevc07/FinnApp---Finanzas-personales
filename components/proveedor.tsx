'use client';
// Estado global del cliente: datos del cuaderno elegido, mes seleccionado, guardado diferido y hoja de registro.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { periodoInicial, serie, type ResumenPeriodo } from '@/lib/calculos';
import { cuadernoElegido, olvidarCuaderno } from '@/lib/cuaderno-cliente';
import { quienFue } from '@/lib/miembros';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import {
  claveCelda, type Categoria, type Config, type DatosRubro, type Estado, type ItemLista, type Lista, type Meta,
  type ModoRestablecer, type Movimiento, type Permiso, type Seccion, type TipoMovimiento,
} from '@/lib/tipos';
import { ProveedorSoloLectura } from './ui/solo-lectura';

export type DatosMeta = Omit<Meta, 'id' | 'rubro_id' | 'orden' | 'pausada_desde' | 'aporte_pausado'> & { id?: number; aportes?: Record<string, number> | null };

type Conexion = 'ok' | 'guardando' | 'sin-conexion';
/** movimiento con id = editar; sin id = borrador precargado (p. ej. el total de una lista de compras). */
type Registro = { abierto: boolean; movimiento: Partial<Movimiento> | null; tipo: TipoMovimiento };

type Ctx = {
  estado: Estado | null;
  conexion: Conexion;
  aviso: string | null;
  avisar: (msg: string) => void;
  periodoId: string;
  setPeriodoId: (id: string) => void;
  filas: ResumenPeriodo[];
  fila: ResumenPeriodo | undefined;
  /** Permiso en el cuaderno: el lector solo ve; el editor ve y edita; el propietario además maneja la gente */
  puedeEditar: boolean;
  /** Trae del servidor los cambios de las demás personas (tirar hacia abajo, al volver a la app y cada 30 s) */
  refrescar: () => Promise<void>;
  refrescando: boolean;
  esPropietario: boolean;

  setConfig: (parcial: Partial<Config>) => void;
  setCelda: (rubroId: number, periodoId: string, valor: number, opc?: { propagar?: boolean; auto?: boolean }) => void;
  crearRubro: (datos: DatosRubro & { nombre: string }) => Promise<void>;
  actualizarRubro: (id: number, datos: DatosRubro) => Promise<void>;
  borrarRubro: (id: number) => Promise<void>;
  guardarCategoria: (c: Partial<Pick<Categoria, 'nombre' | 'seccion' | 'control' | 'icono'>> & { id?: number }) => Promise<void>;
  borrarCategoria: (id: number) => Promise<void>;
  guardarMeta: (m: DatosMeta) => Promise<void>;
  borrarMeta: (id: number) => Promise<void>;
  pausarMeta: (id: number, desde: string) => Promise<void>;
  reanudarMeta: (id: number, desde: string, aporte: number) => Promise<void>;
  agregarPeriodo: (posicion?: 'anterior' | 'siguiente') => Promise<void>;
  quitarPeriodo: (cual: 'primero' | 'ultimo') => Promise<void>;
  copiarMes: (desde: string, hacia: string, secciones: Seccion[]) => Promise<void>;
  guardarMovimiento: (m: Omit<Movimiento, 'id'> & { id?: number }) => Promise<void>;
  borrarMovimiento: (id: number) => Promise<void>;
  guardarLista: (l: Partial<Omit<Lista, 'orden'>>) => Promise<void>;
  borrarLista: (id: number) => Promise<void>;
  reiniciarLista: (id: number) => Promise<void>;
  renombrarGrupo: (listaId: number, de: string, a: string) => Promise<void>;
  borrarGrupo: (listaId: number, nombre: string) => Promise<void>;
  guardarItem: (i: Partial<ItemLista> & { id?: number }) => Promise<void>;
  borrarItem: (id: number) => Promise<void>;
  restablecer: (modo: ModoRestablecer, conservarMovimientos: boolean) => Promise<void>;
  importar: (datos: unknown) => Promise<void>;
  /** Sube una plantilla de Excel llena: reemplaza presupuesto, deudas, metas y configuración. */
  cargarPlantilla: (archivo: File, conservarMovimientos: boolean) => Promise<void>;
  /** Tu cuenta (o, si administras la app, la contraseña de otra persona) */
  actualizarMiembro: (id: string, cambios: { nombre?: string; contrasena?: string }) => Promise<void>;
  /** Cuaderno actual y su gente (propietario) */
  editarCuaderno: (cambios: { nombre?: string; icono?: string | null }) => Promise<void>;
  invitar: (correo: string, permiso: Exclude<Permiso, 'propietario'>) => Promise<void>;
  cancelarInvitacion: (id: number) => Promise<void>;
  cambiarPersona: (usuarioId: string, cambios: { permiso?: Permiso; activo?: boolean }) => Promise<void>;
  eliminarCuaderno: () => Promise<void>;
  salirDelCuaderno: () => Promise<void>;
  /** Vuelve a la pre-vista para elegir otro cuaderno */
  cambiarDeCuaderno: () => void;
  /** Cierra la sesión en este dispositivo y borra la copia local de los datos. */
  cerrarSesion: () => Promise<void>;

  registro: Registro;
  abrirRegistro: (m?: Partial<Movimiento> | null, tipo?: TipoMovimiento) => void;
  cerrarRegistro: () => void;
};

const Contexto = createContext<Ctx | null>(null);
// v5: cuadernos (una copia por cuaderno). Cambiar el sufijo cuando cambie la forma del estado.
const cache = (id: number) => `fh-estado-v5-${id}`;
const periodoGuardado = (id: number) => `fh-periodo-${id}`;

const leerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
/** Los datos no deben quedar en el dispositivo al cerrar sesión. */
export const borrarCopiaLocal = () => {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('fh-estado') || k.startsWith('fh-periodo')) localStorage.removeItem(k);
  } catch { /* sin almacenamiento */ }
};

/** Sin sesión o sin cuenta en la app: a la pantalla de inicio de sesión. */
function irALogin(motivo?: 'sin-acceso') {
  borrarCopiaLocal();
  const volver = location.pathname !== '/' ? `volver=${encodeURIComponent(location.pathname + location.search)}` : '';
  const q = [motivo ? `error=${motivo}` : '', volver].filter(Boolean).join('&');
  window.location.href = `/login${q ? `?${q}` : ''}`;
}

/** Sin cuaderno elegido o sin acceso a él: a la pre-vista de cuadernos. */
function irACuadernos(motivo?: 'sin-acceso') {
  olvidarCuaderno();
  window.location.href = `/cuadernos${motivo ? '?error=sin-acceso' : ''}`;
}

export function ProveedorFinanzas({ children }: { children: React.ReactNode }) {
  const [estado, setEstadoCrudo] = useState<Estado | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [refrescando, setRefrescando] = useState(false);
  const pendientesRef = useRef(0);
  pendientesRef.current = pendientes;
  const estadoRef = useRef<Estado | null>(null);
  estadoRef.current = estado;
  const ultimoRefresco = useRef(0);
  // Una sola actualización a la vez (la del gesto espera a la automática si ya va en camino)
  const enVuelo = useRef<Promise<void> | null>(null);
  const avisoRef = useRef<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [periodoId, setPeriodoCrudo] = useState('');
  const [registro, setRegistro] = useState<Registro>({ abierto: false, movimiento: null, tipo: 'egreso' });
  const temporizadores = useRef(new Map<string, { t: ReturnType<typeof setTimeout>; fn: () => Promise<unknown> }>());
  const tAviso = useRef<ReturnType<typeof setTimeout>>(undefined);
  // El cuaderno de esta pestaña se fija al abrirla: aunque otra pestaña elija otro, esta sigue en el suyo.
  const cuadernoId = useRef<number | null>(null);
  const permiso = estado?.cuaderno?.permiso ?? 'lector';
  const lector = useRef(true);
  lector.current = !!estado && permiso === 'lector';

  const avisar = useCallback((msg: string) => {
    avisoRef.current = msg;
    setAviso(msg);
    clearTimeout(tAviso.current);
    tAviso.current = setTimeout(() => { avisoRef.current = null; setAviso(null); }, 3200);
  }, []);

  const setEstado = useCallback((e: Estado | ((prev: Estado) => Estado)) => {
    setEstadoCrudo(prev => {
      const nuevo = typeof e === 'function' ? (prev ? e(prev) : prev) : e;
      if (nuevo && cuadernoId.current) guardarLocal(cache(cuadernoId.current), JSON.stringify(nuevo));
      return nuevo;
    });
  }, []);

  const pedir = useCallback(async <T,>(metodo: string, url: string, body?: unknown, silencioso = false): Promise<T> => {
    if (!silencioso) setPendientes(n => n + 1);
    // Un archivo (Blob) se envía tal cual; lo demás como JSON.
    const crudo = body instanceof Blob;
    try {
      const headers: Record<string, string> = { 'x-cuaderno': String(cuadernoId.current ?? '') };
      if (body !== undefined && !crudo) headers['Content-Type'] = 'application/json';
      const r = await fetch(`/api/${url}`, { method: metodo, headers, body: body === undefined ? undefined : crudo ? body : JSON.stringify(body) });
      const datos = await r.json().catch(() => ({}));
      if (r.status === 401) { irALogin(); throw new Error('Inicia sesión para continuar'); }
      if (datos.codigo === 'sin-cuenta') {
        await supabaseNavegador().auth.signOut().catch(() => {});
        irALogin('sin-acceso');
        throw new Error(datos.error);
      }
      if (datos.codigo === 'elige-cuaderno' || datos.codigo === 'sin-cuaderno') {
        irACuadernos(datos.codigo === 'sin-cuaderno' ? 'sin-acceso' : undefined);
        throw new Error(datos.error);
      }
      if (!r.ok) throw new Error(datos.error || r.statusText);
      setOffline(false);
      return datos as T;
    } catch (e) {
      if (e instanceof TypeError) {
        setOffline(true);
        if (!silencioso) avisar('Sin conexión: el cambio no se guardó');
      } else if (!silencioso) {
        avisar(e instanceof Error ? e.message : 'No se pudo guardar');
      }
      throw e;
    } finally {
      if (!silencioso) setPendientes(n => n - 1);
    }
  }, [avisar]);

  // Carga inicial: primero la copia local del cuaderno (para abrir rápido o sin conexión), luego el servidor.
  useEffect(() => {
    const id = cuadernoElegido();
    if (!id) { irACuadernos(); return; }
    cuadernoId.current = id;
    const local = leerLocal(cache(id));
    if (local) { try { setEstadoCrudo(JSON.parse(local)); } catch { /* copia dañada */ } }
    pedir<Estado>('GET', 'estado').then(setEstado).catch(() => {});
  }, [pedir, setEstado]);

  // Mes seleccionado: el guardado si existe; si no, el mes en curso.
  useEffect(() => {
    if (!estado || (periodoId && estado.periodos.some(p => p.id === periodoId))) return;
    const guardado = cuadernoId.current ? leerLocal(periodoGuardado(cuadernoId.current)) : null;
    setPeriodoCrudo(guardado && estado.periodos.some(p => p.id === guardado) ? guardado : periodoInicial(estado.periodos));
  }, [estado, periodoId]);

  const setPeriodoId = useCallback((id: string) => {
    setPeriodoCrudo(id);
    if (cuadernoId.current) guardarLocal(periodoGuardado(cuadernoId.current), id);
  }, []);

  /** Guarda después de una pausa al escribir (una espera por campo). */
  const diferir = useCallback((clave: string, fn: () => Promise<unknown>) => {
    const mapa = temporizadores.current;
    clearTimeout(mapa.get(clave)?.t);
    const t = setTimeout(() => { mapa.delete(clave); fn().catch(() => {}); }, 500);
    mapa.set(clave, { t, fn });
  }, []);

  /** Envía ya los guardados pendientes (antes de una operación que devuelve el estado completo). */
  const vaciar = useCallback(async () => {
    const mapa = temporizadores.current;
    const fns = [...mapa.values()];
    mapa.clear();
    fns.forEach(x => clearTimeout(x.t));
    await Promise.allSettled(fns.map(x => x.fn()));
  }, []);

  /**
   * Trae los datos del servidor. A mano (tirar hacia abajo) primero envía lo pendiente y avisa al terminar.
   * En segundo plano no interrumpe: se salta si hay algo por guardar, para no pisar lo que se está escribiendo.
   */
  const refrescar = useCallback(async (manual = true) => {
    if (!cuadernoId.current) return;
    if (!manual && (enVuelo.current || temporizadores.current.size > 0 || pendientesRef.current > 0 || Date.now() - ultimoRefresco.current < 5000)) return;
    if (manual) {
      setRefrescando(true);
      await enVuelo.current?.catch(() => {});
      await vaciar();
    }
    ultimoRefresco.current = Date.now();
    const antes = estadoRef.current;
    let listo: () => void = () => {};
    enVuelo.current = new Promise<void>(r => { listo = r; });
    try {
      const nuevo = await pedir<Estado>('GET', 'estado', undefined, true);
      // Movimientos que registraron otras personas desde la última vez
      const vistos = new Set(antes?.movimientos.map(m => m.id) ?? []);
      const ajenos = antes ? nuevo.movimientos.filter(m => !vistos.has(m.id) && m.creado_por && m.creado_por !== nuevo.yo) : [];
      setEstado(nuevo);
      if (ajenos.length === 1) avisar(`${quienFue(nuevo, ajenos[0].creado_por) ?? 'Alguien'} registró «${ajenos[0].descripcion}»`);
      else if (ajenos.length > 1) avisar(`${ajenos.length} movimientos nuevos de otras personas`);
      // "Todo al día" solo si no hay otro aviso a la vista (p. ej. el de un movimiento que acaba de llegar)
      else if (manual && !avisoRef.current) avisar('Todo al día');
    } catch (e) {
      if (manual) avisar(e instanceof TypeError ? 'Sin conexión: no se pudo actualizar' : 'No se pudo actualizar');
    } finally {
      enVuelo.current = null;
      listo();
      if (manual) setRefrescando(false);
    }
  }, [avisar, pedir, setEstado, vaciar]);

  // Los cambios de las demás personas llegan solos: al volver a la app o a la pestaña, y cada 30 s mientras se ve.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') refrescar(false); };
    const reloj = setInterval(alVolver, 30_000);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [refrescar]);

  /** En un cuaderno de solo lectura no se envía nada (el servidor también lo rechaza). */
  const bloqueado = useCallback(() => {
    if (!lector.current) return false;
    avisar('Este cuaderno es de solo lectura para ti: puedes ver todo, pero no editar');
    return true;
  }, [avisar]);

  const mutar = useCallback(async (metodo: string, url: string, body?: unknown, deCualquiera = false) => {
    if (!deCualquiera && bloqueado()) throw new Error('Solo lectura');
    await vaciar();
    setEstado(await pedir<Estado>(metodo, url, body));
  }, [bloqueado, pedir, setEstado, vaciar]);

  const setConfig = useCallback((parcial: Partial<Config>) => {
    if (bloqueado()) return;
    setEstado(e => ({ ...e, config: { ...e.config, ...parcial } }));
    for (const [k, v] of Object.entries(parcial)) diferir(`cfg:${k}`, () => pedir('PUT', 'config', { [k]: v }));
  }, [bloqueado, diferir, pedir, setEstado]);

  const setCelda = useCallback<Ctx['setCelda']>((rubroId, pid, valor, opc = {}) => {
    if (bloqueado()) return;
    setEstado(e => {
      const valores = { ...e.valores };
      const idx = e.periodos.findIndex(p => p.id === pid);
      const destino = opc.propagar ? e.periodos.slice(idx) : [e.periodos[idx]];
      for (const p of destino) valores[claveCelda(rubroId, p.id)] = { valor, auto: !!opc.auto };
      return { ...e, valores };
    });
    const body = { rubroId, periodoId: pid, valor, auto: !!opc.auto, propagar: !!opc.propagar };
    if (opc.propagar || opc.auto) pedir('PUT', 'celdas', body).catch(() => {});
    else diferir(`celda:${rubroId}:${pid}`, () => pedir('PUT', 'celdas', body));
  }, [bloqueado, diferir, pedir, setEstado]);

  const valor = useMemo<Omit<Ctx, 'estado' | 'conexion' | 'aviso' | 'periodoId' | 'filas' | 'fila' | 'registro' | 'puedeEditar' | 'esPropietario' | 'refrescar' | 'refrescando'>>(() => ({
    avisar,
    setPeriodoId,
    setConfig,
    setCelda,
    crearRubro: datos => mutar('POST', 'rubros', datos),
    actualizarRubro: (id, datos) => mutar('PATCH', `rubros/${id}`, datos),
    guardarCategoria: ({ id, ...c }) => (id ? mutar('PATCH', `categorias/${id}`, c) : mutar('POST', 'categorias', c)),
    borrarCategoria: id => mutar('DELETE', `categorias/${id}`),
    guardarMeta: ({ id, ...m }) => (id ? mutar('PATCH', `metas/${id}`, m) : mutar('POST', 'metas', m)),
    borrarMeta: id => mutar('DELETE', `metas/${id}`),
    pausarMeta: (id, desde) => mutar('POST', `metas/${id}/pausa`, { desde }),
    reanudarMeta: (id, desde, aporte) => mutar('DELETE', `metas/${id}/pausa`, { desde, aporte }),
    borrarRubro: id => mutar('DELETE', `rubros/${id}`),
    agregarPeriodo: (posicion = 'siguiente') => mutar('POST', 'periodos', { posicion }),
    quitarPeriodo: cual => mutar('DELETE', `periodos?cual=${cual}`),
    copiarMes: (desde, hacia, secciones) => mutar('POST', 'periodos/copiar', { desde, hacia, secciones }),
    guardarMovimiento: ({ id, ...m }) => (id ? mutar('PATCH', `movimientos/${id}`, m) : mutar('POST', 'movimientos', m)),
    borrarMovimiento: id => mutar('DELETE', `movimientos/${id}`),
    guardarLista: ({ id, ...l }) => (id ? mutar('PATCH', `listas/${id}`, l) : mutar('POST', 'listas', l)),
    borrarLista: id => mutar('DELETE', `listas/${id}`),
    reiniciarLista: id => mutar('POST', `listas/${id}/reiniciar`),
    renombrarGrupo: (listaId, de, a) => mutar('PATCH', `listas/${listaId}/grupo`, { de, a }),
    borrarGrupo: (listaId, nombre) => mutar('DELETE', `listas/${listaId}/grupo`, { nombre }),
    guardarItem: ({ id, ...i }) => (id ? mutar('PATCH', `items/${id}`, i) : mutar('POST', 'items', i)),
    borrarItem: id => mutar('DELETE', `items/${id}`),
    restablecer: (modo, conservarMovimientos) => mutar('POST', 'restablecer', { modo, conservarMovimientos }),
    importar: datos => mutar('POST', 'importar', datos),
    cargarPlantilla: (archivo, conservar) => mutar('POST', `plantilla?conservarMovimientos=${conservar ? 1 : 0}`, archivo),
    actualizarMiembro: (id, cambios) => mutar('PATCH', `miembros/${id}`, cambios, true),
    editarCuaderno: cambios => mutar('PATCH', 'cuaderno', cambios, true),
    invitar: (correo, p) => mutar('POST', 'invitaciones', { correo, permiso: p }, true),
    cancelarInvitacion: id => mutar('DELETE', `invitaciones/${id}`, undefined, true),
    cambiarPersona: (usuarioId, cambios) => mutar('PATCH', `personas/${usuarioId}`, cambios, true),
    eliminarCuaderno: async () => {
      await pedir('DELETE', 'cuaderno');
      if (cuadernoId.current) localStorage.removeItem(cache(cuadernoId.current));
      irACuadernos();
    },
    salirDelCuaderno: async () => {
      await pedir('POST', 'cuaderno/salir');
      if (cuadernoId.current) localStorage.removeItem(cache(cuadernoId.current));
      irACuadernos();
    },
    cambiarDeCuaderno: () => {
      vaciar().catch(() => {}).finally(() => { window.location.href = '/cuadernos'; });
    },
    cerrarSesion: async () => {
      await vaciar().catch(() => {});
      await supabaseNavegador().auth.signOut().catch(() => {});
      borrarCopiaLocal();
      olvidarCuaderno();
      window.location.href = '/login';
    },
    abrirRegistro: (m = null, tipo = 'egreso') => setRegistro({ abierto: true, movimiento: m, tipo: m?.tipo ?? tipo }),
    cerrarRegistro: () => setRegistro(r => ({ ...r, abierto: false })),
  }), [avisar, mutar, pedir, setCelda, setConfig, setPeriodoId, vaciar]);

  const filas = useMemo(() => (estado ? serie(estado) : []), [estado]);
  const fila = filas.find(f => f.periodo.id === periodoId);
  const conexion: Conexion = offline ? 'sin-conexion' : pendientes > 0 ? 'guardando' : 'ok';
  const puedeEditar = !!estado && permiso !== 'lector';

  return (
    <Contexto.Provider value={{
      ...valor, estado, conexion, aviso, periodoId, filas, fila, registro, puedeEditar, esPropietario: permiso === 'propietario',
      refrescar, refrescando,
    }}>
      <ProveedorSoloLectura value={!!estado && !puedeEditar}>{children}</ProveedorSoloLectura>
    </Contexto.Provider>
  );
}

export function useFinanzas() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useFinanzas debe usarse dentro de ProveedorFinanzas');
  return c;
}

/** Igual que useFinanzas, pero garantiza que los datos ya cargaron (usar dentro de <ConDatos>). */
export function useDatos() {
  const c = useFinanzas();
  return { ...c, estado: c.estado as Estado };
}
