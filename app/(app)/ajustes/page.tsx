'use client';
import { CircleAlert, Download, Eraser, FileSpreadsheet, Layers, Monitor, Moon, RotateCcw, Share, Smartphone, SquarePlus, Sun, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TarjetaCuaderno, TarjetaCuenta, TarjetaInvitarApp, TarjetaPersonas } from '@/components/cuenta';
import { EstadoConexion } from '@/components/navegacion';
import { useDatos } from '@/components/proveedor';
import { ConDatos } from '@/components/shell';
import { BotonPrimario, PastillaSuave, cx } from '@/components/ui/botones';
import { Campo, Entrada } from '@/components/ui/campos';
import { EncabezadoPantalla, Tarjeta } from '@/components/ui/estructura';

type Tema = 'sistema' | 'claro' | 'oscuro';
type Modo = 'ceros' | 'vacio' | 'plantilla';

const OPCIONES_RESTABLECER: { valor: Modo; titulo: string; texto: string; icono: typeof Eraser }[] = [
  { valor: 'ceros', titulo: 'Todo en $ 0', icono: Eraser,
    texto: 'Conserva los nombres de rubros, deudas, metas y productos como plantilla, y deja todos los montos en $ 0.' },
  { valor: 'vacio', titulo: 'Borrar todo', icono: Layers,
    texto: 'Elimina rubros, deudas, metas y listas. Quedan solo las categorías y los meses del plan.' },
  { valor: 'plantilla', titulo: 'Desde una plantilla de Excel', icono: FileSpreadsheet,
    texto: 'Descarga la plantilla, llénala en Excel o Google Sheets y súbela. Reemplaza presupuesto, deudas, metas y configuración; las listas de compras se conservan.' },
];

const clasePastilla = 'foco inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[13px] font-semibold text-accent-strong transition hover:brightness-95 active:scale-[0.97]';
type EventoInstalar = Event & { prompt: () => Promise<void> };

export default function Ajustes() {
  return (
    <ConDatos>
      <VistaAjustes />
    </ConDatos>
  );
}

