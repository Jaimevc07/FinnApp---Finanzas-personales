// Plantilla de Excel: se descarga con el plan actual (o sin montos), se llena en Excel o
// Google Sheets y se vuelve a subir. Solo se usa en el servidor (exceljs).
import ExcelJS from 'exceljs';
import { valorCelda } from '../calculos';
import { esMes, etiquetaMes, sumarMeses, mesesEntre } from '../meses';
import { claveCelda, type Config, type Estado, type ModoMeta, type Seccion } from '../tipos';

export type FilaRubroPlantilla = {
  seccion: Seccion;
  categoria: string;
  nombre: string;
  recurrente: boolean;
  saldo: number | null;
  saldo_usd: number | null;
  tasa: number | null;
  cupo: number | null;
  /** Nombre de la deuda cuyo cupo usa (misma tarjeta) */
  cupoDe: string | null;
  valores: Record<string, number>;
  autos: string[];
};
export type FilaMetaPlantilla = {
  nombre: string; detalle: string; objetivo: number; periodo_objetivo: string | null; ahorrado: number; modo: ModoMeta;
};
export type DatosPlantilla = {
  meses: string[];
  /** Categorías en el orden en que aparecen (incluye las que no tienen rubros) */
  categorias: { nombre: string; seccion: Seccion }[];
  rubros: FilaRubroPlantilla[];
  metas: FilaMetaPlantilla[];
  config: Partial<Config>;
};

/* ---------- Textos de la plantilla ---------- */
const HOJA_PRESUPUESTO = 'Presupuesto';
const HOJA_METAS = 'Metas';
const HOJA_CONFIG = 'Configuración';

const NOMBRE_SECCION: Record<Seccion, string> = {
  ingreso: 'Ingreso', operativo: 'Gasto del hogar', deuda: 'Deuda', evento: 'Viaje o evento', ahorro: 'Ahorro',
};
const ORDEN_SECCIONES: Seccion[] = ['ingreso', 'operativo', 'deuda', 'evento', 'ahorro'];
const MODO_TEXTO: Record<ModoMeta, string> = { aportes: 'Aporte mensual', caja: 'Con lo que sobra' };

const COL = {
  seccion: 'Sección', categoria: 'Categoría', rubro: 'Rubro', todos: 'Todos los meses',
  saldo: 'Saldo deuda (COP)', saldoUsd: 'Saldo deuda (USD)', tasa: 'Interés mensual (%)', cupo: 'Cupo tarjeta (COP)',
  cupoDe: 'Usa el cupo de',
};
/** Columnas fijas antes de los meses (A–I) */
const FIJAS = 9;
const COL_META = { nombre: 'Meta', objetivo: 'Valor de la meta', para: 'Para (mes)', ahorrado: 'Ya ahorrado', modo: 'Cómo se ahorra', detalle: 'Detalle' };

const CONFIG_FILAS: { clave: keyof Config; etiqueta: string; texto?: boolean }[] = [
  { clave: 'hogar', etiqueta: 'Nombre del hogar', texto: true },
  { clave: 'saldo_inicial', etiqueta: 'Saldo en cuenta al empezar el plan' },
  { clave: 'trm', etiqueta: 'TRM actual (pesos por dólar)' },
  { clave: 'trm_referencia', etiqueta: 'TRM de referencia' },
  { clave: 'ingreso_2028', etiqueta: 'Ingresos mensuales después del plan' },
  { clave: 'operativo_2028', etiqueta: 'Gasto del hogar mensual después del plan' },
  { clave: 'cuota_carro_2028', etiqueta: 'Nuevas cuotas mensuales después del plan' },
  { clave: 'nota_2028', etiqueta: 'Nota de la proyección', texto: true },
];

