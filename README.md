# 💰 Mis Finanzas

Aplicación web de finanzas personales multiusuario. Cada usuario ve **solo sus propios datos**.
Español (Chile), montos en CLP sin decimales (`$12.500`), zona horaria `America/Santiago`, mobile-first.

**Stack:** React + Vite + TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth, sin servidor propio) · hosting estático (GitHub Pages o Vercel).

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Modelo de datos, RLS, autenticación | ✅ |
| 2 | Cuentas y transacciones | ⏳ |
| 3 | Categorías y presupuestos | ⏳ |
| 4 | Dashboard y gráficos | ⏳ |
| 5 | PWA, exportación, despliegue y keep-alive | ⏳ |

---

## Estructura del proyecto

```
supabase/migrations/0001_schema.sql   Esquema completo: tablas, índices, constraints, RLS, triggers
scripts/
  lib.mjs                Utilidades (cliente admin y por usuario) — SOLO local
  seed.mjs               Crea 3 usuarios de prueba con datos distintos
  test-isolation.mjs     Pruebas automáticas de aislamiento entre usuarios
src/
  lib/supabase.ts        Cliente Supabase (anon key, flujo PKCE)
  lib/format.ts          Formato CLP y fechas en America/Santiago
  lib/errors.ts          Mensajes de error en español
  auth/AuthProvider.tsx  Sesión global + detección de recuperación de contraseña
  components/            UI base, Turnstile, formulario de contraseña, AppShell
  pages/auth/            Login, registro, olvidé mi contraseña, restablecer
  pages/                 Inicio, Ajustes (cambio de contraseña, eliminar cuenta), Privacidad
```

## Modelo de datos

```
auth.users (Supabase)
  └─ profiles      1:1  configuración (moneda CLP, zona horaria)
  └─ accounts      cash | bank | savings | credit_card (+ cupo, día de cierre, día de pago)
  └─ categories    income | expense, color, ícono (15 por defecto al registrarse)
  └─ transactions  income | expense | transfer
  │     account_id    → accounts     (FK compuesta con user_id)
  │     to_account_id → accounts     (solo transfer, FK compuesta)
  │     category_id   → categories   (FK compuesta; el tipo debe coincidir)
  │     tags text[]
  └─ budgets       presupuesto mensual por categoría (month = 1er día del mes)
view account_balances   saldo por cuenta (security_invoker, respeta RLS)
```

Decisiones clave:

- **Montos `bigint`** en pesos enteros, siempre positivos; el signo lo da `type`.
- **Transferencias** son un tipo propio: los reportes de ingresos/gastos filtran
  `type in ('income','expense')`, así que nunca cuentan como gasto ni ingreso.
- **FKs compuestas `(id, user_id)`**: aunque alguien conozca el UUID de la cuenta de otro usuario,
  la base de datos rechaza la referencia. Esto se suma a RLS (defensa en profundidad).
- **Etiquetas** como `text[]` con índice GIN: simple y suficiente para filtrar.
- **Etapa 2** (metas, recurrentes, cuotas, importación de cartolas, patrimonio): se agregarán como
  nuevas migraciones `0002_...sql` siguiendo el mismo patrón (`user_id default auth.uid()`, RLS de
  4 políticas, FKs compuestas). Para la importación con detección de duplicados se agregará una columna
  `import_hash` con índice único parcial en `transactions`.

## Seguridad

- RLS activado en todas las tablas, con políticas `SELECT/INSERT/UPDATE/DELETE` solo donde
  `user_id = auth.uid()`. `anon` no tiene ningún privilegio sobre las tablas.
- Al registrarse, el trigger `on_auth_user_created` crea el perfil y las categorías por defecto.
- `delete_my_account()` (RPC) borra el usuario actual; todo lo demás se elimina en cascada.
- El frontend solo usa la **anon key**. La **service_role** solo se usa en `scripts/` en tu equipo
  y está en `scripts/.env.scripts` (ignorado por git). **Nunca** la pongas en variables `VITE_*`.

---

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project** (región recomendada: `South America (São Paulo)`).
2. Ve a **SQL Editor** → **New query**, pega todo el contenido de
   `supabase/migrations/0001_schema.sql` y ejecútalo.
3. En **Project Settings → API** copia la **Project URL**, la **anon public key** y la
   **service_role key** (esta última solo para scripts locales).

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

### 5. Datos de prueba y pruebas de aislamiento

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
- [ ] Sin sesión (`anon`) no se lee ninguna tabla ni se puede llamar a `delete_my_account`.
- [ ] El registro crea perfil y categorías por defecto; `delete_my_account` borra todos los datos del usuario sin afectar a los demás.

La contraseña de los usuarios de prueba está en `scripts/lib.mjs`.

### 6. Desplegar

*(Se completa en la Fase 5: workflow de GitHub Pages con `VITE_BASE=/finanzas-personales/`
y workflow keep-alive cada 3 días.)*

La app usa **HashRouter** (`/#/ajustes`), por lo que funciona en GitHub Pages sin `404.html`.
Los enlaces de los correos usan el flujo **PKCE** (`?code=` en la query), compatible con el hash.
Nota: el enlace del correo de recuperación debe abrirse en el mismo navegador donde se solicitó.
