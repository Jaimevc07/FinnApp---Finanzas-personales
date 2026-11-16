# Recetas de componentes · diseno-fin-tech

El código vive en `components/ui/` y `components/graficos/`. Aquí está la anatomía de
cada pieza y cómo combinarlas en una pantalla nueva. Las clases usan los tokens de
`tokens.css`. Si necesitas un color que no existe como token, falta un token: no
escribas un hexadecimal.

## Contenido

1. Esqueleto de una pantalla
2. Encabezado
3. Bloque héroe (monto + tarjeta + acciones)
4. Tarjetas y KPIs
5. Barra dividida y medidores
6. Listas (movimientos, rubros, ítems)
7. Formularios y hojas
8. Navegación
9. Gráficos
10. Errores comunes

---

## 1. Esqueleto de una pantalla

Toda vista cliente de `app/(app)/` sigue este patrón: `ConDatos` muestra esqueletos
hasta que llegan los datos, y la rejilla es de una columna en móvil y de 12 en escritorio.

```tsx
'use client';
export default function MiVista() {
  return <ConDatos><Contenido /></ConDatos>;
}

function Contenido() {
  const { estado, fila, periodoId } = useDatos();
  return (
    <>
      <EncabezadoPantalla titulo="Ahorros" subtitulo={<>Metas del hogar · <b className="font-semibold text-ink">mes a mes</b></>} />
      {/* grid-cols-1 es obligatorio: sin él, la columna móvil crece al ancho mínimo del contenido y aparece scroll horizontal */}
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-5">{/* héroe + resumen */}</div>
        <div className="flex flex-col gap-5 lg:col-span-7">{/* detalle, listas, gráficos */}</div>
      </div>
    </>
  );
}
```

- La columna izquierda (5/12) lleva lo que se ve primero en el celular: selector de mes,
  héroe y resumen. En escritorio queda `sticky` mientras se recorre el detalle.
- En escritorio el bloque héroe va dentro de un panel blanco
  (`lg:rounded-3xl lg:bg-surface lg:p-6 lg:shadow-card`). En móvil flota sobre el fondo,
  como en la referencia.

## 2. Encabezado

```
[ ● ]  Título de la vista                 [ ◷ ] [ ⚙ ]
       Subtítulo con **parte resaltada**
```

- Izquierda: `BotonCircular` (atrás) o un avatar circular negro con iniciales.
- Título 18 px semibold (22 px en escritorio). Subtítulo 12 px `muted`, con la parte
  importante en `<b className="font-semibold text-ink">`, como el "Linked to **Finance
  Budget…**" de la referencia.
- Derecha: máximo dos `BotonCircular` de 40 px.
- Ya respeta `safe-area-inset-top` para la app instalada en iPhone.

## 3. Bloque héroe

Orden vertical, centrado, con 20 px de separación (`gap-5`):

1. `SelectorPeriodo`: pastilla con ícono de calendario sobre círculo negro, el mes y una
   `Insignia tono="pos"` con el cobro. Flechas a los lados.
2. `MontoHeroe centrado`: etiqueta 13 px `muted` y número de 40–48 px bold. El `$` va a
   0,6 em y alineado arriba.
3. `TarjetaFin`: máx. 340 px de ancho. Fondo degradado grafito con un brillo naranja radial
   arriba a la derecha y una textura diagonal al 7 %. Cuenta el mes en palabras simples:
   arriba titular + marca y "Plan de Nov 2026"; luego "Les sobra (o falta) en Nov 2026" con el
   monto grande y "Gastan el 75 % de lo que entra"; una barra de 6 px (lo que sale en `fin-ink`,
   lo que sobra en `accent`, todo `fin-neg` si falta); dos columnas "Entra" (`fin-pos`, +) y
   "Sale" (`fin-neg`, −) con flechas; y un pie que explica con qué sueldo se cubre el mes.
   Sobre la tarjeta los colores van en `fin-ink`, `fin-muted`, `fin-pos` y `fin-neg`, que no
   cambian con el tema (la tarjeta siempre es oscura).
4. `BotonPrimario` negro, mín. 220 px, con ícono a la izquierda.
5. Fila de 3 `AccionCircular` (56 px, borde `line`, sombra `card`, etiqueta de 12 px).

## 4. Tarjetas y KPIs

- `Tarjeta`: `rounded-3xl bg-surface p-5 lg:p-6 shadow-card`. Título de 15 px semibold;
  subtítulo de 12 px `muted`; `accion` a la derecha (una cifra, una pastilla o un ícono en
  círculo `accent-soft`).
- Ícono decorativo de tarjeta: círculo de 40 px `bg-accent-soft text-accent-strong` (meta)
  o `bg-surface-2 text-ink-2` (neutro).
- `Estadistica` en rejilla `grid grid-cols-2 gap-3`: ícono en círculo de 28 px, etiqueta
  (máx. 2 líneas), valor de 20–22 px y detalle de 12 px. Usa `copCorto` para que quepa.
  `tono="pos" | "neg"` solo si el valor es dinero a favor o en contra.
- Para destacar un total dentro de una lista: fila `rounded-2xl bg-ink px-4 py-3 text-on-ink`
  (como "Caja acumulada al cierre").

