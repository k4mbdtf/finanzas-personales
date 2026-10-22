# DESIGN.md — Sistema de diseño y patrones de "Mis Finanzas"

Concepto de diseño, componentes y patrones de producto de esta app, escritos para **reutilizarlos en
otros proyectos**. Todo lo que está aquí existe en el código. Las rutas indican de dónde copiar.

> **En una frase:** estilo **suizo** (grilla, jerarquía tipográfica, formas rectas, neutros cálidos)
> con la **comodidad de Apple** (movimiento suave, superficies translúcidas, hojas que suben,
> objetivos táctiles de 44 px), mobile-first y accesible (texto con contraste AAA).

---

## 1. Principios

1. **Neutros cálidos, un solo acento.** El fondo es beige y las tarjetas blancas. El acento es
   carbón (nunca negro puro). El color de estado se usa poco: verde para lo positivo, rojo para lo
   negativo y ámbar para avisos.
2. **El color nunca va solo.** Todo estado lleva también ícono, texto o signo, por ejemplo
   `▲ 12% vs sep`, "Cerca del límite" o `−$12.500`. Los gráficos tienen leyenda y vista de tabla.
3. **La tipografía jerarquiza, no la decoración.** Se usan títulos grandes y apretados, etiquetas
   en MAYÚSCULAS espaciadas y cifras grandes en negrita. No hay degradados ni sombras fuertes.
4. **Formas rectas.** Los radios son de 2 a 8 px, los bordes de 1 px y las sombras casi
   imperceptibles.
5. **Movimiento con propósito.** Solo se animan `transform` y `opacity`, entre 200 y 700 ms y con
   curvas suaves. Con "Reducir movimiento" activado en el sistema no hay ninguna animación.
6. **Mobile-first.** En el celular hay barra inferior, botón flotante y hojas inferiores. En
   escritorio, sidebar y ventanas centradas. Todo objetivo táctil mide al menos 44 px.
7. **Sin spinners circulares.** Se usan esqueletos con brillo, tres puntos en los botones y una
   barra indeterminada en la carga inicial.
8. **Sin saltos.** Al recargar se mantiene el contenido anterior al 60 % de opacidad. Los
   esqueletos tienen la forma final.

---

## 2. Tokens (copiar tal cual)

Archivo: `src/index.css` (Tailwind CSS 4). Los colores se definen **una vez** como variables: la
versión clara va en `:root` y la oscura en `.dark`. Tailwind los expone como clases (`bg-page`,
`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-pos`, `text-neg`,
`text-warn`…), así que el modo oscuro **no duplica clases**.

```css
@import "tailwindcss";
@import "@fontsource-variable/inter/wght.css";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "Inter Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --radius-xs: 2px;  --radius-sm: 4px;  --radius-md: 6px;  --radius-lg: 8px;
  --ease-soft: cubic-bezier(0.22, 1, 0.36, 1);   /* salida suave (UI) */
  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);  /* hojas de iOS */
  --animate-enter: enter 420ms var(--ease-soft) both;
  --animate-page: page 280ms var(--ease-soft) both;
  --animate-fade: fade 200ms ease-out both;
}

@theme inline {
  --color-page: var(--page);           --color-surface: var(--surface);
  --color-subtle: var(--subtle);       --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);             --color-soft: var(--soft);     --color-muted: var(--muted);
  --color-accent: var(--accent);       --color-accent-hover: var(--accent-hover);
  --color-on-accent: var(--on-accent);
  --color-pos: var(--pos);   --color-on-pos: var(--on-pos);   --color-pos-bar: var(--pos-bar);   --color-pos-soft: var(--pos-soft);
  --color-neg: var(--neg);   --color-on-neg: var(--on-neg);   --color-neg-bar: var(--neg-bar);   --color-neg-soft: var(--neg-soft);
  --color-warn: var(--warn); --color-warn-bar: var(--warn-bar); --color-warn-soft: var(--warn-soft);
  --color-info-soft: var(--info-soft); --color-taupe: var(--taupe);
}
```

