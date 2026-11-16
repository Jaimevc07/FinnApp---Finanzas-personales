---
name: diseno-fin-tech
description: Sistema de diseño fintech de la app "Finanzas Hogar" (Next.js + Tailwind v4). Paleta negro, grises, blanco y naranja, más verde para ingresos y rojo para egresos. Componentes inspirados en apps bancarias móviles (tarjeta oscura, monto protagonista, botones circulares de acción, barra dividida gastado/disponible, pastillas suaves). Úsala SIEMPRE que crees o modifiques cualquier pantalla, componente, estilo, gráfico, ícono, formulario, color o texto visible de esta app, aunque el pedido no diga "diseño" (por ejemplo "agrega una vista de ahorros", "mejora el formulario de gastos", "haz que se vea mejor en el celular", "agrega un gráfico", "cambia el color").
---

# Diseño fin-tech · Finanzas Hogar

La app debe sentirse como una app bancaria moderna: calmada, con mucho aire, un solo
número protagonista por pantalla y el color reservado para lo que significa algo.
La referencia visual es [assets/referencia-tarjeta.png](assets/referencia-tarjeta.png)
(pantalla de una tarjeta corporativa). Ábrela si vas a diseñar algo nuevo: de ahí
salen la jerarquía, los radios y el ritmo vertical.

Los valores exactos de color, sombra y radio están en
[references/tokens.css](references/tokens.css) y ya viven en `app/globals.css`.
Las recetas de cada componente están en
[references/componentes.md](references/componentes.md). Léelo antes de crear un
componente que no exista todavía en `components/ui/`.

## Principios (y por qué)

1. **Un héroe por pantalla.** Cada vista abre con un número grande (caja acumulada,
   total por comprar, deuda pendiente). El usuario abre la app para saber "¿cómo vamos?"
   y ese número debe responderlo sin leer nada más. Los demás números son secundarios
   y más pequeños.
2. **Neutros por defecto y el color con intención.** El 90 % de la interfaz es negro,
   gris y blanco. El naranja marca lo accionable o lo seleccionado (botón principal,
   pestaña activa, mes elegido en un gráfico). El verde y el rojo **solo** significan
   dinero que entra o que sale, o un estado bueno o malo. Si usas naranja como
   decoración o verde para "bonito", el usuario deja de poder leer el significado.
3. **El signo y el ícono, nunca solo el color.** El verde y el rojo no se distinguen
   con daltonismo deuteranope (validado: ΔE 3,9). Todo monto de ingreso lleva `+` y
   flecha hacia abajo/entrada; todo egreso lleva `−` (signo menos real, U+2212) y
   flecha de salida. Los estados llevan ícono y palabra ("Liquidada", "Excedido").
4. **Superficies suaves, no bordes duros.** Fondo gris cálido (`bg`), tarjetas blancas
   (`surface`) con radio grande (24 px) y sombra difusa casi imperceptible. Los bordes
   son hilos de 1 px en `line`, solo cuando hacen falta para separar.
5. **Mobile first, escritorio aprovechado.** Se diseña primero a 390 px de ancho.
   En escritorio la misma información se reorganiza en columnas (barra lateral +
   contenido en rejilla), no se estira.
6. **Tocable.** Toda zona interactiva mide al menos 44 × 44 px. Los botones
   circulares de acción miden 56 px.

## Paleta (resumen)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` | `#F4F3F0` | `#0B0B0C` | Fondo de la app |
| `surface` | `#FFFFFF` | `#161618` | Tarjetas, hojas, barra inferior |
| `surface-2` | `#EEEDE9` | `#1F1F22` | Inputs, pastillas neutras, pistas de barras |
| `line` | `#E6E5E1` | `#2A2A2E` | Hilos divisorios |
| `ink` | `#111113` | `#F5F5F4` | Texto principal, botón negro |
| `ink-2` | `#3B3B40` | `#D4D4D6` | Texto secundario fuerte |
| `muted` | `#6B6A71` | `#9B9AA1` | Etiquetas, ayudas (4,8:1 sobre `bg`) |
| `accent` | `#F26411` | `#FF7A2E` | Naranja de marca: rellenos, barras, FAB |
| `accent-strong` | `#C2410C` | `#FF8F4D` | Naranja como **texto** o enlace |
| `accent-soft` | `#FFF1E8` | `#2A1A10` | Fondo de pastillas naranjas |
| `accent-fill` | `#CF4A0A` | `#FF7A2E` | Relleno de botones naranjas y del FAB (más profundo que `accent` en claro) |
| `accent-ink` | `#FFFFFF` | `#111113` | Texto e íconos sobre `accent-fill` |
| `pos` / `pos-text` / `pos-soft` | `#0E9F4E` / `#0B7A3B` / `#E3F6EA` | `#2BC46B` / `#34D27A` / `#0F2A1A` | Ingresos, metas cumplidas |
| `neg` / `neg-text` / `neg-soft` | `#DC2F34` / `#C4262B` / `#FDE8E8` | `#FF5C61` / `#FF6B70` / `#2E1213` | Egresos, excesos, deudas |
| `warn` / `warn-text` / `warn-soft` | `#E5A100` / `#8A5A00` / `#FFF4D6` | `#F5B82E` / `#F5B82E` / `#2B220C` | Advertencias ("cerca del tope") |