## 5. Barra dividida y medidores

`BarraDividida` replica el bloque inferior de la referencia:

```
████████████▌░░░░░░░░░░░░░░░░░
● Gastado real        ● Disponible del plan
$ 4.234.230           $ 7.765.770
```

- Segmento usado en `ink` y resto en `accent/45`, separados por un hueco de 2 px.
  Si se excede, el segmento pasa a `neg` y la leyenda dice "Excedido".
- Debajo, una fila separada por `border-t border-line` con el límite y una
  `PastillaSuave` para editarlo (como "Card limit / weekly · Edit limit").

`Medidor` (8 px): pista `surface-2`, relleno `accent` (en progreso), `pos` (cumplido),
`neg` (excedido) o `ink` (neutro).

## 6. Listas

- `FilaMovimiento`: tile de 44 px `rounded-2xl` (`pos-soft` si es ingreso, `surface-2` si es
  egreso) con el ícono de la categoría (`iconoDe(categoria)` de `lib/iconos.ts`), título de
  14 px semibold, subtítulo `categoría · medio` y `Monto` con signo a la derecha.
- Agrupa por día con un encabezado de 12 px (`fechaLarga`) y el neto del día en `muted`.
- Filas editables (rubros, mercado): `flex items-center gap-2 py-2` dentro de
  `ul.divide-y.divide-line`. El nombre va a máx. 2 líneas (`line-clamp-2`), el campo de monto
  con ancho fijo (`w-[136px] sm:w-[160px] shrink-0`) y un botón `Ellipsis` de 40 px que abre
  una `Hoja` con las opciones.
- Casilla de "comprado" (productos de las listas): círculo de 28 px con borde 2 px; marcado en `bg-pos` con un check
  blanco y el texto tachado en `muted`.

## 7. Formularios y hojas

- `Hoja` usa `<dialog>`: en móvil es una hoja inferior con asa, esquinas de 28 px y entrada
  desde abajo; en escritorio es un diálogo centrado de 480 px. El pie fijo lleva las acciones:
  `BotonSecundario` cuadrado con papelera (en `neg-text`) + `BotonAcento` que ocupa el resto.
- Inputs: `h-12 rounded-2xl bg-surface-2`, borde transparente que pasa a `accent` al enfocar,
  y texto de 16 px en móvil (evita el zoom de iOS).
- Monto principal de un formulario: `<EntradaDinero grande />` (64 px de alto, 28 px bold).
- Tipo ingreso/egreso: `Segmentado` con `tono: 'neg'` para "− Egreso" y `'pos'` para "+ Ingreso".
- Etiquetas de 12 px semibold `muted` encima del campo. Nada de placeholders como etiqueta.

## 8. Navegación

- Móvil: `NavegacionInferior` fija con fondo `surface/90` + `backdrop-blur`. Tiene 4 destinos y
  un FAB naranja central de 56 px que sobresale 28 px, con anillo `ring-4 ring-bg`. El activo
  va en `ink` con un punto naranja encima; el resto en `muted`.
- Escritorio: `BarraLateral` de 248 px. El destino activo va en pastilla negra (`bg-ink
  text-on-ink`) con el ícono naranja. Arriba, el botón naranja "Registrar movimiento";
  abajo, `EstadoConexion`.
- Las vistas que no caben en la barra móvil (Listas de compras, Ajustes) se alcanzan desde las acciones
  circulares de Inicio y desde los botones del encabezado.

## 9. Gráficos

- `Columnas`: una serie por mes. Mes seleccionado en `accent`, el resto en
  `color-mix(in oklab, var(--ink) 22%, var(--surface))`, negativos en `neg` hacia abajo.
  El tooltip es una pastilla negra (`bg-ink text-on-ink`) y hay una tabla `sr-only` con los
  valores. Tocar una columna cambia el mes seleccionado.
- `BarrasHorizontales`: ranking de categorías con barra `ink` sobre pista `surface-2`. Con
  `tope`, una marca naranja vertical señala lo presupuestado y la barra pasa a `neg` si se excede.
- No hay donuts ni gráficos de torta: con más de 4 partes no se leen. Para partes de un todo,
  usa barras ordenadas.

## 10. Errores comunes

| Error | Corrección |
|---|---|
| Scroll horizontal en móvil | `grid-cols-1` en rejillas y `min-w-0` en hijos flex que contienen texto largo |
| Verde o rojo como decoración | Solo dinero que entra o sale y estados; para resaltar, usa `ink` o `accent` |
| Texto naranja con `text-accent` | `text-accent-strong` (contraste AA) |
| Texto negro sobre botón naranja, o selección en negro junto a un botón naranja | `bg-accent-fill text-accent-ink`; selección en `bg-accent-soft` |
| Monto sin signo | `conSigno()` / `delta()` / `<Monto>` |
| `tabular-nums` en el héroe | Solo en tablas y columnas de cifras |
| Hexadecimales en componentes | Usa un token; si falta, agrégalo en `globals.css` y en `tokens.css` |
| Varios números grandes compitiendo | Uno héroe; los demás a 16–22 px |