### Paleta

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `page` | `#f5f1e8` beige | `#111111` | Fondo de la app |
| `surface` | `#ffffff` | `#1c1c1e` | Tarjetas, hojas, sidebar |
| `subtle` | `#efeae0` | `#2c2c2e` | Rellenos suaves, hover, pista de barras |
| `line` | `#e4ded1` | `#2e2e31` | Líneas finas, separadores |
| `line-strong` | `#8a8478` | `#76767c` | Borde de campos (≥ 3:1) |
| `ink` | `#1c1c1c` carbón | `#f5f5f7` | Texto principal |
| `soft` | `#3f3b36` | `#d1d1d6` | Texto secundario |
| `muted` | `#4d4843` | `#bdbdc2` | Etiquetas, ayudas (aún ≥ 7:1) |
| `accent` | `#1c1c1c` | `#f5f1e8` (se invierte a beige) | Botón principal, activo |
| `on-accent` | `#ffffff` | `#1c1c1c` | Texto sobre el acento |
| `pos` / `pos-bar` / `pos-soft` | `#17532e` / `#2e7d4f` / `#e5efe7` | `#7fd6a1` / `#5cbf85` / `#18281e` | Ingreso, éxito |
| `neg` / `neg-bar` / `neg-soft` | `#8c1f16` / `#b3261e` / `#f7e3df` | `#ff9e94` / `#f2756a` / `#2e1c1a` | Gasto, error, peligro |
| `warn` / `warn-bar` / `warn-soft` | `#6e4400` / `#b7790a` / `#f6ead2` | `#f2c46b` / `#e0a53a` / `#2d2616` | Cerca del límite |
| `info-soft` | `#e7ebef` | `#1d2329` | Fondo de avisos informativos |
| `taupe` | `#b38b6d` | `#c9a688` | Solo decorativo (nunca texto) |

Variantes por color de estado: el **texto** usa `pos`, `neg` o `warn`, con contraste de 7:1. Las
**barras y rellenos** usan `*-bar` y los **fondos** de avisos y badges usan `*-soft`.

Sombras:

```css
:root { --shadow-card: 0 1px 2px rgb(28 28 28 / .04), 0 2px 12px rgb(28 28 28 / .05);
        --shadow-float: 0 8px 28px rgb(28 28 28 / .14), 0 2px 6px rgb(28 28 28 / .08); }
.dark { --shadow-card: 0 1px 2px rgb(0 0 0 / .4);
        --shadow-float: 0 12px 32px rgb(0 0 0 / .55), 0 2px 6px rgb(0 0 0 / .4); }
```

**Paleta para elementos del usuario** (categorías, cuentas, metas), sobria, con saturación de
80 % o menos: `#3d5a80` azul acero, `#2f6f5e` petróleo, `#5b4b8a` violeta, `#9b4a5e` vino,
`#b5532f` óxido, `#b38b6d` taupe, `#8a7a3d` oliva, `#4f7a3a` musgo, `#4a7d8c` azul gris y
`#6b6b6b` grafito.

### Tipografía

- **Fuente:** la del sistema en Apple (SF Pro). En el resto se usa Inter Variable, incluida en el
  build (sin Google Fonts).
- `h1, h2, h3`: `letter-spacing: -0.02em`.

| Rol | Estilo |
|---|---|
| Título de página (`title-page`) | 30 px y 700, con −0.03em; 36 px desde `md` |
| Título de sección | 17 px (`1.0625rem`), 600, `tracking-tight` |
| Título de hoja o modal | `text-lg` 600 |
| Etiqueta (`label-caps`) | 12 px, 500, MAYÚSCULAS, `letter-spacing .08em`, color `muted` |
| Cifra KPI (`figure-hero`) | 700 y −0.03em; 22 px en celular y 28 px desde `sm` |
| Cuerpo | 15 px (`0.9375rem`) en botones y filas; `text-sm` en secundarios |
| Etiqueta de campo | 13 px (`0.8125rem`) 500, color `soft` |
| Montos en listas y tablas | `tabular-nums` (dígitos alineados) |

### Utilidades propias (`@utility`)

| Clase | Qué hace |
|---|---|
| `card` | Fondo `surface`, borde `line`, `radius-lg` (8 px) y `shadow-card` |
| `glass` | Fondo `surface` al 78 % con `backdrop-filter: saturate(180%) blur(20px)`; para barras fijas |
| `label-caps` | Etiqueta en mayúsculas ("SALDO EN CUENTAS") |
| `title-page` | Título de página grande |
| `figure-hero` | Cifras grandes |
| `link` | Subrayado discreto (`line-strong`) que se marca al pasar el mouse |
| `pressable` | `:active` → `scale(.97)` en 160 ms con `ease-soft` |
| `stagger` | Los hijos entran en cascada, 60 ms entre cada uno (máximo 8) |
| `skeleton` | Bloque `subtle` con brillo que lo recorre en 1,4 s |

