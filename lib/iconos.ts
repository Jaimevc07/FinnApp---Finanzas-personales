// Catálogo de íconos que el usuario puede elegir para categorías, metas, listas, deudas y eventos.
// Se guarda la clave (nombre de lucide en kebab-case). Si no hay ícono elegido, se sugiere por el nombre.
import {
  Apple, Baby, Banknote, Bed, Beef, Beer, Bike, Bitcoin, BookOpen, Bone, Briefcase, Building, Building2, Bus, Cake,
  Calendar, CalendarDays, Camera, Candy, Car, CarTaxiFront, Carrot, Cat, ChartLine, Church, CircleParking, Clapperboard,
  ClipboardList, Coffee, Coins, Cookie, CreditCard, Croissant, CupSoda, Dog, Drama, Droplets, Drumstick, Dumbbell, Egg,
  Film, Fish, Flame, Flower2, Footprints, Fuel, Gamepad2, Gem, Gift, Glasses, Globe, GraduationCap, HandCoins, HandHeart,
  Handshake, Headphones, Heart, HeartPulse, Hospital, Hotel, House, IceCreamCone, Key, Lamp, Landmark, Laptop, ListChecks,
  Luggage, Map, Martini, Medal, Milk, Motorbike, Mountain, Music, Package, Paintbrush, PartyPopper, PawPrint, PiggyBank,
  Pill, Pizza, Plane, Popcorn, Receipt, Salad, Sandwich, Scale, School, Scissors, ShieldCheck, Ship, Shirt, ShoppingBasket,
  ShoppingCart, Smartphone, Smile, Sofa, Sparkles, SprayCan, Sprout, Star, Stethoscope, Store, Syringe, Tag, Target, Tent,
  Ticket, TrainFront, TreePalm, TrendingUp, Trophy, Tv, Umbrella, Users, Utensils, Vault, Volleyball, Wallet,
  WashingMachine, Watch, Wheat, Wifi, Wine, Wrench, Zap, type LucideIcon,
} from 'lucide-react';

export type OpcionIcono = { clave: string; nombre: string; icono: LucideIcon };

const o = (clave: string, nombre: string, icono: LucideIcon): OpcionIcono => ({ clave, nombre, icono });

