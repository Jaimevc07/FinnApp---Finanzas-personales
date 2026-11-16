// Tipos compartidos entre el servidor (SQLite) y el cliente.

export type Seccion = 'ingreso' | 'operativo' | 'evento' | 'deuda' | 'ahorro';
export const SECCIONES: Seccion[] = ['ingreso', 'operativo', 'evento', 'deuda', 'ahorro'];
export type TipoMovimiento = 'ingreso' | 'egreso';
export type EstadoCompra = 'Pendiente' | 'Comprado' | 'Ajustar';
export type ModoMeta = 'aportes' | 'caja';
export type ModoRestablecer = 'ceros' | 'vacio' | 'excel';

export type Config = {
  hogar: string;
  trm: number;
  trm_referencia: number;
  /** Dinero en cuenta al empezar el plan: se suma a la caja acumulada. */
  saldo_inicial: number;
  ingreso_2028: number;
  operativo_2028: number;
  cuota_carro_2028: number;
  nota_2028: string;
};

export const CONFIG_NUMERICA: (keyof Config)[] = [
  'trm', 'trm_referencia', 'saldo_inicial', 'ingreso_2028', 'operativo_2028', 'cuota_carro_2028',
];

export type Periodo = { id: string; etiqueta: string; cobro: string; orden: number };

export type Categoria = {
  id: number;
  nombre: string;
  seccion: Seccion;
  control: string | null;
  orden: number;
  /** Ícono elegido (clave de lib/iconos.ts). Nulo = se sugiere por el nombre. */
  icono: string | null;
};

export type Rubro = {
  id: number;
  categoria_id: number;
  nombre: string;
  orden: number;
  /** Deuda en dólares: si existe, las celdas "auto" calculan el saldo restante con la TRM. */
  saldo_usd: number | null;
  /** Deuda en pesos: saldo pendiente al inicio del plan. */
  saldo: number | null;
  /** Interés mensual de la deuda, en % (p. ej. 2.1). */
  tasa: number | null;
  /** Cupo total si la deuda es una tarjeta de crédito (en pesos). */
  cupo: number | null;
  /** Esta deuda es parte de otra tarjeta y usa su cupo (p. ej. la parte en dólares de la misma tarjeta). */
  cupo_de: number | null;
  /** Tarjeta de crédito: día de corte del extracto y día límite de pago (1–31) */
  dia_corte?: number | null;
  dia_pago?: number | null;
  /** true: se repite todos los meses · false: solo aparece en los meses que tienen valor (primas, bonos, pagos únicos). */
  recurrente: boolean;
  icono: string | null;
};

export type Celda = { valor: number; auto: boolean };

export type Meta = {
  id: number;
  nombre: string;
  detalle: string;
  objetivo: number;
  /** Mes en que se quiere lograr (AAAA-MM), dentro o después del plan. Nulo = último mes del plan. */
  periodo_objetivo: string | null;
  /** aportes: se ahorra con un rubro mensual del presupuesto · caja: se mide contra la caja que sobra */
  modo: ModoMeta;
  /** Lo que ya está ahorrado antes del plan */
  ahorrado: number;
  /** Rubro de aportes (sección ahorro) cuando modo = aportes */
  rubro_id: number | null;
  orden: number;
  icono: string | null;
  /** En pausa desde este mes (AAAA-MM): no se aporta ni se le reserva caja. Nulo = activa */
  pausada_desde: string | null;
  /** Aporte mensual que tenía al pausarla, para sugerirlo al reanudar */
  aporte_pausado: number | null;
};

export type Lista = {
  id: number;
  nombre: string;
  /** Si está vinculada, el presupuesto es el valor de ese rubro en el mes seleccionado. */
  rubro_id: number | null;
  /** Presupuesto fijo cuando no hay rubro vinculado (0 = sin presupuesto). */
  presupuesto: number;
  orden: number;
  icono: string | null;
};

export type ItemLista = {
  id: number;
  lista_id: number;
  categoria: string;
  producto: string;
  cantidad: number;
  precio: number;
  estado: EstadoCompra;
  orden: number;
  /** Miembro que lo agregó y el último que lo cambió (usuario_id) */
  creado_por?: string | null;
  editado_por?: string | null;
};

export type Movimiento = {
  id: number;
  fecha: string; // AAAA-MM-DD
  tipo: TipoMovimiento;
  descripcion: string;
  categoria: string;
  medio: string;
  valor: number;
  /** Tarjeta de crédito (rubro de deuda con cupo) con que se pagó, si aplica. */
  tarjeta_id: number | null;
  /** Ítem del presupuesto al que corresponde (p. ej. "Combustible" en "Transporte y Salud") */
  rubro_id?: number | null;
  /** Cuándo y quién lo registró; cuándo y quién lo editó por última vez (usuario_id de miembros) */
  creado?: string;
  creado_por?: string | null;
  editado?: string | null;
  editado_por?: string | null;
};