Foco: todo lo interactivo tiene `:focus-visible` con un contorno de 2 px de color `ink` separado
2 px. Solo aparece con teclado, no al tocar.

---

## 3. Movimiento

Keyframes en `index.css`. Solo se animan `transform` y `opacity`.

| Animación | Duración y curva | Dónde |
|---|---|---|
| `enter` (sube 12 px y aparece) | 420 ms `ease-soft` | Listas (`stagger`), estados vacíos |
| `page` (sube 6 px y aparece) | 280 ms | Cada cambio de ruta (`key={pathname}`) |
| `fade` | 200 ms | Avisos, nombre del mes al cambiarlo |
| `sheet-up` / `sheet-down` | 460 ms `ease-sheet` / 240 ms | Hoja inferior en celular |
| `dialog-in` / `dialog-out` | 300 / 200 ms (escala .98 → 1) | Modal en escritorio |
| `toast-in` | 380 ms (baja 14 px y escala .97) | Avisos breves |
| `dots` | 1 s infinito | Botón cargando (tres puntos) |
| `indeterminate` | 1,1 s | Barra fina en la carga inicial |
| `shimmer` | 1,4 s | Esqueletos |

En JavaScript (`src/lib/motion.ts`):

- `useReducedMotion()` lee la preferencia del sistema y se usa también para los gráficos.
- `useAnimatedNumber(target, 700)`: la cifra "cuenta" hasta su valor con easeOutExpo. Parte de 0
  al montar y luego anima desde el valor anterior.