const INSTRUCCIONES = [
  'Plantilla de Finanzas Hogar',
  '',
  'Cómo usarla',
  '1. Llena las hojas "Presupuesto", "Metas" y "Configuración" en Excel o Google Sheets.',
  '2. En la app: Ajustes → Restablecer datos → Desde una plantilla de Excel → sube este archivo.',
  '3. Al subirla se reemplazan el presupuesto, las deudas, los viajes, las metas y la configuración. Las listas de compras se conservan.',
  '',
  'Hoja "Presupuesto": una fila por rubro',
  '• Sección: Ingreso, Gasto del hogar, Deuda, Viaje o evento, o Ahorro.',
  '• Categoría: agrupa rubros parecidos (ej. Vivienda, Transporte). Si la dejas vacía se usa una por defecto.',
  '• Todos los meses: "Sí" si se repite cada mes; "No" si solo aplica en los meses con valor (primas, bonos, pagos anuales).',
  '• Columnas de meses: el valor en pesos de ese rubro en ese mes, sin decimales. Vacío = 0.',
  '• Puedes agregar meses al final (escribe el encabezado como "Feb 2028") o borrar columnas de meses.',
  '• Deudas: escribe el saldo que se debe hoy (en pesos o en dólares) y el interés mensual en % (ej. 2,1).',
  '• Tarjetas de crédito: escribe su cupo total para ver cuánto cupo queda al registrar compras con ella.',
  '• Si una tarjeta tiene dos deudas (una en pesos y otra en dólares), pon el cupo en una y en la otra escribe en "Usa el cupo de" el nombre de la primera.',
  '• "AUTO" en un mes de una deuda en dólares = ese mes se paga todo el saldo con la TRM vigente.',
  '',
  'Hoja "Metas"',
  '• Para (mes): el mes en que quieren lograrla, como "Dic 2030". Puede ser después del último mes del plan.',
  '• Cómo se ahorra: "Aporte mensual" o "Con lo que sobra" (se mide contra la caja acumulada).',
  '• El aporte mensual de una meta va en "Presupuesto" como fila de Ahorro llamada "Ahorro · <nombre de la meta>".',
  '',
  'No cambies los nombres de las hojas ni los encabezados de las columnas.',
];

/* ---------- Descargar ---------- */
const NEGRO = 'FF111113', BLANCO = 'FFFFFFFF', GRIS = 'FFEEEDE9', NARANJA = 'FFF26411';

function encabezado(ws: ExcelJS.Worksheet) {
  const fila = ws.getRow(1);
  fila.font = { bold: true, color: { argb: BLANCO } };
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
  fila.alignment = { vertical: 'middle' };
  fila.height = 22;
}

function lista(ws: ExcelJS.Worksheet, col: number, opciones: string[], hasta = 400) {
  for (let r = 2; r <= hasta; r++) {
    ws.getCell(r, col).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`"${opciones.join(',')}"`],
      showErrorMessage: true, errorTitle: 'Valor no válido', error: `Elige: ${opciones.join(', ')}`,
    };
  }
}

