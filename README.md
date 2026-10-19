# 💰 Mis Finanzas

Aplicación web de finanzas personales multiusuario. Cada usuario ve **solo sus propios datos**.
Español (Chile), montos en CLP sin decimales (`$12.500`), zona horaria `America/Santiago`, mobile-first.

**Stack:** React + Vite + TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth, sin servidor propio) · hosting estático (GitHub Pages o Vercel).

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Modelo de datos, RLS, autenticación | ✅ |
| 2 | Cuentas y transacciones | ✅ |
| 3 | Categorías y presupuestos | ✅ |
| 4 | Dashboard y gráficos | ✅ |
| 5 | PWA, exportación, despliegue y keep-alive | ✅ |
| Etapa 2 | Deudas y cuotas, metas, recurrentes, importar cartolas, patrimonio | ✅ |

**Inicio rápido:** [1. Supabase](#1-crear-el-proyecto-en-supabase) → [2. Auth](#2-configurar-auth) →
[3. Captcha](#3-activar-el-captcha-cloudflare-turnstile) → [4. Local](#4-ejecutar-en-local) →
[6. Desplegar](#6-desplegar-en-github-pages).

---

## Estructura del proyecto

```
supabase/migrations/
  0001_schema.sql               Tablas, índices, constraints, RLS, triggers, eliminar cuenta
  0002_categories_budgets.sql   Reglas de categorías/presupuestos y RPC spending_by_category
  0003_dashboard.sql            RPC monthly_totals (ingresos/gastos por mes)
  0004_keepalive.sql            RPC keepalive() para el workflow anti-pausa
  0005_etapa2.sql               Deudas, metas, recurrentes, cuotas, importaciones, patrimonio
supabase/tests/          Pruebas SQL de las migraciones (PostgreSQL local con Docker)
supabase/email-templates/ Correos de confirmación y recuperación en español
.github/workflows/
  deploy.yml             Pruebas + build + publicación en GitHub Pages en cada push a main
  keepalive.yml          Ping a Supabase cada 3 días
public/                  manifest.webmanifest, sw.js (service worker), íconos
scripts/
  lib.mjs                Utilidades (cliente admin y por usuario) — SOLO local
  seed.mjs               Crea 3 usuarios de prueba con datos distintos
  test-isolation.mjs     Pruebas automáticas de aislamiento entre usuarios (API real)
  test-sql.sh            Aplica todas las migraciones en un PostgreSQL desechable y las prueba
src/
  types.ts               Tipos de las tablas (actualizar si cambia el SQL)
  lib/                   supabase (cliente), format (CLP), dates (meses), errors,
                         events (recarga automática), icons (emoji de categorías),
                         theme (claro/oscuro), pwa (service worker, instalar), chartTheme,
                         csv (cartolas), recurring (fechas), debt, goals  (+ *.test.ts)
  hooks/useQuery.ts      Carga de datos + recarga cuando cambia un tópico
  data/                  Única capa que habla con Supabase (accounts, categories, transactions,
                         budgets, dashboard, export, goals, recurring, installments, imports, netWorth)
  context/               RefData (cuentas y categorías globales), Month (mes seleccionado)
  auth/AuthProvider.tsx  Sesión global + detección de recuperación de contraseña
  components/            UI base, Modal (<dialog>), Feedback (confirmar/toast),
                         AmountInput, MonthSelector, AppShell (sidebar + barra inferior)
  features/accounts/     Página de cuentas y formulario
  features/transactions/ Drawer de registro rápido, listado, filtros
  features/categories/   Categorías: crear, editar color/ícono, archivar, eliminar
  features/budgets/      Presupuestos mensuales, barra de progreso, alertas
  features/dashboard/    KPIs, dona de gastos, barras 12 meses (Recharts, carga diferida)
  features/debts/        Deudas y cuotas: préstamos, tarjetas, compras en cuotas, me deben
  features/goals/        Metas de ahorro y abonos
  features/recurring/    Movimientos recurrentes
  features/import/       Importar cartolas CSV (rows.ts + pruebas)
  features/networth/     Patrimonio neto en el tiempo
  components/nav.ts      Secciones del menú (agregar una sección = una línea aquí + ruta en App.tsx)
  pages/                 Auth, Ajustes, Más (celular), Privacidad
```

### Cómo fluyen los datos

1. Una vista llama a `useQuery(() => listX(...), deps, ['transactions'])`.
2. Las mutaciones (`createTransaction`, etc.) en `data/` llaman a `emitChange('transactions')`.
3. Todas las vistas suscritas a ese tópico se recargan solas (lista, saldos, inicio).

Así no se necesita una librería de caché y agregar una vista nueva es solo usar `useQuery`.

## Modelo de datos

```
auth.users (Supabase)
  └─ profiles      1:1  configuración (moneda CLP, zona horaria)
  └─ accounts      cash | bank | savings | credit_card | loan | receivable
  │                (+ cupo/cierre/pago en tarjetas; monto, cuota, plazo, tasa y acreedor en préstamos)
  └─ categories    income | expense, color, ícono (15 por defecto al registrarse)
  └─ transactions  income | expense | transfer
  │     account_id    → accounts     (FK compuesta con user_id)
  │     to_account_id → accounts     (solo transfer, FK compuesta)
  │     category_id   → categories   (FK compuesta; el tipo debe coincidir)
  │     tags text[]
  │     recurring_rule_id, installment_plan_id + installment_no, import_batch_id + import_hash
  └─ budgets       presupuesto mensual por categoría (month = 1er día del mes)
  └─ goals ─ goal_contributions      metas de ahorro y abonos/retiros
  └─ recurring_rules                 plantilla + frecuencia; generan transactions
  └─ installment_plans               compra en cuotas; sus cuotas son transactions
  └─ import_batches                  cada cartola importada (para deshacer)
views: account_balances (saldo por cuenta), goal_progress (avance de metas) — security_invoker
```

Decisiones clave:

- **Montos `bigint`** en pesos enteros, siempre positivos; el signo lo da `type`.
- **Transferencias** son un tipo propio: los reportes de ingresos/gastos filtran
  `type in ('income','expense')`, así que nunca cuentan como gasto ni ingreso.
- **FKs compuestas `(id, user_id)`**: aunque alguien conozca el UUID de la cuenta de otro usuario,
  la base de datos rechaza la referencia. Esto se suma a RLS (defensa en profundidad).
- **Etiquetas** como `text[]` con índice GIN: simple y suficiente para filtrar.
- **Totales en la BD**: los agregados (gasto por categoría, totales mensuales) son funciones SQL
  `security invoker`, así respetan RLS y no hay que traer miles de filas al navegador.

### Decisiones de la Etapa 2

| Funcionalidad | Cómo funciona |
|---|---|
| **Deudas** | Un préstamo es una cuenta `loan` con saldo negativo (como la tarjeta) y "me deben" una cuenta `receivable` con saldo positivo. Pagar o cobrar = **transferencia**: el capital no se cuenta como gasto y el patrimonio cuadra solo. Los intereses, si quieres, se anotan como gasto aparte. |
| **Compras en cuotas** | `create_installment_plan()` crea la compra y **todas** sus cuotas (una por mes, la última absorbe el redondeo; o cuota fija si tiene interés) de forma atómica. El cupo de la tarjeta se descuenta completo al comprar y cada cuota cuenta como gasto en su mes. Cambiar descripción/categoría se propaga a las cuotas; montos y plazo no se editan (se elimina y se crea de nuevo). |
| **Recurrentes** | `materialize_recurring()` genera los movimientos pendientes hasta hoy cada vez que se abre la app. Es idempotente: `unique (recurring_rule_id, recurring_date)` impide duplicados aunque se llame muchas veces o desde dos pestañas. Las fechas se calculan siempre desde el inicio (31-ene → 28-feb → 31-mar), igual en SQL y en `src/lib/recurring.ts`. Al reactivar una pausada no se rellenan las fechas perdidas. |
| **Metas** | El avance es el saldo de una cuenta vinculada (vista `goal_progress`) o la suma de abonos manuales. Se calcula cuánto ahorrar al mes para llegar a la fecha. |
| **Importar cartolas** | Sirve para cualquier banco: el CSV se lee en el navegador (UTF-8 o Windows-1252, `;` `,` o tabulador, montos `$1.234.567`, `(500)`, `500-`, fechas `dd/mm/aaaa`, `01-oct-2026`…), se adivinan las columnas y el usuario las corrige. Cada fila tiene una huella SHA-256 (cuenta + fecha + monto + descripción + n° de repetición); `unique (user_id, import_hash)` omite lo ya importado. Lo que coincide con movimientos ingresados a mano se marca como "posible duplicado". La importación es atómica y se puede **deshacer** por lote. Se sugieren categorías según descripciones anteriores. |
| **Patrimonio** | `net_worth_by_month()` reconstruye el saldo de cada cuenta a fin de mes (saldo inicial + movimientos; las cuotas desde la fecha de compra). Activos = efectivo, banco, ahorro y me deben; deudas = tarjetas y préstamos. |

Para agregar más funcionalidades se sigue el mismo patrón: **una migración nueva** + un archivo en
`src/data/` + una carpeta en `src/features/` + una línea en `components/nav.ts` y en `App.tsx`, con
`user_id default auth.uid()`, RLS de 4 políticas, FKs compuestas y pruebas en `supabase/tests/`.

## Funcionalidades

**Cuentas** (`/#/cuentas`): efectivo, banco, ahorro y tarjeta de crédito con saldo actual calculado.
Las tarjetas muestran deuda, cupo disponible (barra ámbar sobre el 80%), día de cierre y de pago.
Una cuenta con movimientos no se puede eliminar, pero sí archivar. El pago de la tarjeta se
registra como **transferencia** banco → tarjeta.

**Movimientos** (`/#/movimientos`): ingreso, gasto y transferencia, agrupados por día. Filtros por
mes (o rango de fechas), tipo, cuenta, categoría, etiqueta y texto en la nota. Tocar un movimiento
abre la edición, con opción de eliminarlo (con confirmación).

**Registro rápido** (botón `+ Nueva transacción`): el monto queda enfocado con teclado numérico,
la categoría se elige con un toque, la cuenta recuerda la última usada y la fecha parte en "Hoy".
Nota y etiquetas van en "Más detalles". Si el gasto deja su categoría sobre el 80% o el 100% del
presupuesto, aparece un aviso.

**Categorías** (`/#/categorias`, desde la sidebar o Ajustes): 15 predefinidas al registrarse y
personalizables (nombre, ícono, color). El tipo (gasto/ingreso) no se puede cambiar si la categoría
ya tiene movimientos (lo valida la BD). Eliminar una categoría deja sus movimientos "Sin categoría";
archivarla la oculta de los formularios y conserva el historial.

**Presupuestos** (`/#/presupuestos`): monto mensual por categoría de gasto. Barra de progreso
verde-azulada, **ámbar al 80%** y **roja al 100%**, siempre con texto ("Cerca del límite",
"Excedido por $X") para no depender del color. Resumen del total y botón para copiar los
presupuestos del mes anterior. Las transferencias no cuentan como gasto.

**Inicio / Dashboard** (`/#/`): para el mes seleccionado muestra:
- KPIs: saldo total, ingresos, gastos y ahorro (con % de ahorro sobre ingresos), con variación
  vs el mes anterior (▲/▼ + texto; en gastos subir es malo).
- Presupuestos en alerta (≥ 80%).
- Dona de gastos por categoría: top 5 + "Otros", con el color de cada categoría y una leyenda-tabla
  con monto y %.
- Barras de ingresos vs gastos de los 12 meses que terminan en el mes seleccionado, con botón
  "Ver como tabla".
- Últimos 5 movimientos.

**Deudas y cuotas** (`/#/deudas`): préstamos con % pagado y cuotas restantes, tarjetas con cupo
usado, compras en cuotas ("cuota 3 de 12, próxima el…") y lo que te deben. Botones **Registrar pago**,
**Pagar** y **Registrar cobro** abren el registro rápido ya completado.

**Metas** (`/#/metas`), **Recurrentes** (`/#/recurrentes`), **Importar cartola** (`/#/importar`) y
**Patrimonio** (`/#/patrimonio`, línea de 12 o 24 meses con vista de tabla). En el celular están en
**Más** (barra inferior); en escritorio, en la barra lateral.

**Ajustes** (`/#/ajustes`): tema (Sistema / Claro / Oscuro), instalar la app, **exportar mis datos**
(movimientos en CSV con `;` y UTF-8 para Excel, o respaldo completo en JSON), cambiar contraseña,
eliminar la cuenta y todos los datos, y enlace a Privacidad.

**PWA**: instalable en Android, iOS y escritorio. El service worker (`public/sw.js`, sin
dependencias) guarda solo la app (HTML/JS/CSS/íconos) para que abra rápido y sin conexión; los datos
financieros **nunca** se guardan en el caché: siempre vienen de Supabase. Sin internet la app abre,
pero muestra "Sin conexión" al cargar datos.

Los colores de ingresos/gastos (`src/lib/chartTheme.ts`) se validaron para contraste en claro y
oscuro. Verde/rojo queda en el límite de distinción para daltonismo, por eso nunca se usan solos:
leyenda, orden fijo, separación entre barras, tooltip y vista de tabla. Los totales los calcula la
base de datos (`monthly_totals`, `spending_by_category`) y las transferencias no cuentan.

## Seguridad

- RLS activado en todas las tablas, con políticas `SELECT/INSERT/UPDATE/DELETE` solo donde
  `user_id = auth.uid()`. `anon` no tiene ningún privilegio sobre las tablas.
- Al registrarse, el trigger `on_auth_user_created` crea el perfil y las categorías por defecto.
- `delete_my_account()` (RPC) borra el usuario actual; todo lo demás se elimina en cascada.
- El frontend solo usa la **anon key**. La **service_role** solo se usa en `scripts/` en tu equipo
  y está en `scripts/.env.scripts` (ignorado por git). **Nunca** la pongas en variables `VITE_*`
  ni en los secrets de GitHub.
- Las funciones SQL invocables: `delete_my_account`, `spending_by_category`, `monthly_totals`,
  `materialize_recurring`, `create_installment_plan`, `import_transactions`, `net_worth_by_month`
  (solo `authenticated`, todas `security invoker` = respetan RLS) y `keepalive` (también `anon`, no lee datos).
- El service worker no cachea ninguna respuesta de Supabase.

---

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project** (región recomendada: `South America (São Paulo)`).
2. Ve a **SQL Editor** → **New query**, pega y ejecuta **en orden** cada archivo de
   `supabase/migrations/` (`0001_schema.sql`, luego `0002_categories_budgets.sql`, …).
   Cada archivo se ejecuta una sola vez; las fases siguientes agregan archivos nuevos.
3. En **Project Settings → API Keys** copia la **Project URL**, la **anon public key** (o la
   *publishable key*, que también sirve) y la **service_role / secret key** (esta última solo para
   scripts locales).

### 2. Configurar Auth

En **Authentication**:

1. **Sign In / Providers → Email**: activo, con **Confirm email** activado.
   Largo mínimo de contraseña: 8 (recomendado: *Lowercase, uppercase letters and digits*).
2. **URL Configuration**:
   - *Site URL*: la URL pública de la app, p. ej. `https://k4mbdtf.github.io/finanzas-personales/`
   - *Redirect URLs*: agrega esa misma URL y `http://localhost:5173/`
3. **Rate Limits**: los valores por defecto sirven. Considera que el correo integrado de Supabase
   permite muy pocos envíos por hora; para uso real configura un **SMTP propio**
   (Resend, Brevo, etc.) en *Authentication → Emails → SMTP Settings*.
4. (Opcional) **Emails → Templates**: traduce los correos de confirmación y recuperación al español.

### 3. Activar el captcha (Cloudflare Turnstile)

1. En [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add widget**.
   Dominios: `k4mbdtf.github.io` y `localhost`. Modo: *Managed*.
2. Copia la **Site Key** (pública) → va en `VITE_TURNSTILE_SITE_KEY`.
3. Copia la **Secret Key** → Supabase **Authentication → Attack Protection → Enable Captcha
   protection** → proveedor *Turnstile* → pega la secret key.

Con el captcha activo, Supabase exige un token en registro, login y recuperación de contraseña;
la app ya lo envía. Si dejas `VITE_TURNSTILE_SITE_KEY` vacío, el widget no se muestra (solo para
desarrollo con el captcha desactivado en Supabase).

### 4. Ejecutar en local

Requiere Node 20+.

```bash
npm install
cp .env.example .env.local     # y completa URL, anon key y site key
npm run dev                    # http://localhost:5173
```

### 5. Pruebas

Hay tres niveles; los dos primeros no tocan Supabase y corren también en GitHub Actions antes de
cada despliegue:

```bash
npm run test:unit   # lógica pura: CSV de bancos, fechas recurrentes, deudas, metas (node --test)
npm run test:sql    # aplica TODAS las migraciones en un PostgreSQL desechable (Docker) y prueba
                    # reglas, RPCs, aislamiento entre usuarios, permisos de anon y borrado en cascada
```

`test:sql` necesita Docker en ejecución. Imita lo mínimo de Supabase (`supabase/tests/00_supabase_stub.sql`),
aplica 0001–0004, carga datos "existentes" y recién ahí aplica 0005, para verificar que la migración
funciona sobre datos reales.

El tercer nivel prueba contra la API real de tu proyecto:

#### Datos de prueba y pruebas de aislamiento (API real)

> ⚠️ Usa un **proyecto Supabase de desarrollo**, no el de producción. Los scripts usan la
> service_role key y crean usuarios `*.test@example.com`.
> Como el login de los scripts no puede resolver un captcha, **desactiva temporalmente el captcha**
> en ese proyecto mientras los ejecutas.

```bash
cp scripts/.env.scripts.example scripts/.env.scripts   # y complétalo
npm run seed             # crea ana, bruno y carla (*.test@example.com) con datos distintos
npm run test:isolation   # ejecuta los ataques entre usuarios
```

Lo que verifica `test:isolation` (cada punto es una prueba automática):

- [ ] Cada usuario solo ve sus filas en `accounts`, `categories`, `transactions`, `budgets`, `profiles` y en la vista `account_balances`.
- [ ] `SELECT ... where id = <id de otro usuario>` devuelve 0 filas.
- [ ] `UPDATE` / `DELETE` sobre filas ajenas afectan 0 filas y los datos del otro quedan intactos.
- [ ] `INSERT` con `user_id` de otro usuario es rechazado; cambiar `user_id` en un `UPDATE` es rechazado.
- [ ] No se puede crear una transacción en la cuenta de otro, usar su categoría, transferir hacia su cuenta, presupuestar su categoría ni mover una transacción propia a su cuenta (FKs compuestas).
- [ ] Integridad: categoría de tipo incorrecto, monto 0, transferencia a la misma cuenta y cupo en cuenta que no es tarjeta son rechazados.
- [ ] Sin sesión (`anon`) no se lee ninguna tabla ni se puede llamar a `delete_my_account`; solo `keepalive`, que devuelve `"ok"`.
- [ ] `spending_by_category` y `monthly_totals` solo suman datos propios, excluyen transferencias, y `anon` no puede llamarlas.
- [ ] No se puede presupuestar una categoría de ingreso ni una categoría ajena (ni con `upsert`).
- [ ] No se puede cambiar el tipo de una categoría con movimientos; editar/borrar categorías ajenas afecta 0 filas.
- [ ] El registro crea perfil y categorías por defecto; `delete_my_account` borra todos los datos del usuario sin afectar a los demás.

La contraseña de los usuarios de prueba está en `scripts/lib.mjs`.

### 6. Desplegar en GitHub Pages

> GitHub Pages gratis requiere que el repositorio sea **público** (o un plan pago). El código no
> contiene secretos: la URL y la anon key son públicas por diseño y la seguridad la da RLS.

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `VITE_SUPABASE_URL` = `https://TU-PROYECTO.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = la anon / publishable key
   - `VITE_TURNSTILE_SITE_KEY` = la site key de Turnstile (opcional)
3. Haz push a `main` (o **Actions → Deploy a GitHub Pages → Run workflow**). El workflow compila con
   `VITE_BASE=/<nombre-del-repo>/` y publica en `https://<usuario>.github.io/<nombre-del-repo>/`.
4. Vuelve a Supabase **Authentication → URL Configuration** y verifica que *Site URL* y
   *Redirect URLs* tengan exactamente esa URL (con `/` final). En Turnstile agrega el dominio
   `<usuario>.github.io`.

Enrutamiento: la app usa **HashRouter** (`/#/ajustes`), así que GitHub Pages siempre sirve
`index.html` y no hace falta `404.html` ni rewrites. Los enlaces de los correos usan el flujo
**PKCE** (`?code=` en la query), compatible con el hash. El enlace de recuperación de contraseña
debe abrirse en el mismo navegador donde se solicitó.

**Alternativa: Vercel.** Importa el repo, framework *Vite*, y define las mismas variables
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` y `VITE_BASE=/`. Agrega la
URL de Vercel en Supabase (Site URL / Redirect URLs) y en Turnstile.

### 7. Keep-alive (evitar la pausa del plan gratuito)

Supabase pausa los proyectos gratuitos tras ~7 días sin actividad. El workflow
`.github/workflows/keepalive.yml` llama a `rpc/keepalive` cada 3 días con los mismos secrets del
paso 6 (requiere la migración `0004_keepalive.sql`). Pruébalo una vez a mano en
**Actions → Keep-alive Supabase → Run workflow**.

Ojo: GitHub desactiva los workflows programados de repos **sin commits en 60 días** y avisa por
correo; si pasa, vuelve a activarlo en la pestaña Actions o haz cualquier commit.

## Mantenimiento

- **Cambiar el esquema:** nunca edites una migración ya aplicada; crea `supabase/migrations/000N_...sql`,
  ejecútala en el SQL Editor, actualiza `src/types.ts` y agrega su prueba en `scripts/test-isolation.mjs`.
- **Agregar una pantalla:** archivo en `src/features/<x>/`, ruta en `App.tsx`, entrada en `NAV`.
- **Forzar que los usuarios reciban una versión nueva del service worker:** sube `VERSION` en `public/sw.js`
  (normalmente no hace falta: el HTML se pide siempre a la red primero).
- **Comandos:** `npm run dev` · `npm run build` (incluye chequeo de tipos) · `npm run preview` ·
  `npm run test:unit` · `npm run test:sql` · `npm run seed` · `npm run test:isolation`.