- `ProgressBar`: la barra crece desde 0 con `scaleX` en 700 ms.
- El selector segmentado tiene un indicador que se desliza con `translateX` en 300 ms.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-delay: 0ms !important;
    animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```

---

## 4. Estructura de la app (shell)

Archivo: `src/components/AppShell.tsx` y `src/components/nav.ts`.

```
ESCRITORIO (md+)                               CELULAR
┌──────────┬──────────────────────────┐        ┌─────────────────────────┐
│ $ Logo   │  [glass] ‹ Octubre 2026 ›│        │ [glass] ‹ Octubre 2026 ›│ ← selector de mes (sticky)
│[+ Nueva] │                          │        │                         │
│ Inicio ▌ │  Título grande           │        │ Título grande           │
│ Movim.   │  subtítulo               │        │ KPIs 2×2                │
│ Presup.  │                          │        │ …                       │
│ Cuentas  │  max-w 72rem, px-10      │        │          [+ Nueva tx]   │ ← FAB sobre la barra
│ MÁS      │                          │        ├─────────────────────────┤
│ Deudas…  │                          │        │ ⌂   ⇄   ◎   ▭   …      │ ← barra inferior glass
│ email  ⎋ │                          │        └─────────────────────────┘   (4 principales + "Más")
└──────────┴──────────────────────────┘
```

- **Navegación con una sola fuente de verdad:** `nav.ts` tiene `MAIN_NAV` (4 ítems) y `MORE_NAV`
  (el resto, con `hint`). Agregar una sección significa agregar una línea ahí y su ruta.
- **Sidebar** de 256 px, `surface` y `sticky`. Arriba el logo y el botón principal "Nueva
  transacción". Luego los ítems principales, la etiqueta `label-caps` "MÁS", el resto de ítems y,
  al pie, el email y el botón de salir.
  - Ítem activo: fondo `subtle`, texto en 600, ícono con trazo 2.25 (1.75 si está inactivo) y una
    **barra carbón de 3 px a la izquierda** que crece en vertical.
- **Barra inferior** (celular), `glass` y `fixed`, con 5 columnas de 64 px de alto como mínimo.
  - Ícono de 22 px con texto de 10,5 px.
  - El activo lleva una **rayita de 2 px arriba** que crece en horizontal.
  - Respeta `env(safe-area-inset-bottom)`.
  - "Más" también queda activo en las secciones a las que se llega desde ahí.
- **Página "Más"** (celular): lista en tarjeta con ícono, título, `hint` de una línea y chevron.
- **Botón flotante** (celular): "+ Nueva transacción", con `rounded-lg`, `shadow-float` y 52 px de
  alto. Queda sobre la barra inferior y se oculta en Ajustes, Más, Categorías e Importar.
- **Contenido:** `max-w-[72rem]`, con `px-4 pt-6 pb-40` en celular (para que el FAB no tape
  nada) y `px-10 pt-10` en escritorio.
- **Selector de período** fijo arriba (`glass`), solo en las vistas que dependen del mes.
  - Tiene chevrones redondos de 40 px y el nombre del mes aparece con `fade`.
  - Muestra el botón "Hoy" solo si no estás en el mes actual.
- Enlace "Saltar al contenido" para teclado, `scrollTo(0)` al cambiar de ruta y entrada `page` en
  cada vista.

---

## 5. Componentes

Archivo base: `src/components/ui.tsx`. Son pequeños a propósito, fáciles de copiar y adaptar.

### Botón

| Variante | Clases |
|---|---|
| `primary` | `bg-accent text-on-accent hover:bg-accent-hover` + sombra de 1 px |
| `secondary` | `border-[1.5px] border-line-strong/45 bg-surface hover:bg-subtle` |
| `ghost` | `hover:bg-subtle` |
| `danger` | `bg-neg text-on-neg` |

- **Tamaños:** `sm` 36 px · `md` **44 px** · `lg` 48 px.
- `rounded-sm`, `font-semibold`, `tracking-[-0.01em]` y `pressable`.
- El ícono opcional mide 18 px (16 px en `sm`).
- `loading`: el texto queda en opacidad 0 y encima aparecen **tres puntos**, así el botón no cambia
  de ancho.

### Campos

- **Input:** 44 px de alto, `rounded-sm`, `border-line-strong/70` y `bg-surface`.
  - Foco: `border-ink` + `ring-4 ring-ink/10`.
  - Inválido: `aria-invalid` → `border-neg` + `ring-neg/15`.
- Etiqueta arriba en 13 px, `soft`. Ayuda en `text-xs muted`. Error en rojo con ícono
  `CircleAlert`, enlazado con `aria-describedby`.
- **Select:** `appearance-none` con un `ChevronDown` propio.
- **Monto** (`AmountInput`): formatea mientras se escribe (`$12.500`) y entrega un entero. Usa
  `inputMode="numeric"`. En versión `big` mide 64 px de alto con texto de 32 px en negrita, como
  campo protagonista del formulario.
- **Checkbox** con texto y ayuda debajo, usando `accent-color` del tema.

### Selector segmentado (estilo iOS)

- Pista `bg-subtle p-1 rounded-md`.
- El indicador es un `span` absoluto que se desliza con `translateX(index * 100%)` en 300 ms.
- Cada opción puede tener un **tono** que colorea el indicador: neutral, accent, pos o neg. Por
  ejemplo, Gasto en rojo, Ingreso en verde y Transferencia neutral.
- Por dentro son radios `sr-only` dentro de un `fieldset`, así funciona con teclado y lector.

### Tarjeta, encabezados y estados

- `Card` con `pad` `none` / `sm` (16 px) / `md` (20 px, y 24 px desde `md`).
- `PageHeader`: título grande, subtítulo `text-sm muted` y acciones a la derecha. Se envuelve en
  celular.
- `SectionHeader`: título de 17 px con ícono opcional y una acción a la derecha, por ejemplo un
  enlace "Ver todos". Recibe `id` para `aria-labelledby`.
- `EmptyState`: borde **punteado** `line-strong/40`, `surface/60` y un ícono de 26 px en un
  cuadro `subtle` de 56 px. Lleva título, texto guía y **una acción** concreta.
- `Alert` de tipo error, warning, success o info: fondo `*-soft`, borde `*/25` e ícono. Usa
  `role="alert"` o `status`.
- `Badge`: 11 px, `rounded-xs`, fondo `*-soft` con texto del mismo tono.
- `Logo`: cuadrado `accent` de 32 px con "$" + nombre en 17 px 600.
- `FullScreenLoader`: logo + barra indeterminada fina de 2 px por 144 px.
- `Loading`: filas de esqueleto (círculo + 2 líneas + monto), cada una con menos opacidad.

### Íconos

Archivo: `src/components/icons.tsx`. Se usa **Lucide** (`lucide-react`) con trazo 1.75, sin emojis.
La base de datos guarda el *nombre* del ícono (`"utensils"`) y un mapa lo traduce al componente.

- `IconTile`: el ícono va en un cuadro `rounded-lg` (32, 40 o 48 px) con el color del elemento al
  14 % de fondo y el trazo al 72 % mezclado con `--icon-mix`. En claro se oscurece y en oscuro se
  aclara, así se lee bien en los dos temas.

  ```ts
  backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
  color:           `color-mix(in srgb, ${color} 72%, var(--icon-mix))`,
  ```

- `InstitutionMark`: monograma de banco sobre su color de marca. La letra es blanca o carbón según
  el contraste.

### Hoja inferior / modal

Archivo: `src/components/Modal.tsx`. Usa `<dialog>` nativo, así el foco queda atrapado y Escape
funciona sin dependencias.

- **Celular:** hoja que sube desde abajo con la curva de iOS. Tiene `rounded-t-lg`, `max-h-92dvh`
  y respeta el área segura.
- **Escritorio:** ventana centrada de `max-w-lg` con `dialog-in`.
- Fondo `rgb(17 17 17 / .42)` con `blur(2px)`.
- Encabezado *sticky* con el título y un botón cerrar redondo de 36 px `bg-subtle`.
- La salida se anima: el último contenido se "congela" mientras la hoja baja. Escape y el clic
  afuera cierran con animación.
- `[data-autofocus]` elige qué campo recibe el foco al abrir.

### Feedback

Archivo: `src/components/Feedback.tsx`.

- `const confirm = useConfirm(); if (await confirm({ title, message, danger }))`: confirmación en la
  hoja con "Cancelar" y la acción (en rojo si es `danger`), en una grilla de 2 columnas.
- `toast('Guardado', 'success' | 'warning' | 'error')`:
  - Cápsula **siempre oscura**, como el HUD de iOS, arriba al centro.
  - Muestra 3 como máximo; dura 3,2 s (éxito) o 6 s (aviso o error).
  - Los íconos usan los colores de modo oscuro.

### Otros

- **ProgressBar:** 6 px de alto (8 px si es `thick`), pista `subtle`, `role="progressbar"`.
- **CategoryPicker:** grilla de 3 columnas (4 desde `sm`) de chips de 72 px con ícono y nombre. El
  chip activo lleva `border-ink bg-subtle`. Se elige con un toque.
- **ColorPicker / IconPicker:** radios `sr-only` con cuadros de 36 px. El elegido lleva un anillo
  `ink` y un ✓.
- **Filas de lista:**
  - Botón de ancho completo `px-4 py-3.5` con `IconTile`, título 500 truncado, subtítulo
    `0.8125rem muted` y monto a la derecha (`tabular-nums`).
  - `hover:bg-subtle/60` y `active:bg-subtle`, con divisores `border-b border-line last:border-0`.
- **Lista agrupada por día:** encabezado `label-caps` ("HOY", "AYER", "LUNES, 19 DE OCTUBRE") y
  una tarjeta por grupo.
- **Montos con signo:** `+` en verde para ingresos, `−` (signo menos real) en rojo para gastos y
  transferencias en `soft`, sin signo.

---

## 6. Anatomía del dashboard

Archivo: `src/features/dashboard/`.

```
Resumen                                   ← PageHeader: "Resumen" + mes
Octubre 2026