/** Arma el .xlsx. Con "vacia" conserva la estructura (secciones, categorías, rubros y metas) sin montos. */
export async function generarPlantilla(e: Estado, vacia: boolean): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Finanzas Hogar';
  wb.created = new Date();

  // Instrucciones
  const ins = wb.addWorksheet('Instrucciones', { properties: { tabColor: { argb: NARANJA } } });
  ins.getColumn(1).width = 120;
  INSTRUCCIONES.forEach((t, i) => {
    const c = ins.getCell(i + 1, 1);
    c.value = t;
    c.alignment = { wrapText: true, vertical: 'top' };
    if (i === 0) c.font = { bold: true, size: 16 };
    else if (t && !t.startsWith('•') && !/^\d\./.test(t)) c.font = { bold: true };
  });

  // Presupuesto
  const meses = e.periodos.map(p => p.id);
  const ws = wb.addWorksheet(HOJA_PRESUPUESTO, { views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] });
  ws.columns = [
    { header: COL.seccion, width: 17 }, { header: COL.categoria, width: 26 }, { header: COL.rubro, width: 38 },
    { header: COL.todos, width: 15 }, { header: COL.saldo, width: 17 }, { header: COL.saldoUsd, width: 17 }, { header: COL.tasa, width: 18 },
    { header: COL.cupo, width: 18 }, { header: COL.cupoDe, width: 30 },
    ...meses.map(m => ({ header: etiquetaMes(m), width: 13 })),
  ];
  encabezado(ws);
  const metasPorRubro = new Set(e.metas.map(m => m.rubro_id).filter(Boolean));
  // En el mismo orden de la app, para que subirla sin cambios deje todo igual.
  for (const c of e.categorias) {
    const deCategoria = e.rubros.filter(x => x.categoria_id === c.id);
    // Una categoría sin rubros va como fila sin rubro: así no se pierde al subir la plantilla.
    if (!deCategoria.length) ws.addRow([NOMBRE_SECCION[c.seccion], c.nombre]);
    for (const r of deCategoria) {
      const esDeuda = c.seccion === 'deuda';
      const celdas = meses.map(m => {
        if (vacia) return null;
        const cel = e.valores[claveCelda(r.id, m)];
        if (cel?.auto) return 'AUTO';
        const v = valorCelda(e, r, m);
        return v ? Math.round(v) : null;
      });
      const fila = ws.addRow([
        NOMBRE_SECCION[c.seccion], c.nombre, r.nombre, r.recurrente ? 'Sí' : 'No',
        esDeuda && !vacia ? r.saldo ?? null : null,
        esDeuda && !vacia ? r.saldo_usd ?? null : null,
        esDeuda && !vacia ? r.tasa ?? null : null,
        esDeuda ? r.cupo ?? null : null, // el cupo no es un monto del mes: se conserva también en blanco
        esDeuda && r.cupo_de ? e.rubros.find(x => x.id === r.cupo_de)?.nombre ?? null : null,
        ...celdas,
      ]);
      if (metasPorRubro.has(r.id)) fila.getCell(3).font = { italic: true };
    }
  }
  for (let i = 0; i < meses.length; i++) ws.getColumn(FIJAS + 1 + i).numFmt = '#,##0';
  ws.getColumn(5).numFmt = '#,##0';
  ws.getColumn(6).numFmt = '#,##0.00';
  ws.getColumn(7).numFmt = '0.00';
  ws.getColumn(8).numFmt = '#,##0';
  for (const col of [5, 6, 7, 8, 9]) ws.getColumn(col).eachCell((cel, n) => { if (n > 1) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }; });
  lista(ws, 1, ORDEN_SECCIONES.map(s => NOMBRE_SECCION[s]));
  lista(ws, 4, ['Sí', 'No']);

  // Metas
  const wm = wb.addWorksheet(HOJA_METAS, { views: [{ state: 'frozen', ySplit: 1 }] });
  wm.columns = [
    { header: COL_META.nombre, width: 30 }, { header: COL_META.objetivo, width: 18 }, { header: COL_META.para, width: 14 },
    { header: COL_META.ahorrado, width: 16 }, { header: COL_META.modo, width: 20 }, { header: COL_META.detalle, width: 36 },
  ];
  encabezado(wm);
  for (const m of e.metas) {
    const obj = m.periodo_objetivo ?? meses.at(-1) ?? null;
    wm.addRow([m.nombre, vacia ? null : m.objetivo || null, obj ? etiquetaMes(obj) : null, vacia ? null : m.ahorrado || null, MODO_TEXTO[m.modo], m.detalle || null]);
  }
  wm.getColumn(2).numFmt = '#,##0';
  wm.getColumn(4).numFmt = '#,##0';
  lista(wm, 5, Object.values(MODO_TEXTO), 100);

  // Configuración (la columna C guarda la clave para leerla aunque cambie el texto)
  const wc = wb.addWorksheet(HOJA_CONFIG);
  wc.columns = [{ header: 'Dato', width: 44 }, { header: 'Valor', width: 26 }, { header: 'Clave (no cambiar)', width: 18 }];
  encabezado(wc);
  for (const f of CONFIG_FILAS) {
    const v = e.config[f.clave];
    const conservar = f.clave === 'hogar' || f.clave === 'trm' || f.clave === 'trm_referencia' || f.clave === 'nota_2028';
    wc.addRow([f.etiqueta, vacia && !conservar ? null : (v === '' || v === 0 ? null : v), f.clave]);
  }
  wc.getColumn(2).numFmt = '#,##0';
  wc.getColumn(3).hidden = true;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/* ---------- Subir ---------- */
