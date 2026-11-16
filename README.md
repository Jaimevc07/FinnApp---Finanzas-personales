# Finanzas Hogar

App web de finanzas del hogar (Next.js 16 + Postgres en Supabase) basada en el Excel
`Visual_Board_Financiero_2026_2027.xlsx`. Funciona en escritorio y en el celular, y se
instala como app (PWA) en iPhone y Android.

| Vista | Qué hace (equivalente en el Excel) |
|---|---|
| **Inicio** | Caja acumulada, flujo del mes, todos los movimientos del mes, avisos "Para revisar", salud financiera (tasa de ahorro, peso de las deudas, colchón), KPIs, metas, caja por mes y distribución del gasto (*Visual Board*) |
| **Presupuesto** | Los meses del plan por rubro, editables, con categorías propias e íconos. Rubros de todos los meses o de solo algunos (primas, bonos), gasto real por categoría y saldo inicial. Vista por mes o tabla completa en escritorio (*Presupuesto Mensual*) |
| **Movimientos** | Registro de lo que realmente entra y sale, comparado con el plan del mes. Al registrar sugiere los rubros del presupuesto y dice cuánto queda en la categoría |
| **Deudas y metas** | Deudas con saldo, interés (mensual y E.A.) y plan de pago, con la deuda a priorizar; metas con ícono y fecha libre (también después del plan, p. ej. 2030, por proyección); viajes y eventos; TRM y ahorro cambiario; proyección después del plan |
| **Listas de compras** | Varias listas con ícono, cada una con sus productos y su tope (fijo o un rubro del presupuesto). Los productos van en grupos que se renombran, se borran y reciben productos ahí mismo. Lo comprado se registra como gasto con un toque (*Mercado Detallado*) |
| **Cuadernos** | Pre-vista para elegir o crear cuadernos e ir a las invitaciones recibidas |
| **Ajustes** | El cuaderno (nombre, cambiar, salir, eliminar), personas e invitaciones, tu cuenta, tema, instalar, copias y restablecer |
| **Actividad** | Quién registró o cambió qué (movimientos, presupuesto, deudas, metas, listas), con filtro por persona |

Reglas del plan que conviene conocer:

- **Agregar un mes al final** copia solo lo que se repite cada mes; los viajes, eventos y rubros de
  solo algunos meses no se copian, y las deudas con saldo siguen con su cuota hasta liquidarse.
- **Copiar de otro mes** tampoco copia los rubros de solo algunos meses.
- **Metas después del plan**: la caja crece con el flujo libre de "Proyección después del plan"
  y los aportes mensuales siguen iguales hasta la fecha de la meta.

**Restablecer** (en Ajustes) tiene tres modos:

- **Todo en $ 0** (por defecto): conserva los nombres como plantilla y deja todos los montos en $ 0.
- **Borrar todo**: quedan solo las categorías y los meses.
- **Desde una plantilla de Excel**: se descarga la plantilla (con el plan actual o en blanco), se llena
  en Excel o Google Sheets y se sube. Reemplaza meses, presupuesto, deudas, viajes, metas y
  configuración; conserva las listas de compras y los íconos de lo que se llame igual. Si el archivo
  tiene un error, la app dice la hoja, la fila y la columna, y no cambia nada.

La plantilla tiene las hojas *Presupuesto* (una fila por rubro y una columna por mes; se pueden
agregar meses escribiendo el encabezado, p. ej. "Feb 2028"), *Metas*, *Configuración* e
*Instrucciones*.

## Correr en el computador

Requiere Node.js 22.13 o superior y la cadena de conexión de Supabase en `.env.local`
(copia `.env.example`; Supabase → **Connect** → *Transaction pooler*, puerto 6543).

```bash
npm install
npm run dev          # desarrollo: http://localhost:3000
npm run build && npm start   # producción
```

## Base de datos (Supabase)