┌─────────────┬─────────────┬─────────────┬─────────────┐
│SALDO EN CTAS│INGRESOS     │GASTOS       │AHORRO · 23% │  ← 4 KPIs (2×2 en celular, 4 en lg)
│$1.234.567   │$2.100.000   │$1.610.000   │$490.000     │     cifra que "cuenta" al aparecer
│Tarjetas desc│↗ 5% vs sep  │↘ 3% vs sep  │↗ $40.000 vs │     variación: flecha + texto + color
└─────────────┴─────────────┴─────────────┴─────────────┘

⚠ Presupuestos en alerta              Ver todos   ← solo si hay (≥ 80 %), máx. 4, grilla 2 col
[🍴 Comida  $180.000 de $200.000   90%]
[▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░  ámbar        ]
[⚠ Quedan $20.000 · Cerca del límite ]

🗓 Próximos pagos            30 días · $845.000    ← solo si hay; 5 visibles + "Ver N más"
[💳 Tarjeta BCI    Deuda actual    $320.000 / Hoy · 22 oct]  ← tocar abre el pago ya completado

┌──── Gastos por categoría ────┬──── Ingresos y gastos · 12 meses ────┐  ← 2 col desde lg
│        ( dona )              │ ■ Ingresos ■ Gastos   [Ver como tabla]│
│     TOTAL GASTOS $1.610.000  │  ▌▌ ▌▌ ▌▌ ▌▌ ▌▌ ▌▌ …                  │
│ ■ Comida      $400.000  25%  │                                       │
│ ■ Transporte  $210.000  13%  │                                       │
└──────────────────────────────┴───────────────────────────────────────┘