Reglas de contraste ya verificadas:
- El texto naranja va en `accent-strong` (5,2:1). `accent` como texto pequeño no pasa.
- Los botones naranjas usan `bg-accent-fill` con texto `accent-ink`: en claro, blanco sobre `#CF4A0A` (4,5:1); en oscuro, casi negro sobre `#FF7A2E` (7,3:1). `accent` (`#F26411`) queda para barras, puntos e indicadores: blanco encima solo da 3,2:1.
- **Naranja y negro no van juntos.** Nunca texto negro sobre un relleno naranja, ni un bloque negro (`bg-ink`) junto o alrededor de un relleno naranja. Lo seleccionado (navegación activa, mes, tema, filtros, opciones) se marca con `bg-accent-soft` (+ `ring-accent` o ícono en `accent-strong`), no en negro. Los avisos y llamados a la acción van en tarjeta clara (`bg-surface`) con tile `accent-soft`. El negro como relleno queda para el `BotonPrimario`, los avatares, el logo y la `TarjetaFin`.
- Los montos en verde o rojo usan `pos-text` / `neg-text`. `pos` y `neg` son para puntos, barras e íconos.

## Tipografía

- Fuente única: **Manrope** (cargada con `next/font`, variable `--font-sans`). Nada
  de serif ni fuentes "display" decorativas: los números grandes también van en Manrope.
- Escala: héroe 36–44 px bold (`text-4xl`/`text-[44px]`, `tracking-tight`); título de
  pantalla 18 px semibold; título de tarjeta 15 px semibold; cuerpo 14 px; etiquetas
  12–13 px `muted`; micro 11 px.
- Números: en columnas y tablas usa `tabular-nums` para que alineen. En el héroe y en
  las cifras grandes sueltas **no** (los dígitos tabulares se ven flojos en tamaño grande).
- Símbolo de moneda del héroe: mismo color, ~60 % del tamaño y alineado arriba.
  Así el número manda y el `$` acompaña (como el `₺` de la referencia).
- Sentence case en todo ("Caja acumulada", no "CAJA ACUMULADA"). Las mayúsculas con
  tracking solo para micro-etiquetas sobre la tarjeta oscura.

## Dinero

- Usa siempre los helpers de `lib/formato.ts`: `cop(v)` → `$ 7.765.770`,
  `copCorto(v)` → `$9,75 M` / `$750 mil`, `conSigno(v, tipo)` → `+$ 120.000` / `−$ 45.000`.
  No formatees a mano con `toLocaleString` en los componentes: así todo el sistema
  muestra el dinero igual.
- Pesos colombianos sin decimales. USD con 2 decimales solo donde se hable de dólares.
- Negativos: signo menos real (`−`) y color `neg-text`. Nunca paréntesis.
- **Palabras de la casa, no de contador.** El hogar no habla de "flujo neto" ni de "caja
  acumulada". Usa: "Sobra (o falta) en el mes" para ingresos − egresos, "En la cuenta al
  cierre de…" para lo acumulado, "Entra" / "Sale", "Se cubre con el sueldo del 30 Oct" para
  el cobro a mes vencido. Si un número puede confundirse, agrégale una línea que diga de dónde
  sale ("Lo que sobra cada mes, sumado hasta Nov 2026, si se cumple el plan").

## Forma y espacio

- Radios: tarjeta 24 px (`rounded-3xl`), tarjeta visual tipo crédito 20 px,
  inputs 14 px (`rounded-2xl`), pastillas y botones circulares `rounded-full`, tiles de
  ícono 14 px.
- Espaciado en múltiplos de 4. Padding de tarjeta 20 px en móvil y 24 px en escritorio.
  Separación entre bloques 16–24 px.