/** Permiso en un cuaderno: propietario (todo y la gente), editor (ver y editar) o lector (solo ver). */
export type Permiso = 'propietario' | 'editor' | 'lector';

/** Persona en el cuaderno actual (cuenta de Supabase Auth). */
export type Miembro = {
  usuario_id: string;
  nombre: string;
  correo: string;
  /** admin = administra la app (puede poner contraseñas nuevas); miembro = cuenta normal */
  rol: 'admin' | 'miembro';
  /** Sigue en el cuaderno (al quitar a alguien sus registros conservan su nombre) */
  activo: boolean;
  permiso: Permiso;
};

/** Cuaderno en el que se trabaja: sus datos y su gente son independientes de los demás. */
export type CuadernoActivo = { id: number; nombre: string; icono: string | null; permiso: Permiso };

/** Invitación pendiente a un cuaderno (el enlace lleva el token). */
export type Invitacion = {
  id: number;
  correo: string;
  permiso: Exclude<Permiso, 'propietario'>;
  token: string;
  creado: string;
  vence: string;
  invitado_por: string | null;
};

/** Un cuaderno en la pre-vista. */
export type ResumenCuaderno = {
  id: number;
  nombre: string;
  icono: string | null;
  permiso: Permiso;
  personas: { nombre: string; usuario_id: string }[];
  ultimo_cambio: string | null;
};

/** Invitación que alguien recibió (se ve en la pre-vista si su correo coincide). */
export type InvitacionRecibida = {
  id: number;
  cuaderno: string;
  permiso: Exclude<Permiso, 'propietario'>;
  invitado_por: string | null;
  creado: string;
};

export type TipoActividad = 'movimiento' | 'presupuesto' | 'deuda' | 'meta' | 'lista' | 'plan' | 'ajustes' | 'miembros';

/** Un cambio hecho por alguien del hogar: "María registró un egreso de $45.000". */
export type Actividad = {
  id: number;
  fecha: string;
  usuario_id: string | null;
  nombre: string;
  tipo: TipoActividad;
  accion: string;
  detalle: string;
};

export type Estado = {
  config: Config;
  periodos: Periodo[];
  categorias: Categoria[];
  rubros: Rubro[];
  /** Clave `${rubroId}:${periodoId}` */
  valores: Record<string, Celda>;
  metas: Meta[];
  listas: Lista[];
  items: ItemLista[];
  movimientos: Movimiento[];
  miembros: Miembro[];
  /** usuario_id de quien tiene la sesión abierta (lo agrega la API) */
  yo?: string;
  /** Cuaderno de estos datos y el permiso de quien los ve (lo agrega la API) */
  cuaderno?: CuadernoActivo;
  /** Invitaciones pendientes del cuaderno (solo para propietarios) */
  invitaciones?: Invitacion[];
};

/** Datos para crear o editar un rubro, opcionalmente reemplazando sus valores mes a mes. */
export type DatosRubro = {
  categoria_id?: number;
  /** Al crear sin categoría: usa (o crea) la primera categoría de esta sección. */
  seccion?: Seccion;
  nombre?: string;
  saldo?: number | null;
  saldo_usd?: number | null;
  tasa?: number | null;
  cupo?: number | null;
  cupo_de?: number | null;
  dia_corte?: number | null;
  dia_pago?: number | null;
  recurrente?: boolean;
  icono?: string | null;
  /** Valor por mes (AAAA-MM). Si viene, reemplaza todos los valores del rubro. */
  valores?: Record<string, number>;
  /** Meses que se calculan solos (saldo USD × TRM menos lo ya pagado). */
  autos?: string[];
};

export const claveCelda = (rubroId: number, periodoId: string) => `${rubroId}:${periodoId}`;

export const MEDIOS_PAGO = ['Débito / transferencia', 'Efectivo', 'Tarjeta de crédito'] as const;
export const ESTADOS_COMPRA: EstadoCompra[] = ['Pendiente', 'Comprado', 'Ajustar'];
export const CONTROLES = ['Fijo', 'Semi-fijo', 'Flexible'] as const;
export const OTROS_INGRESOS = 'Otros ingresos';
export const OTROS_GASTOS = 'Otros gastos';
export const NOMBRE_CATEGORIA_AHORRO = 'Ahorro y metas';