┌──── Últimos movimientos ────────────────────── Ver todos ┐
│ 🍴 Comida · Almuerzo · CuentaRUT              −$8.500    │
└──────────────────────────────────────────────────────────┘
```

Reglas del dashboard:

- **KPI (`Tile`):** `card p-4 md:p-5`, con la etiqueta en `label-caps`, la cifra en `figure-hero` y
  una línea de contexto en `text-xs`.
  - El color de la cifra tiene significado: ingresos en `pos`, gastos en `neg` y saldo o ahorro
    en `neg` solo si son negativos.
  - El valor real va en `sr-only`; la cifra animada es `aria-hidden`.
- **Delta:** `ArrowUpRight` o `ArrowDownRight` con "5% vs sep" y un `sr-only` "Subió/Bajó".
  - Tiene **polaridad**: en gastos, subir es malo y se muestra en rojo.
  - Sin dato anterior muestra "Sin datos de sep"; si no cambió, "Igual que sep" con el ícono `=`.
- Las **secciones condicionales** (alertas, próximos pagos) no ocupan espacio si están vacías.
- **Gráficos con carga diferida:** el `import()` parte al cargar el módulo, en paralelo a los
  datos. Mientras tanto se muestra un esqueleto de 256 px de alto. Los KPIs no esperan a Recharts.
- **Primer uso:** si no hay datos, en vez de un dashboard vacío se muestra un `EmptyState` "Empecemos
  en 3 pasos" con un botón a la primera acción.
- El **esqueleto** tiene la forma exacta del dashboard (título, 4 KPIs y 2 gráficos).
- Al cambiar de mes el contenido anterior queda al 60 % de opacidad (`aria-busy`) hasta que llegan
  los datos nuevos.

---

## 7. Gráficos (Recharts)

Archivo: `src/lib/chartTheme.ts`. Recharts recibe los colores como atributos SVG, así que se eligen
en JavaScript según el tema (`useIsDark()` observa la clase de `<html>`).

| | Claro | Oscuro |
|---|---|---|
| Ingreso | `#008300` | `#0ca30c` |
| Gasto | `#e34948` | `#e66767` |
| Serie principal (patrimonio o valor) | `#2a78d6` | `#3987e5` |
| Serie comparada (aportado) | `#eb6834` | `#d95926` |
| "Otros" | `#a39e93` | `#636366` |
| Grilla | `#ece7dc` | `#2c2c2e` |
| Ejes | `#6e695f` | `#98989d` |

Reglas:

- **Verde y rojo nunca solos**, porque quedan en el límite de distinción para daltonismo. Siempre
  llevan leyenda, orden fijo (ingreso a la izquierda), separación entre barras, tooltip y **"Ver
  como tabla"**.
- **Dona:**
  - Máximo 6 segmentos: los 5 mayores + "Otros (n)".
  - Agujero del 62 %, borde de 2 px del color de la superficie y el total al centro.
  - La **leyenda es una tabla** con color, nombre, monto y %, todo legible sin pasar el mouse.
- **Barras:** solo grilla horizontal, sin líneas de marca, radio superior de 2 px, 18 px de ancho
  como máximo y eje Y compacto (`$1,5 M`, `$85 mil`).
- Los colores de categoría se suavizan con `mute()`, que los mezcla un 22 % con el gris cálido
  `#8a8478` para que no desentonen con la interfaz.
- Tooltip: `rounded-sm border-line bg-surface shadow-float`.
- Cada gráfico tiene `role="img"` con un `aria-label` que resume los datos.
- Las animaciones duran entre 700 y 900 ms y se desactivan con `useReducedMotion()`.

---

## 8. Accesibilidad (checklist)

- [ ] El texto tiene contraste de **7:1 o más (AAA)** sobre `page`, `surface` y `subtle`. Los
      bordes de campos y las barras, 3:1 o más.
- [ ] Ningún estado depende solo del color: lleva ícono, texto, signo o `sr-only`.
- [ ] Los objetivos táctiles miden 44 px o más (40 px como mínimo en controles secundarios).
- [ ] `:focus-visible` visible y consistente.
- [ ] Hay enlace "Saltar al contenido".
- [ ] Los modales usan `<dialog>` nativo.
- [ ] Los grupos de opciones son `fieldset` + `legend`, con radios `sr-only`.
- [ ] Los campos tienen `aria-invalid` y `aria-describedby` para la ayuda y el error.
- [ ] Hay `role="status"`, `aria-live` y `aria-busy` en cargas y avisos.
- [ ] Los gráficos tienen `role="img"`, un resumen y una vista de tabla.
- [ ] Se respeta `prefers-reduced-motion` en CSS y en JavaScript.
- [ ] Los campos de texto miden 16 px o más en celular (evita el zoom de iOS).
- [ ] Se usa `inputMode` según el dato (`numeric`, `decimal`) y `enterKeyHint`.