- Sombra única `shadow-card` para tarjetas blancas. La tarjeta oscura lleva `shadow-fin`.
  No apiles sombras ni uses sombras de color.
- Contenido móvil: columna de máx. 480 px centrada con márgenes de 16 px. Escritorio
  (≥ 1024 px): barra lateral de 248 px + contenido de máx. 1200 px en rejilla de 12.

## Componentes del sistema

Todos viven en `components/ui/`. Reutilízalos antes de crear uno nuevo. Detalle y
código en [references/componentes.md](references/componentes.md).

| Componente | Cuándo |
|---|---|
| `EncabezadoPantalla` | Arriba de cada vista: botón circular izquierdo, título, subtítulo con parte resaltada y 1–2 botones circulares a la derecha |
| `BotonCircular` | Íconos de 40 px en el encabezado |
| `AccionCircular` | Fila de 3–4 acciones rápidas (56 px + etiqueta debajo) |
| `ChipSelector` | Pastilla centrada que abre un selector (mes, hogar) con insignia suave |
| `MontoHeroe` | El número protagonista con etiqueta encima |
| `TarjetaFin` | Tarjeta oscura tipo crédito con el mes en palabras simples: cuánto sobra o falta, qué % de lo que entra se gasta, "Entra" y "Sale", y con qué sueldo se cubre. Nunca imites logos de redes de pago (Mastercard, Visa) |
| `Marca` | Logo de la app: tres barras ascendentes, la última naranja (también es el ícono PWA) |
| `Medidor` | Progreso simple de 8 px (metas, deudas, compras) |
| `Insignia` | Etiqueta pequeña de estado o categoría ("Fijo", "Liquidada", "Cobro 30 Nov") |
| `Vacio` / `Esqueleto` | Estado vacío con acción / carga con la forma del contenido |
| `Campo`, `Entrada`, `Selector`, `EntradaDinero` | Formularios; `EntradaDinero` pone separadores de miles al escribir |
| `BotonPrimario` | Negro (`ink`) con texto blanco, como el botón de Apple Wallet. Una acción principal por vista |
| `BotonAcento` | `accent-fill` con texto `accent-ink` (blanco en claro). Para confirmar en hojas y formularios |
| `PastillaSuave` | Acción secundaria con ícono sobre `accent-soft` (como "Edit limit") |
| `BarraDividida` | Progreso gastado/disponible: segmento `ink` + resto `accent`/`pos` claro, con leyenda de puntos |
| `Tarjeta` | Contenedor blanco estándar con título opcional y acción a la derecha |
| `Estadistica` | Etiqueta + valor + delta opcional, para rejillas de KPIs |
| `FilaMovimiento` | Ítem de lista: tile de ícono, título, subtítulo, monto con signo y color |
| `Segmentado` | Pestañas tipo control segmentado (fondo `surface-2`, activa en `surface` con sombra) |
| `Hoja` | Hoja inferior en móvil y diálogo centrado en escritorio, para formularios |
| `NavegacionInferior` | Barra móvil con 4 destinos + FAB naranja central para registrar |
| `FilaMeta` (`components/metas.tsx`) | Meta con su ícono, insignia del modo (y "Proyección" si la fecha cae después del plan), medidor y estado ("Se cumple" / "Faltan… sube $X/mes") |
| `SelectorIcono` (`components/ui/selector-icono.tsx`) | En toda hoja que crea algo con identidad (meta, categoría, lista, deuda, evento): muestra el ícono actual y despliega el catálogo agrupado de `lib/iconos.ts`. Nulo = automático según el nombre |
| `SelectorMeses` (`components/ui/selector-meses.tsx`) | Elegir varios meses del plan (rubros de solo algunos meses), agrupados por año, en botones de 44 px |

## Colecciones que el usuario hace crecer

Deudas, metas, listas, productos, categorías y rubros se pueden agregar sin límite. Sigue
siempre el mismo patrón, para que agregar algo se sienta igual en todas las vistas:
- **Agregar**: `PastillaSuave icono={Plus}` en la `accion` de la tarjeta que contiene la colección
  (o `BotonPrimario` en el héroe cuando es la acción principal de la vista). Al final de una
  rejilla o lista larga, una tarjeta punteada `border-2 border-dashed border-line` con "+".
- **Editar o borrar**: botón `Ellipsis` de 40 px en la fila; abre una `Hoja` con el formulario y,
  en el pie, la papelera (`BotonSecundario` con `text-neg-text`) + `BotonAcento` para guardar.
  Borrar siempre pide confirmación y dice qué más se borra ("y sus 4 rubros").