- El esquema está en `supabase/migrations/`. Se aplica una vez (SQL Editor de Supabase o MCP).
- La app se conecta desde el servidor con `DATABASE_URL` por el **pooler en modo transacción**
  (puerto 6543). La conexión directa de Supabase es solo IPv6 y Vercel no la soporta.
- Las tablas tienen **RLS activo y sin políticas**: la API pública de Supabase (clave publicable o
  anon) no puede leer ni escribir nada. Solo el servidor de la app accede a los datos.
- Si la base está vacía, la primera visita carga los datos del Excel de ejemplo.
- `scripts/migrar-sqlite-a-supabase.mjs` copia una base SQLite de la versión anterior a Supabase
  (borra lo que haya en Supabase y conserva los ids):
  `node --env-file=.env.local scripts/migrar-sqlite-a-supabase.mjs data/finanzas.db`.
- Plan free de Supabase: 500 MB (la app usa menos de 1 MB) y el proyecto **se pausa tras 7 días
  sin uso**; se reactiva desde el panel de Supabase. Usar la app con regularidad lo mantiene activo.

## Cuadernos, cuentas y permisos

- **Pre-vista (`/cuadernos`):** al entrar se elige un cuaderno. Cada cuaderno tiene sus propios
  datos (presupuesto, deudas, metas, listas, movimientos y actividad) y su propia gente.
- **Permisos por cuaderno:** *Propietario* (todo, invita y cambia permisos), *Puede editar*
  (lectura y escritura) y *Solo ver* (lectura). El servidor rechaza cualquier cambio de quien solo
  puede ver, y la app le muestra las hojas deshabilitadas y un aviso de solo lectura.
- **Invitar:** en *Ajustes → Personas en este cuaderno → Invitar* se escribe el correo y el permiso.
  La app crea un enlace personal (`/invitacion/<token>`, vence en 14 días) que se envía por correo
  (abre el programa de correo con el mensaje listo), WhatsApp o copiándolo. Quien lo abre crea su
  cuenta o entra con la suya; si ya tiene cuenta, la invitación también le aparece en la pre-vista.
  La cuenta nueva se confirma con un correo de Supabase (si el correo no sale, se crea confirmada).
- **Invitar a la app:** en *Ajustes → Invitar a la app* se invita a alguien nuevo sin darle ningún
  cuaderno. Supabase le manda un correo; al abrirlo crea su contraseña en `/bienvenida`. Si el correo
  no sale, la app da un enlace para enviarlo por WhatsApp.
- **Olvidé mi contraseña:** en `/login` → *¿Olvidaste tu contraseña?* llega un correo con un enlace
  a `/restablecer`.
- **Primera cuenta:** si la app no tiene cuentas, `/login` deja crear la primera (administra la app
  y queda dueña de los cuadernos sin dueño). Después solo se entra por invitación.

### Correos (confirmar cuenta, invitación y contraseña)

Los correos los manda Supabase. Todos los enlaces llevan a `/auth/confirmar?token_hash=…&type=…`,
que abre la sesión en el servidor (funciona aunque el correo se abra en otro dispositivo).

1. **SMTP propio** (*Authentication → Emails → SMTP Settings*). Sin él, el plan free solo envía a
   los miembros del equipo del proyecto y unos pocos correos por hora. Opciones gratis: Gmail con
   una contraseña de aplicación (`smtp.gmail.com`, puerto 465) o Brevo (300 correos al día).
2. **Plantillas** (*Authentication → Emails → Templates*): pega las de `supabase/plantillas-correo/`.
   - *Confirm signup* → `confirmar-cuenta.html` · asunto «Confirma tu cuenta de Finanzas Hogar»
   - *Invite user* → `invitacion.html` · asunto «Te invitaron a Finanzas Hogar»
   - *Reset password* → `recuperar-contrasena.html` · asunto «Crea una contraseña nueva para Finanzas Hogar»
3. **URLs** (*Authentication → URL Configuration*): *Site URL* = el dominio de Vercel; en
   *Redirect URLs* agrega `https://<tu-dominio>/auth/confirmar` y `http://localhost:3000/auth/confirmar`.