---

## 9. Tema claro / oscuro

Archivos: `src/lib/theme.ts` + un script en línea en `index.html`.

- Preferencia `system | light | dark` guardada en `localStorage` y aplicada con `.dark` en `<html>`.
- El **script en línea en `<head>`** aplica el tema *antes de pintar*, así no hay parpadeo.
- También actualiza `<meta name="theme-color">`: `#f5f1e8` en claro y `#111111` en oscuro.
- En modo `system` escucha los cambios de `prefers-color-scheme`.
- Ajustes ofrece un `Segmented` con Sistema, Claro y Oscuro.

---

## 10. Patrones de producto (reutilizables)

### Registro rápido (la acción principal está siempre a un toque)

- Botón principal en la sidebar y un FAB en el celular. Abre una hoja global (`useTransactionDrawer()`)
  desde cualquier pantalla, con **valores precompletados** opcionales, por ejemplo "Pagar tarjeta".
- Orden del formulario:
  1. Tipo, con un segmentado de colores.
  2. **Monto grande con foco automático** y teclado numérico.
  3. Categoría en una grilla de un toque.
  4. Cuenta: recuerda la última usada.
  5. Fecha: parte en "Hoy".
  6. Nota y etiquetas, escondidas en `<details>` "Más detalles".
- Después de guardar avisa si el gasto dejó un presupuesto sobre el 80 % o el 100 %.

### Umbrales con 3 niveles

Archivo: `src/lib/budget.ts`. Hay un solo lugar con la lógica y los estilos:

```ts
ok   (< 80 %)  → barra ink,       texto soft
warn (≥ 80 %)  → barra warn-bar,  texto warn, TriangleAlert, "Cerca del límite"
over (≥ 100 %) → barra neg-bar,   texto neg,  OctagonAlert,  "Excedido por $X"
```

### Próximos vencimientos

Archivo: `src/lib/upcoming.ts`. Es una lista de los próximos 30 días que junta varias fuentes
(tarjetas, préstamos, recurrentes y cuotas). Muestra un total arriba, una etiqueta relativa
("Hoy" en ámbar, "Mañana", "En 5 días") y **la acción ya completada al tocar**.

### Comparar contra el período anterior

Todo KPI muestra su variación. El resumen anual compara contra el mismo período del año anterior
(si el año va en curso, de enero hasta este mes).

### Primer uso guiado

Si no hay datos, cada pantalla muestra un `EmptyState` con 1 a 3 pasos y un botón a la primera
acción, nunca una pantalla en blanco.

### Más patrones

- **Confirmar lo destructivo** con `useConfirm({ danger: true })`. Se **archiva** en vez de
  eliminar cuando hay historial.
- **Funciones opcionales apagadas por defecto**, por ejemplo la multimoneda. Una casilla en Ajustes
  la activa; apagada, la app se ve igual que antes. El cambio es optimista: se ve al instante y se
  revierte si falla al guardar.
- **Reglas automáticas** "si contiene X → usar Y". La comparación ignora mayúsculas, tildes y
  signos, es por palabra completa y, si calzan varias, gana la más específica. Lógica pura y
  probada en `src/lib/rules.ts`.
- **Dividir un registro en partes:** se muestra cuánto falta o sobra en vivo y se guarda de forma
  atómica en el servidor.
- **Importar CSV:** vista previa, detección de duplicados por *hash* y la opción de deshacer cada
  lote.
- **Exportar datos:** CSV para Excel (separado por `;` y en UTF-8 con BOM) y un respaldo completo
  en JSON.

---

## 11. Arquitectura que acompaña al diseño

Es opcional, pero fue lo que hizo la app simple de mantener.

- **Stack:** React 18, Vite, TypeScript, Tailwind 4, React Router (`HashRouter` para GitHub
  Pages), Supabase (Postgres + Auth, sin servidor propio), Recharts con carga diferida y Lucide.
- **Una sola capa de datos** (`src/data/*`): ningún componente habla con la base de datos
  directamente.