export const GRUPOS_ICONOS: { titulo: string; opciones: OpcionIcono[] }[] = [
  {
    titulo: 'Dinero y metas',
    opciones: [
      o('piggy-bank', 'Alcancía', PiggyBank), o('wallet', 'Billetera', Wallet), o('coins', 'Monedas', Coins),
      o('banknote', 'Billete', Banknote), o('hand-coins', 'Préstamo', HandCoins), o('credit-card', 'Tarjeta', CreditCard),
      o('landmark', 'Banco', Landmark), o('vault', 'Caja fuerte', Vault), o('trending-up', 'Inversión', TrendingUp),
      o('chart-line', 'Rendimiento', ChartLine), o('bitcoin', 'Cripto', Bitcoin), o('receipt', 'Factura', Receipt),
      o('target', 'Meta', Target), o('trophy', 'Logro', Trophy), o('gem', 'Lujo', Gem), o('umbrella', 'Emergencias', Umbrella),
      o('shield-check', 'Seguro', ShieldCheck), o('scale', 'Impuestos', Scale), o('tag', 'Etiqueta', Tag),
      o('calendar-days', 'Mensual', CalendarDays), o('sprout', 'Crecer', Sprout), o('package', 'Otros', Package),
    ],
  },
  {
    titulo: 'Hogar',
    opciones: [
      o('house', 'Casa', House), o('building-2', 'Apartamento', Building2), o('key', 'Arriendo', Key), o('bed', 'Cama', Bed),
      o('sofa', 'Muebles', Sofa), o('lamp', 'Decoración', Lamp), o('zap', 'Luz', Zap), o('droplets', 'Agua', Droplets),
      o('flame', 'Gas', Flame), o('wifi', 'Internet', Wifi), o('tv', 'Televisión', Tv), o('wrench', 'Arreglos', Wrench),
      o('washing-machine', 'Lavandería', WashingMachine), o('spray-can', 'Aseo', SprayCan),
    ],
  },
  {
    titulo: 'Comida y mercado',
    opciones: [
      o('shopping-cart', 'Mercado', ShoppingCart), o('shopping-basket', 'Canasta', ShoppingBasket), o('utensils', 'Restaurante', Utensils),
      o('coffee', 'Café', Coffee), o('pizza', 'Domicilios', Pizza), o('salad', 'Verduras', Salad), o('sandwich', 'Almuerzo', Sandwich),
      o('beef', 'Carne', Beef), o('drumstick', 'Pollo', Drumstick), o('fish', 'Pescado', Fish), o('egg', 'Huevos', Egg),
      o('milk', 'Lácteos', Milk), o('wheat', 'Despensa', Wheat), o('carrot', 'Fruver', Carrot), o('apple', 'Frutas', Apple),
      o('croissant', 'Panadería', Croissant), o('cake', 'Tortas', Cake), o('cookie', 'Mecato', Cookie), o('candy', 'Dulces', Candy),
      o('ice-cream-cone', 'Helado', IceCreamCone), o('cup-soda', 'Bebidas', CupSoda), o('beer', 'Cerveza', Beer),
      o('wine', 'Vino', Wine), o('martini', 'Cócteles', Martini),
    ],
  },
  {
    titulo: 'Transporte y viajes',
    opciones: [
      o('car', 'Carro', Car), o('motorbike', 'Moto', Motorbike), o('bike', 'Bicicleta', Bike), o('fuel', 'Gasolina', Fuel),
      o('circle-parking', 'Parqueadero', CircleParking), o('car-taxi-front', 'Taxi', CarTaxiFront), o('bus', 'Bus', Bus),
      o('train-front', 'Metro', TrainFront), o('plane', 'Avión', Plane), o('luggage', 'Maleta', Luggage), o('hotel', 'Hotel', Hotel),
      o('ship', 'Crucero', Ship), o('tree-palm', 'Playa', TreePalm), o('mountain', 'Montaña', Mountain), o('tent', 'Camping', Tent),
      o('globe', 'Exterior', Globe), o('map', 'Paseo', Map),
    ],
  },
  {
    titulo: 'Salud y cuidado',
    opciones: [
      o('heart-pulse', 'Salud', HeartPulse), o('stethoscope', 'Médico', Stethoscope), o('hospital', 'Clínica', Hospital),
      o('pill', 'Droguería', Pill), o('syringe', 'Vacunas', Syringe), o('glasses', 'Óptica', Glasses), o('dumbbell', 'Gimnasio', Dumbbell),
      o('scissors', 'Peluquería', Scissors), o('sparkles', 'Belleza', Sparkles), o('shirt', 'Ropa', Shirt), o('footprints', 'Zapatos', Footprints),
      o('watch', 'Accesorios', Watch),
    ],
  },
  {
    titulo: 'Familia y mascotas',
    opciones: [
      o('users', 'Familia', Users), o('baby', 'Bebé', Baby), o('heart', 'Pareja', Heart), o('hand-heart', 'Donaciones', HandHeart),
      o('smile', 'Niños', Smile), o('gift', 'Regalos', Gift), o('party-popper', 'Celebración', PartyPopper), o('church', 'Boda', Church),
      o('flower-2', 'Flores', Flower2), o('dog', 'Perro', Dog), o('cat', 'Gato', Cat), o('paw-print', 'Mascotas', PawPrint), o('bone', 'Veterinaria', Bone),
    ],
  },
  {
    titulo: 'Estudio y trabajo',
    opciones: [
      o('graduation-cap', 'Estudios', GraduationCap), o('school', 'Colegio', School), o('book-open', 'Libros', BookOpen),
      o('briefcase', 'Sueldo', Briefcase), o('handshake', 'Negocio', Handshake), o('store', 'Emprendimiento', Store),
      o('building', 'Oficina', Building), o('laptop', 'Computador', Laptop), o('smartphone', 'Celular', Smartphone),
      o('headphones', 'Audífonos', Headphones), o('camera', 'Cámara', Camera), o('paintbrush', 'Arte', Paintbrush),
      o('list-checks', 'Lista', ListChecks), o('clipboard-list', 'Pendientes', ClipboardList), o('calendar', 'Agenda', Calendar),
    ],
  },
  {
    titulo: 'Ocio',
    opciones: [
      o('gamepad-2', 'Videojuegos', Gamepad2), o('music', 'Música', Music), o('film', 'Películas', Film), o('clapperboard', 'Streaming', Clapperboard),
      o('popcorn', 'Cine', Popcorn), o('ticket', 'Entradas', Ticket), o('drama', 'Teatro', Drama), o('volleyball', 'Deporte', Volleyball),
      o('medal', 'Competencia', Medal), o('star', 'Favorito', Star),
    ],
  },
];