4. *Sign In / Providers → Email*: "Confirm email" activado y "Allow new users to sign up" **activado**
   (las cuentas nuevas de las invitaciones a cuadernos se crean con registro normal; sin invitación
   nadie entra a la app aunque se registre).
- **Aislamiento en la base:** cada petición corre en una transacción que fija el cuaderno
  (`app.cuaderno`) y usa el rol `finanzas_app`, que por RLS solo ve y cambia filas de ese cuaderno.
  `cuaderno_id` se llena solo al insertar. Ver `supabase/migrations/20261115020000_cuadernos.sql`.
- **Quién hizo qué:** cada movimiento y producto guarda quién lo registró y quién lo editó, y cada
  cambio queda en *Actividad* (`/actividad`), separada por cuaderno.
- **Google (opcional):** activar el proveedor en Supabase y agregar `/auth/callback` en
  *Authentication → URL Configuration*. La cuenta de Google debe tener el correo invitado.

## Publicar en Vercel

1. Sube el proyecto a GitHub e impórtalo en Vercel (detecta Next.js solo).
2. En *Settings → Environment Variables* agrega las mismas de `.env.local`: `DATABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`.
3. En Supabase, *Authentication → URL Configuration*: pon la URL de Vercel como *Site URL*.
4. Despliega. `vercel.json` deja las funciones en `iad1` (Virginia), la misma región de la base
   en Supabase (us-east-1), para que cada consulta tarde pocos milisegundos.

## Usarla en el celular

- **Misma red Wi-Fi:** con `npm start`, abre en el celular `http://<IP-del-computador>:3000`.
  Se ve y funciona, pero para instalarla como app (y para que abra sin conexión) el navegador
  exige HTTPS.
- **Publicada con HTTPS:** en Vercel (ver arriba). Cada persona entra con su cuenta.

Variables (ver `.env.example`): `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (solo servidor), y opcionales
`DB_SCHEMA` (otro esquema, p. ej. para pruebas) y `DB_MAX_CONEXIONES`.

**Instalar:** en iPhone, Safari → Compartir → *Agregar a inicio*. En Android, Chrome → menú
⋮ → *Instalar app*.

## Datos iniciales (Visual Board)

Una base nueva arranca con los datos del Visual Board 2026–2027 (`lib/semilla.json`). Para
regenerarlos si cambia ese Excel:

```bash
pip install openpyxl
npm run semilla      # regenera lib/semilla.json desde el Excel
```

Para cargar cualquier otro plan, usen la plantilla de Excel de **Ajustes → Restablecer datos**.

## Estructura

```
app/(app)/          Pantallas (inicio, presupuesto, movimientos, plan, listas, ajustes)
app/api/            API REST sobre Postgres (Supabase)
app/login/          Inicio de sesión (y la primera cuenta)
app/cuadernos/      Pre-vista de cuadernos
app/invitacion/     Página del enlace de invitación
app/auth/callback/  Vuelta del inicio de sesión con Google
lib/supabase/       Clientes de Supabase Auth (navegador, servidor y administrador)
components/ui/      Sistema de diseño (ver la skill diseno-fin-tech)
components/graficos Gráficos SVG sin librerías
lib/calculos.ts     Réplica de las fórmulas del Excel (caja, flujo, KPIs, deudas)
lib/servidor/       Conexión a Postgres (postgres.js) y repositorio
supabase/migrations Esquema de la base
scripts/            Conversión del Excel a datos iniciales y migración desde SQLite
public/sw.js        Service worker (abre sin conexión)
legacy/             La versión anterior (servidor Node + HTML), solo como referencia
```

## Diseño

La guía visual es la skill de Claude Code `.claude/skills/diseno-fin-tech`: paleta negro,
grises, blanco y naranja; verde y rojo solo para ingresos y egresos; componentes inspirados
en apps bancarias móviles.