- **Recarga sin librería de caché:**
  - Las mutaciones llaman a `emitChange('transactions')`.
  - `useQuery(fn, deps, ['transactions'])` se recarga solo cuando cambia algún tópico suyo.
  - Mientras recarga, mantiene los datos anteriores.
  - Archivos: `src/lib/events.ts` y `src/hooks/useQuery.ts`.
- **Datos de referencia en contexto** (`RefData`): cuentas, categorías y mapas `byId`, cargados una
  vez y compartidos por todas las vistas.
- **Lógica pura en `src/lib/*`** sin imports de React, probada con `node --test`. Cubre fechas,
  presupuestos, próximos pagos, reglas, monedas y resumen anual.
- **Totales en la base de datos:** funciones SQL `security invoker` que respetan RLS, así no se
  traen miles de filas al navegador.
- **Seguridad en Postgres:** RLS con 4 políticas por tabla y **FKs compuestas `(id, user_id)`**,
  para que nadie pueda referenciar filas de otro usuario aunque conozca el UUID.
- **Degradación elegante:** si falta una migración (códigos `PGRST205`, `42703` o `PGRST202`), la
  sección explica qué ejecutar y el resto de la app sigue funcionando.
- **Formato local en un solo archivo** (`src/lib/format.ts`):
  - montos `$12.500` sin decimales y compactos (`$1,5 M`, `$85 mil`);
  - porcentajes con 1 decimal bajo 10 %;
  - fechas en `America/Santiago`;
  - en Chile `es-CL` usa punto de miles y coma decimal.
- **PWA:** manifest y un *service worker* propio sin dependencias. Guarda solo la app, **nunca los
  datos**, y limpia los assets viejos con `asset-manifest.json`.
- **Calidad:** ESLint (incluye `exhaustive-deps` aplicado a `useQuery`), `tsc`, pruebas unitarias,
  pruebas SQL en Postgres desechable (Docker) y Playwright con un Supabase simulado en memoria.
  Todo corre en CI en cada push.

---

## 12. Cómo aplicarlo en otro proyecto

1. Copiar `src/index.css` completo (tokens, utilidades y keyframes) y el script de tema de
   `index.html`.
2. Copiar `src/lib/theme.ts`, `src/lib/motion.ts` y `src/lib/chartTheme.ts`.
3. Copiar `src/components/ui.tsx`, `Modal.tsx`, `Feedback.tsx`, `ProgressBar.tsx`, `icons.tsx`
   (solo `IconTile`) y `AppShell.tsx` + `nav.ts`. Luego cambiar las secciones.
4. Instalar las dependencias: `tailwindcss@4`, `@tailwindcss/vite`, `@fontsource-variable/inter`,
   `lucide-react` y, si hay gráficos, `recharts`.
5. Para otra identidad de marca, cambiar solo las variables de `:root` y `.dark`: `--page`,
   `--accent` y los de estado. Después **volver a verificar el contraste** (7:1 en texto, 3:1 en
   bordes).

### Prompt para pedirle este estilo a una IA

> Diseña la interfaz con estilo suizo minimalista y comodidad tipo Apple:
> - **Paleta:** fondo beige `#F5F1E8`, tarjetas blancas con borde `#E4DED1` de 1 px y sombra casi
>   imperceptible, texto y botón principal carbón `#1C1C1C` (nunca negro puro). En modo oscuro el
>   fondo es `#111111`, las tarjetas `#1C1C1E` y el botón principal se invierte a beige.
> - **Formas y tipografía:** radios de 2 a 8 px, fuente del sistema o Inter, títulos grandes con
>   letter-spacing negativo, etiquetas en MAYÚSCULAS de 12 px espaciadas y cifras grandes en
>   negrita con `tabular-nums` en listas.
> - **Íconos:** Lucide con trazo 1.75, dentro de cuadros redondeados con el color del elemento al
>   14 %.
> - **Color de estado:** verde, rojo y ámbar solo para estados, siempre acompañados de ícono o
>   texto. Contraste AAA.
> - **Navegación:** en celular, barra inferior translúcida (blur) con 4 secciones + "Más", un botón
>   flotante para la acción principal y modales como hojas que suben desde abajo. En escritorio,
>   sidebar de 256 px con una barra carbón de 3 px junto al ítem activo.
> - **Movimiento:** solo transform y opacity, entre 200 y 700 ms con
>   `cubic-bezier(.22,1,.36,1)`. Listas en cascada, cifras que cuentan y barras que se llenan.
>   Esqueletos con brillo en vez de spinners. Respetar `prefers-reduced-motion`.
> - **Gráficos:** con leyenda y botón "Ver como tabla".