- **Vista previa en el formulario**: cuando el formulario calcula algo (plan de pagos, aporte de
  una meta), muestra el resultado en una caja `rounded-2xl p-4`: `bg-pos-soft` + ícono de check
  si cierra, `bg-warn-soft` + triángulo si no, con la corrección sugerida y un botón "Usar".
- **Colección vacía**: `Vacio` con una frase que explica para qué sirve y la acción de crear.
- En filas de tarjetas, la insignia de estado va **debajo** del nombre, no a la derecha: en
  390 px el nombre necesita todo el ancho.
- **Ícono propio**: lo que el usuario crea lleva `SelectorIcono` justo debajo del nombre. Para
  mostrarlo usa siempre los resolvedores de `lib/iconos.ts` (`iconoCategoria`, `iconoMeta`,
  `iconoLista`, `iconoRubro`, `iconoDe(nombre, categorias)`), nunca un ícono fijo: así el que
  eligió el usuario aparece igual en el presupuesto, los movimientos y el inicio. El ícono va en
  un tile `surface-2`/`ink-2` (o `accent-soft` en metas); la opción elegida del catálogo se marca
  con `accent-soft` + `ring-2 ring-accent` (naranja = selección).
- **Solo algunos meses**: un rubro que no se repite (prima, bono, pago anual) solo se muestra en
  los meses con valor; los demás se agrupan en un enlace "N de otros meses" al pie de la tarjeta,
  y la fila lleva el detalle "Solo en Nov 2026 · Ene 2027" con `CalendarDays`.
- Los montos usan espacio duro entre `$` y el número (lo pone `lib/formato.ts`): no armes
  montos a mano con un espacio normal o se parten en dos líneas.

## Gráficos

Se dibujan a mano en SVG, sin librerías (ver `components/graficos/`).
- **Una serie, un color.** Las columnas van en `surface-2`/`muted` y el mes
  seleccionado o el valor destacado en `accent`. Los valores negativos crecen hacia
  abajo desde la misma línea base. Ningún arcoíris.
- Columnas de máx. 24 px, extremo de dato redondeado 4 px y base recta. Grilla de
  1 px en `line`, sólida. Un solo eje.
- **Partes de un todo con más de 4 categorías → barras horizontales ordenadas**, no
  donut. Cada fila lleva nombre, valor y porcentaje en texto (el texto nunca va del
  color de la barra).
- Todo gráfico tiene tooltip al pasar el mouse o tocar, y un resumen accesible
  (`aria-label` o tabla oculta) con los valores.
- Etiquetas selectivas: el valor del mes seleccionado y el extremo. No un número en
  cada barra.

## Movimiento y estados

- Transiciones de 150–200 ms (`ease-out`) en color, opacidad y `transform`. Hoja
  inferior: entra desde abajo en 220 ms. Respeta `prefers-reduced-motion`.
- Presionado: `active:scale-[0.97]` en botones circulares y primarios.
- Foco visible siempre: `focus-visible:ring-2 ring-accent ring-offset-2 ring-offset-bg`.
- Estados vacíos: ícono suave en tile `surface-2`, una frase que dice qué hacer y el
  botón para hacerlo. Nunca una tabla vacía sin explicación.
- Carga: esqueletos `bg-surface-2 animate-pulse` con la forma del contenido, no spinners.

## PWA y móvil

- Respeta las áreas seguras: `pb-[env(safe-area-inset-bottom)]` en la barra inferior y
  `pt-[env(safe-area-inset-top)]` en el encabezado cuando la app corre instalada.
- `theme-color`: `#F4F3F0` en claro y `#0B0B0C` en oscuro, igual al fondo, para que la
  barra de estado se funda con la app.
- Inputs de dinero con `inputMode="numeric"` para abrir el teclado numérico.
- Sin hover-only: todo lo que aparece al pasar el mouse también aparece al tocar.

## Lista de revisión antes de terminar

- [ ] ¿La vista tiene exactamente un número héroe?
- [ ] ¿El naranja solo marca acción o selección? ¿El verde y el rojo solo dinero o estado?
- [ ] ¿Cada monto con color también lleva signo o ícono?
- [ ] ¿El dinero sale de `lib/formato.ts`?
- [ ] ¿Se ve bien a 390 px y a 1280 px? ¿Sin scroll horizontal en móvil?
- [ ] ¿Funciona en modo oscuro sin colores fijos (solo tokens)?
- [ ] ¿Las zonas táctiles miden al menos 44 px y el foco es visible?