const normal = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Valor "plano" de una celda de exceljs (fórmulas, texto enriquecido, hipervínculos). */
function plano(v: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return plano((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map(x => x.text).join('');
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ('error' in v) return null;
    return null;
  }
  return v as string | number | boolean | Date;
}

const texto = (v: ExcelJS.CellValue) => {
  const p = plano(v);
  return p === null ? '' : p instanceof Date ? p.toISOString().slice(0, 10) : String(p).trim();
};

const NOMBRES_MES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6,
  jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, set: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

/** "Nov 2026", "noviembre-2026", "2026-11", "11/2026" o una fecha de Excel → "2026-11". */
export function leerMes(v: ExcelJS.CellValue): string | null {
  const p = plano(v);
  if (p instanceof Date) return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`;
  if (typeof p === 'number' && p > 20000 && p < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + p * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const s = normal(p);
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) { const id = `${m[1]}-${m[2].padStart(2, '0')}`; return esMes(id) ? id : null; }
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) { const id = `${m[2]}-${m[1].padStart(2, '0')}`; return esMes(id) ? id : null; }
  m = s.match(/^([a-z]+)\.?[\s\-/.]*(?:de\s+)?(\d{2,4})$/);
  if (m && NOMBRES_MES[m[1]]) {
    const anio = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return `${anio}-${String(NOMBRES_MES[m[1]]).padStart(2, '0')}`;
  }
  return null;
}

function leerSeccion(v: string): Seccion | null {
  const s = normal(v);
  if (!s) return null;
  if (/^ingresos?$/.test(s)) return 'ingreso';
  if (/^(gastos?( del hogar)?|operativos?)$/.test(s)) return 'operativo';
  if (/^(deudas?|pagos? de deudas?)$/.test(s)) return 'deuda';
  if (/^(viajes?|eventos?|viajes? (o|y) eventos?)$/.test(s)) return 'evento';
  if (/^(ahorros?|ahorro y metas|metas?)$/.test(s)) return 'ahorro';
  return null;
}

function leerSiNo(v: string): boolean | null {
  const s = normal(v);
  if (!s) return null;
  if (['si', 's', 'x', '1', 'true', 'verdadero', 'yes', 'todos'].includes(s)) return true;
  if (['no', 'n', '0', 'false', 'falso'].includes(s)) return false;
  return null;
}

export class ErrorPlantilla extends Error {}

/** Número en pesos o decimal: 1250000, "1.250.000", "$ 1.250.000", "2,1". Vacío = null. */
function leerNumero(v: ExcelJS.CellValue, donde: string, decimales = false): number | null {
  const p = plano(v);
  if (p === null || p === '') return null;
  if (typeof p === 'number') {
    if (p < 0) throw new ErrorPlantilla(`${donde}: no se permiten valores negativos`);
    return decimales ? p : Math.round(p);
  }
  if (typeof p === 'boolean' || p instanceof Date) throw new ErrorPlantilla(`${donde}: debe ser un número`);
  const s = String(p).replace(/[$\s %]|cop|usd|us/gi, '');
  if (!s) return null;
  let n: number;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) n = Number(s.replace(/,/g, ''));
  else n = Number(s);
  if (!Number.isFinite(n)) throw new ErrorPlantilla(`${donde}: «${String(p)}» no es un número`);
  if (n < 0) throw new ErrorPlantilla(`${donde}: no se permiten valores negativos`);
  return decimales ? n : Math.round(n);
}

const letra = (col: number) => {
  let s = '';
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Lee y valida el archivo subido. Los errores dicen la hoja, la fila y la columna. */
export async function leerPlantilla(buf: ArrayBuffer): Promise<DatosPlantilla> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new ErrorPlantilla('El archivo no es un Excel (.xlsx) válido. Descarga la plantilla y vuelve a intentarlo.');
  }
  const hoja = (nombre: string) => wb.worksheets.find(w => normal(w.name) === normal(nombre));
  const ws = hoja(HOJA_PRESUPUESTO);
  if (!ws) throw new ErrorPlantilla(`No encontré la hoja "${HOJA_PRESUPUESTO}". Usa la plantilla descargada desde la app.`);

  // Encabezados: columnas fijas por nombre y columnas de meses por su fecha
  const cab = ws.getRow(1);
  const col: Partial<Record<keyof typeof COL, number>> = {};
  const colMes: { col: number; mes: string }[] = [];
  cab.eachCell((c, n) => {
    const t = normal(texto(c.value));
    const fija = (Object.keys(COL) as (keyof typeof COL)[]).find(k => normal(COL[k]) === t);
    if (fija) { col[fija] = n; return; }
    const mes = leerMes(c.value);
    if (mes) colMes.push({ col: n, mes });
  });
  for (const k of ['seccion', 'rubro'] as const) {
    if (!col[k]) throw new ErrorPlantilla(`Hoja "${HOJA_PRESUPUESTO}": falta la columna "${COL[k]}" en la fila 1.`);
  }
  if (!colMes.length) throw new ErrorPlantilla(`Hoja "${HOJA_PRESUPUESTO}": no hay columnas de meses (encabezados como "Nov 2026").`);
  const repetido = colMes.find((x, i) => colMes.findIndex(y => y.mes === x.mes) !== i);
  if (repetido) throw new ErrorPlantilla(`Hoja "${HOJA_PRESUPUESTO}": el mes ${etiquetaMes(repetido.mes)} está dos veces.`);

  // Meses del plan: del primero al último, sin huecos (los meses que falten quedan en $ 0)
  const ordenados = colMes.map(x => x.mes).sort();
  const total = mesesEntre(ordenados[0], ordenados.at(-1)!) + 1;
  if (total > 120) throw new ErrorPlantilla('El plan no puede tener más de 120 meses (10 años).');
  const meses = Array.from({ length: total }, (_, i) => sumarMeses(ordenados[0], i));

  const rubros: FilaRubroPlantilla[] = [];
  const categorias: DatosPlantilla['categorias'] = [];
  const seccionDeCategoria = new Map<string, { seccion: Seccion; fila: number }>();
  ws.eachRow({ includeEmpty: false }, (fila, n) => {
    if (n === 1) return;
    const nombre = texto(fila.getCell(col.rubro!).value);
    const secTxt = texto(fila.getCell(col.seccion!).value);
    const categoria = (col.categoria ? texto(fila.getCell(col.categoria).value) : '').slice(0, 80);
    if (!nombre && !secTxt && !categoria) return; // fila vacía
    const donde = (c?: number) => `Hoja "${HOJA_PRESUPUESTO}", fila ${n}${c ? `, columna ${letra(c)}` : ''}`;
    const seccion = leerSeccion(secTxt);
    if (!seccion) {
      throw new ErrorPlantilla(secTxt
        ? `${donde(col.seccion)}: la sección «${secTxt}» no existe. Usa: ${ORDEN_SECCIONES.map(s => NOMBRE_SECCION[s]).join(', ')}.`
        : `${donde(col.seccion)}: falta la sección (${ORDEN_SECCIONES.map(s => NOMBRE_SECCION[s]).join(', ')}).`);
    }
    if (categoria) {
      const previa = seccionDeCategoria.get(normal(categoria));
      if (previa && previa.seccion !== seccion) {
        throw new ErrorPlantilla(`${donde(col.categoria)}: la categoría «${categoria}» ya se usó como ${NOMBRE_SECCION[previa.seccion]} en la fila ${previa.fila}.`);
      }
      if (!previa) categorias.push({ nombre: categoria, seccion });
      seccionDeCategoria.set(normal(categoria), { seccion, fila: n });
    }
    if (!nombre) {
      if (categoria) return; // categoría sin rubros
      throw new ErrorPlantilla(`${donde(col.rubro)}: falta el nombre del rubro.`);
    }
    const todosTxt = col.todos ? texto(fila.getCell(col.todos).value) : '';
    const todos = leerSiNo(todosTxt);
    if (todosTxt && todos === null) throw new ErrorPlantilla(`${donde(col.todos)}: escribe "Sí" o "No".`);

    let tasa = col.tasa ? leerNumero(fila.getCell(col.tasa).value, donde(col.tasa), true) : null;
    if (tasa !== null && col.tasa && fila.getCell(col.tasa).numFmt?.includes('%')) tasa = tasa * 100;
    const valores: Record<string, number> = {};
    const autos: string[] = [];
    for (const x of colMes) {
      const v = fila.getCell(x.col).value;
      if (normal(texto(v)) === 'auto') { autos.push(x.mes); continue; }
      const num = leerNumero(v, donde(x.col));
      if (num) valores[x.mes] = num;
    }
    const saldoUsd = col.saldoUsd ? leerNumero(fila.getCell(col.saldoUsd).value, donde(col.saldoUsd), true) : null;
    if (autos.length && seccion !== 'deuda') throw new ErrorPlantilla(`${donde()}: "AUTO" solo sirve en deudas en dólares.`);
    if (autos.length && !saldoUsd) throw new ErrorPlantilla(`${donde(col.saldoUsd)}: para usar "AUTO" escribe el saldo de la deuda en dólares.`);
    rubros.push({
      seccion,
      categoria,
      nombre: nombre.slice(0, 120),
      recurrente: todos ?? !['evento', 'deuda'].includes(seccion),
      saldo: seccion === 'deuda' && col.saldo ? leerNumero(fila.getCell(col.saldo).value, donde(col.saldo)) : null,
      saldo_usd: seccion === 'deuda' ? saldoUsd : null,
      tasa: seccion === 'deuda' ? tasa : null,
      cupo: seccion === 'deuda' && col.cupo ? leerNumero(fila.getCell(col.cupo).value, donde(col.cupo)) : null,
      cupoDe: seccion === 'deuda' && col.cupoDe ? texto(fila.getCell(col.cupoDe).value) || null : null,
      valores,
      autos,
    });
  });

  // Metas (opcional)
  const metas: FilaMetaPlantilla[] = [];
  const wm = hoja(HOJA_METAS);
  if (wm) {
    const cm: Partial<Record<keyof typeof COL_META, number>> = {};
    wm.getRow(1).eachCell((c, n) => {
      const k = (Object.keys(COL_META) as (keyof typeof COL_META)[]).find(x => normal(COL_META[x]) === normal(texto(c.value)));
      if (k) cm[k] = n;
    });
    if (cm.nombre) {
      wm.eachRow({ includeEmpty: false }, (fila, n) => {
        if (n === 1) return;
        const nombre = texto(fila.getCell(cm.nombre!).value);
        if (!nombre) return;
        const donde = (c?: number) => `Hoja "${HOJA_METAS}", fila ${n}${c ? `, columna ${letra(c)}` : ''}`;
        const paraV = cm.para ? fila.getCell(cm.para).value : null;
        const para = cm.para ? leerMes(paraV) : null;
        if (cm.para && texto(paraV) && !para) throw new ErrorPlantilla(`${donde(cm.para)}: «${texto(paraV)}» no es un mes. Escríbelo como "Dic 2030".`);
        const modoTxt = cm.modo ? normal(texto(fila.getCell(cm.modo).value)) : '';
        metas.push({
          nombre: nombre.slice(0, 80),
          detalle: cm.detalle ? texto(fila.getCell(cm.detalle).value).slice(0, 120) : '',
          objetivo: (cm.objetivo ? leerNumero(fila.getCell(cm.objetivo).value, donde(cm.objetivo)) : 0) ?? 0,
          periodo_objetivo: para,
          ahorrado: (cm.ahorrado ? leerNumero(fila.getCell(cm.ahorrado).value, donde(cm.ahorrado)) : 0) ?? 0,
          modo: /sobra|caja/.test(modoTxt) ? 'caja' : 'aportes',
        });
      });
    }
  }

  // Configuración (opcional): por la clave oculta o por el texto del dato
  const config: Partial<Config> = {};
  const wc = hoja(HOJA_CONFIG);
  if (wc) {
    wc.eachRow({ includeEmpty: false }, (fila, n) => {
      if (n === 1) return;
      const clave = texto(fila.getCell(3).value);
      const etiqueta = normal(texto(fila.getCell(1).value));
      const f = CONFIG_FILAS.find(x => x.clave === clave) ?? CONFIG_FILAS.find(x => normal(x.etiqueta) === etiqueta);
      if (!f) return;
      const v = fila.getCell(2).value;
      if (f.texto) { const t = texto(v); if (t || f.clave === 'nota_2028') (config as Record<string, unknown>)[f.clave] = t; }
      else (config as Record<string, unknown>)[f.clave] = leerNumero(v, `Hoja "${HOJA_CONFIG}", fila ${n}, columna B`, f.clave === 'trm' || f.clave === 'trm_referencia') ?? 0;
    });
  }

  // "Usa el cupo de" debe nombrar otra deuda de la plantilla
  for (const r of rubros) {
    if (r.cupoDe && !rubros.some(x => x !== r && x.seccion === 'deuda' && normal(x.nombre) === normal(r.cupoDe!))) {
      throw new ErrorPlantilla(`Hoja "${HOJA_PRESUPUESTO}": «${r.nombre}» usa el cupo de «${r.cupoDe}», pero no hay una deuda con ese nombre.`);
    }
  }

  return { meses, categorias, rubros, metas, config };
}

export const nombreArchivo = (vacia: boolean) =>
  `plantilla-finanzas-hogar${vacia ? '-en-blanco' : ''}-${new Date().toISOString().slice(0, 10)}.xlsx`;