const POR_CLAVE: Record<string, OpcionIcono> = Object.fromEntries(GRUPOS_ICONOS.flatMap(g => g.opciones).map(x => [x.clave, x]));

export const opcionIcono = (clave: string | null | undefined): OpcionIcono | undefined => (clave ? POR_CLAVE[clave] : undefined);

/** Íconos por defecto de las categorías del Excel y de las listas de mercado. */
const POR_NOMBRE: Record<string, string> = {
  'Ingresos Fijos': 'briefcase',
  'Ingresos Extra': 'gift',
  'Otros ingresos': 'coins',
  'Vivienda y Educación': 'house',
  'Alimentación y Hogar': 'utensils',
  'Transporte y Salud': 'bus',
  'Suscripciones Digitales': 'tv',
  'Obligaciones Fijas': 'landmark',
  'Ocio y Salidas': 'party-popper',
  'Cuidado Personal y Ropa': 'shirt',
  'Eventos y Viajes': 'plane',
  'Pago Deudas Tarjetas': 'credit-card',
  'Pago Deudas Créditos': 'hand-coins',
  'Ahorro y metas': 'piggy-bank',
  'Otros gastos': 'receipt',
  'Proteínas y Lácteos': 'milk',
  'Despensa y Panadería': 'wheat',
  'Verduras Básicas': 'carrot',
  'Aseo Hogar y Personal': 'spray-can',
  'Proteína Fresca Semanal': 'beef',
};