function aplicarTema(t: Tema) {
  const r = document.documentElement;
  if (t === 'sistema') delete r.dataset.theme;
  else r.dataset.theme = t === 'oscuro' ? 'dark' : 'light';
  const oscuro = t === 'oscuro' || (t === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', oscuro ? '#0b0b0c' : '#f4f3f0'));
  try { if (t === 'sistema') localStorage.removeItem('fh-tema'); else localStorage.setItem('fh-tema', t); } catch { /* */ }
}

function VistaAjustes() {
  const { estado, puedeEditar, restablecer, importar, cargarPlantilla, avisar } = useDatos();
  const [tema, setTema] = useState<Tema>('sistema');
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [conservar, setConservar] = useState(false);
  const [modo, setModo] = useState<Modo>('ceros');
  const archivo = useRef<HTMLInputElement>(null);
  const entradaPlantilla = useRef<HTMLInputElement>(null);
  const [plantilla, setPlantilla] = useState<File | null>(null);
  const [errorPlantilla, setErrorPlantilla] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    try { const t = localStorage.getItem('fh-tema'); if (t === 'claro' || t === 'oscuro') setTema(t); } catch { /* */ }
    setInstalada(matchMedia('(display-mode: standalone)').matches);
    const h = (e: Event) => { e.preventDefault(); setInstalar(e as EventoInstalar); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const exportar = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' }));
    a.download = `finanzas-hogar-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <EncabezadoPantalla titulo="Ajustes" subtitulo={<EstadoConexion />} />
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5">
          <TarjetaCuaderno />
          <TarjetaPersonas />
          <TarjetaCuenta />
          <TarjetaInvitarApp />
          <Tarjeta titulo="Apariencia" subtitulo="El modo oscuro también cuida la batería en pantallas OLED">
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
              {([['sistema', 'Sistema', Monitor], ['claro', 'Claro', Sun], ['oscuro', 'Oscuro', Moon]] as const).map(([v, l, I]) => (
                <button key={v} type="button" role="radio" aria-checked={tema === v}
                  onClick={() => { setTema(v); aplicarTema(v); }}
                  className={cx('foco flex flex-col items-center gap-2 rounded-2xl border p-3 text-[13px] font-semibold transition',
                    tema === v ? 'border-accent bg-accent-soft text-ink' : 'border-line hover:bg-surface-2')}>
                  <I className={cx('size-5', tema === v && 'text-accent-strong')} /> {l}
                </button>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Instalar en el celular" subtitulo={instalada ? 'Ya estás usando la app instalada.' : 'Funciona como una app: ícono propio, pantalla completa y abre sin conexión.'}>
            {instalar && (
              <BotonPrimario className="mb-4 w-full" onClick={async () => { await instalar.prompt(); setInstalar(null); }}>
                <Smartphone /> Instalar ahora
              </BotonPrimario>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-[13px] font-semibold">iPhone (Safari)</p>
                <ol className="mt-2 flex flex-col gap-1.5 text-[12px] text-ink-2">
                  <li className="flex items-center gap-1.5">1. Toca <Share className="size-3.5" /> Compartir</li>
                  <li className="flex items-center gap-1.5">2. Elige <SquarePlus className="size-3.5" /> Agregar a inicio</li>
                  <li>3. Confirma con “Agregar”</li>
                </ol>
              </div>
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="text-[13px] font-semibold">Android (Chrome)</p>
                <ol className="mt-2 flex flex-col gap-1.5 text-[12px] text-ink-2">
                  <li>1. Abre el menú ⋮</li>
                  <li>2. Toca “Instalar app”</li>
                  <li>3. Confirma con “Instalar”</li>
                </ol>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted">Para usarla en el celular, la app debe estar publicada con HTTPS (o abierta desde la misma red Wi-Fi del computador).</p>
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-5">
          <Tarjeta titulo="Copia de seguridad" subtitulo={puedeEditar ? 'Descarga los datos del cuaderno en un archivo o recupéralos desde uno' : 'Descarga los datos del cuaderno en un archivo'}>
            <div className="flex flex-wrap gap-2">
              <PastillaSuave icono={Download} onClick={exportar}>Exportar copia</PastillaSuave>
              {puedeEditar && <PastillaSuave icono={Upload} tono="neutro" onClick={() => archivo.current?.click()}>Importar copia</PastillaSuave>}
              <input ref={archivo} type="file" accept="application/json,.json" className="hidden" onChange={async e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f || !confirm(`Importar reemplaza todos los datos de «${estado.cuaderno?.nombre ?? 'este cuaderno'}» por los del archivo. ¿Continuar?`)) return;
                try { await importar(JSON.parse(await f.text())); avisar('Copia importada'); }
                catch { avisar('El archivo no es una copia válida de Finanzas Hogar'); }
              }} />
            </div>
          </Tarjeta>

          {puedeEditar && <Tarjeta titulo="Restablecer datos" subtitulo="Para armar el presupuesto del cuaderno desde cero. Exporta una copia antes si quieres guardar lo actual.">
            <div role="radiogroup" aria-label="Cómo restablecer" className="flex flex-col gap-2">
              {OPCIONES_RESTABLECER.map(o => (
                <button key={o.valor} type="button" role="radio" aria-checked={modo === o.valor} onClick={() => setModo(o.valor)}
                  className={cx('foco flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                    modo === o.valor ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2')}>
                  <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', modo === o.valor ? 'border-accent-fill bg-surface' : 'border-line')}>
                    {modo === o.valor && <span className="size-2.5 rounded-full bg-accent-fill" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[14px] font-semibold"><o.icono className="size-4 text-ink-2" /> {o.titulo}</span>
                    <span className="mt-0.5 block text-[12px] text-muted">{o.texto}</span>
                  </span>
                </button>
              ))}
            </div>
            {modo === 'plantilla' && (
              <div className="mt-3 flex flex-col gap-4 rounded-2xl bg-surface-2 p-4">
                <div>
                  <p className="text-[13px] font-semibold">1. Descarga la plantilla</p>
                  <p className="mt-0.5 text-[12px] text-muted">Trae tu plan actual (meses, rubros, deudas y metas) para que solo cambies lo necesario. Adentro hay instrucciones.</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <a href="/api/plantilla" download className={clasePastilla}><Download className="size-4" /> Descargar plantilla</a>
                    <a href="/api/plantilla?vacia=1" download className="foco rounded-full text-[13px] font-semibold text-accent-strong underline-offset-2 hover:underline">
                      o en blanco (sin montos)
                    </a>
                  </div>
                </div>
                <div>
                  <p className="text-[13px] font-semibold">2. Llénala y súbela</p>
                  <p className="mt-0.5 text-[12px] text-muted">Guárdala como .xlsx (en Google Sheets: Archivo → Descargar → Microsoft Excel).</p>
                  <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
                    <PastillaSuave icono={Upload} tono="neutro" className="bg-surface!" onClick={() => entradaPlantilla.current?.click()}>
                      {plantilla ? 'Cambiar archivo' : 'Elegir archivo'}
                    </PastillaSuave>
                    {plantilla && (
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                        <FileSpreadsheet className="size-4 shrink-0 text-pos-text" /> <span className="truncate">{plantilla.name}</span>
                      </span>
                    )}
                    <input ref={entradaPlantilla} type="file" className="hidden"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={e => { setPlantilla(e.target.files?.[0] ?? null); setErrorPlantilla(''); e.target.value = ''; }} />
                  </div>
                </div>
                {errorPlantilla && (
                  <p role="alert" className="flex items-start gap-2 rounded-2xl bg-neg-soft p-3 text-[12px] text-ink-2">
                    <CircleAlert className="mt-px size-4 shrink-0 text-neg-text" />
                    <span><b className="font-semibold text-neg-text">No se pudo cargar.</b> {errorPlantilla}</span>
                  </p>
                )}
              </div>
            )}
            <label className="mt-4 flex items-center gap-3 text-[13px]">
              <input type="checkbox" checked={conservar} onChange={e => setConservar(e.target.checked)} className="size-5 accent-[var(--accent-fill)]" />
              Conservar los movimientos registrados
            </label>
            <PastillaSuave icono={modo === 'plantilla' ? Upload : RotateCcw} tono="neg" className="mt-4"
              disabled={cargando || (modo === 'plantilla' && !plantilla)}
              onClick={async () => {
                if (modo === 'plantilla') {
                  if (!plantilla) return;
                  if (!confirm(`Cargar "${plantilla.name}": reemplaza el presupuesto, las deudas, las metas y la configuración por los de la plantilla. `
                    + `Las listas de compras se conservan${conservar ? ' y también los movimientos' : '; los movimientos se borran'}.\n\n¿Continuar?`)) return;
                  setCargando(true);
                  setErrorPlantilla('');
                  try {
                    await cargarPlantilla(plantilla, conservar);
                    setPlantilla(null);
                    avisar('Plantilla cargada: revisa tu presupuesto');
                  } catch (e) {
                    setErrorPlantilla(e instanceof Error ? e.message : 'Revisa el archivo e inténtalo de nuevo.');
                  } finally {
                    setCargando(false);
                  }
                  return;
                }
                const o = OPCIONES_RESTABLECER.find(x => x.valor === modo)!;
                if (!confirm(`${o.titulo}: ${o.texto}\n\nEsto no se puede deshacer. ¿Continuar?`)) return;
                await restablecer(modo, conservar).catch(() => {});
                avisar(modo === 'vacio' ? 'Todo borrado: empieza a armar tu plan' : 'Montos en $ 0: ya puedes armar el presupuesto');
              }}>
              {modo === 'plantilla' ? (cargando ? 'Cargando…' : 'Cargar plantilla') : 'Restablecer'}
            </PastillaSuave>
          </Tarjeta>}
        </div>
      </div>
    </>
  );
}