/** Sugerencias por palabras del nombre (el primer patrón que coincida gana). */
const PATRONES: [RegExp, string][] = [
  [/carro|auto(?!m)|veh[ií]culo/, 'car'],
  [/moto/, 'motorbike'],
  [/viaje|vacaci|paseo|tour/, 'plane'],
  [/playa|mar\b|caribe|cartagena|santa marta|san andr/, 'tree-palm'],
  [/casa|apartamento|vivienda|lote|finca/, 'house'],
  [/arriendo|alquiler/, 'key'],
  [/estudi|maestr|universi|curso|matr[ií]cula|semestre/, 'graduation-cap'],
  [/colegio|escuela|jard[ií]n/, 'school'],
  [/celular|tel[eé]fono|iphone/, 'smartphone'],
  [/computador|port[aá]til|laptop/, 'laptop'],
  [/emergencia|imprevisto|colch[oó]n/, 'umbrella'],
  [/seguro|p[oó]liza|soat/, 'shield-check'],
  [/salud|m[eé]dic|eps|prepagada|odont|dentista/, 'heart-pulse'],
  [/droguer|farmacia|medicament/, 'pill'],
  [/boda|matrimonio/, 'church'],
  [/beb[eé]|pañal|baby/, 'baby'],
  [/cumplea|regalo|navidad|prima|bono|aguinaldo/, 'gift'],
  [/fiesta|celebra|shower|evento/, 'party-popper'],
  [/mascota|perr|gat[oa]|veterin/, 'paw-print'],
  [/l[aá]cteo|leche|queso|yogur/, 'milk'],
  [/prote[ií]na|carne|res\b|cerdo/, 'beef'],
  [/pollo/, 'drumstick'],
  [/pescado|mariscos|at[uú]n/, 'fish'],
  [/huevo/, 'egg'],
  [/verdura|hortaliza|fruver/, 'carrot'],
  [/fruta/, 'apple'],
  [/despensa|granos|abarrote|enlatado/, 'wheat'],
  [/panader|pan\b/, 'croissant'],
  [/bebida|gaseosa|jugo/, 'cup-soda'],
  [/mercado|supermercado|compras/, 'shopping-cart'],
  [/almuerzo|restaurante|comida/, 'utensils'],
  [/caf[eé]/, 'coffee'],
  [/domicilio|pizza|rappi/, 'pizza'],
  [/torta|pastel/, 'cake'],
  [/mecato|dulce|snack/, 'cookie'],
  [/cerveza|trago|licor|bar\b/, 'beer'],
  [/gasolina|combustible|tanqueo/, 'fuel'],
  [/parqueadero|parqueo/, 'circle-parking'],
  [/taxi|uber|didi|transporte/, 'car-taxi-front'],
  [/bus|transmilenio|metro/, 'bus'],
  [/gimnasio|gym|deporte/, 'dumbbell'],
  [/luz|energ[ií]a|servicios/, 'zap'],
  [/agua|acueducto/, 'droplets'],
  [/\bgas\b/, 'flame'],
  [/internet|wifi|fibra/, 'wifi'],
  [/netflix|youtube|disney|prime|hbo|max\b|tv/, 'tv'],
  [/spotify|m[uú]sica|deezer/, 'music'],
  [/icloud|google one|nube/, 'laptop'],
  [/ropa|vestuario/, 'shirt'],
  [/zapato|tenis/, 'footprints'],
  [/barber|peluquer|cabello|uñas|manicure|skincare|belleza/, 'scissors'],
  [/sueldo|salario|n[oó]mina|honorario/, 'briefcase'],
  [/negocio|emprend|venta/, 'store'],
  [/inversi[oó]n|cdt|acciones|fondo de inv/, 'trending-up'],
  [/cripto|bitcoin/, 'bitcoin'],
  [/tarjeta|\btc\b|visa|master|amex/, 'credit-card'],
  [/cr[eé]dito|pr[eé]stamo|cuota|libre inversi/, 'hand-coins'],
  [/banco|mora|acuerdo/, 'landmark'],
  [/impuesto|predial|dian|renta/, 'scale'],
  [/ahorro|fondo|reserva/, 'piggy-bank'],
  [/ocio|salida|cine/, 'popcorn'],
  [/aseo|limpieza/, 'spray-can'],
];

export function sugerirIcono(nombre: string): string | null {
  const n = nombre.toLowerCase();
  for (const [re, clave] of PATRONES) if (re.test(n)) return clave;
  return null;
}

/** Ícono a mostrar: el elegido; si no, el del nombre exacto; si no, uno sugerido por palabras; si no, el de respaldo. */
export function claveIcono(elegido: string | null | undefined, nombre: string, respaldo: string): string {
  if (elegido && POR_CLAVE[elegido]) return elegido;
  return POR_NOMBRE[nombre] ?? sugerirIcono(nombre) ?? respaldo;
}

export function resolverIcono(elegido: string | null | undefined, nombre: string, respaldo: string): LucideIcon {
  return POR_CLAVE[claveIcono(elegido, nombre, respaldo)]?.icono ?? Package;
}

type ConIcono = { icono: string | null; nombre: string };

export const iconoCategoria = (c: ConIcono) => resolverIcono(c.icono, c.nombre, 'package');
export const iconoMeta = (m: ConIcono) => resolverIcono(m.icono, m.nombre, 'target');
export const iconoLista = (l: ConIcono) => resolverIcono(l.icono, l.nombre, 'list-checks');

/** Deudas, viajes y eventos: el ícono del rubro, o el de su categoría. */
export function iconoRubro(r: ConIcono, categoria?: ConIcono): LucideIcon {
  if (r.icono && POR_CLAVE[r.icono]) return POR_CLAVE[r.icono].icono;
  const sugerido = sugerirIcono(r.nombre);
  if (sugerido) return POR_CLAVE[sugerido].icono;
  return categoria ? iconoCategoria(categoria) : Package;
}

/** Ícono de una categoría por su nombre (movimientos y productos de las listas). */
export function iconoDe(categoria: string, categorias: ConIcono[] = []): LucideIcon {
  const c = categorias.find(x => x.nombre === categoria);
  return c ? iconoCategoria(c) : resolverIcono(null, categoria, 'package');
}
