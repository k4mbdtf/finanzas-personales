// Flujos principales de la app, de punta a punta, contra el Supabase simulado.
import { expect, test, type Page } from '@playwright/test'
import { FakeSupabase, PASSWORD, USER, account } from './fake-supabase'

/** Hoy en Santiago (YYYY-MM-DD), como lo calcula la app. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())

async function login(page: Page, password = PASSWORD) {
  await page.goto('/')
  await expect(page).toHaveURL(/#\/ingresar/)
  await page.getByLabel('Correo').fill(USER.email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('una contraseña incorrecta muestra el error en español y no entra', async ({ page }) => {
  await new FakeSupabase().install(page)
  await login(page, 'otra-clave')
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
  await expect(page).toHaveURL(/#\/ingresar/)
})

test('ingresar, crear la primera cuenta y ver su saldo', async ({ page }) => {
  const db = new FakeSupabase()
  await db.install(page)
  await login(page)

  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible()
  await page.getByRole('link', { name: 'Crear mi primera cuenta' }).click()
  await expect(page).toHaveURL(/#\/cuentas/)

  await page.getByRole('button', { name: 'Nueva cuenta' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nueva cuenta' })
  await dialog.getByText('Efectivo', { exact: true }).click()
  await dialog.getByLabel('Nombre').fill('Billetera')
  await dialog.getByLabel('Saldo actual').fill('250000')
  await dialog.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Billetera')).toBeVisible()
  await expect(page.getByText('$250.000').first()).toBeVisible()
  expect(db.tables.accounts).toMatchObject([{ name: 'Billetera', type: 'cash', initial_balance: 250000 }])
})

test.describe('con una cuenta y la sesión guardada', () => {
  let db: FakeSupabase
  test.beforeEach(async ({ page }) => {
    db = new FakeSupabase({ accounts: [account('Cuenta RUT', 100000)] })
    await db.install(page, { signedIn: true })
  })

  test('registrar un gasto lo suma al resumen, descuenta el saldo y aparece en movimientos', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()

    await page.getByRole('button', { name: 'Nueva transacción' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nueva transacción' })
    await dialog.getByLabel('Monto').fill('12500')
    await dialog.getByRole('button', { name: 'Comida' }).click()
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText('Movimiento guardado')).toBeVisible()
    expect(db.tables.transactions).toMatchObject([
      { type: 'expense', amount: 12500, date: today(), category_id: db.categories[0].id },
    ])

    // El resumen se recarga solo: gastos del mes y saldo en cuentas.
    const kpi = (label: string) => page.locator('.card', { has: page.locator('.label-caps', { hasText: new RegExp(`^${label}$`) }) })
    await expect(kpi('Gastos')).toContainText('$12.500')
    await expect(kpi('Saldo en cuentas')).toContainText('$87.500')

    await page.goto('/#/cuentas')
    await expect(page.getByText('$87.500').first()).toBeVisible()

    await page.goto('/#/movimientos')
    await expect(page.getByText('1 movimiento')).toBeVisible()
    await expect(page.getByText('Comida')).toBeVisible()
  })

  test('el formulario no guarda un gasto sin monto ni categoría', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Nueva transacción' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nueva transacción' })
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(dialog.getByText('Ingresa un monto mayor a $0.')).toBeVisible()
    await expect(dialog.getByText('Elige una categoría.')).toBeVisible()
    expect(db.tables.transactions).toHaveLength(0)
  })

  test('la búsqueda en movimientos consulta una sola vez, al dejar de escribir', async ({ page }) => {
    await page.goto('/#/movimientos')
    await expect(page.getByText('0 movimientos')).toBeVisible()
    const searches = () => db.requests.filter((r) => r.path.startsWith('/rest/v1/transactions?') && r.params.has('note'))

    await page.getByPlaceholder('Buscar en notas').pressSequentially('almuerzo', { delay: 50 })
    await expect.poll(() => searches().length).toBe(1)
    await page.waitForTimeout(600)
    expect(searches()).toHaveLength(1)
    expect(searches()[0].params.get('note')).toBe('ilike.%almuerzo%')
  })

  test('cerrar sesión vuelve a la pantalla de ingreso', async ({ page }) => {
    await page.goto('/#/mas')
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
    await expect(page).toHaveURL(/#\/ingresar/)
    await expect(page.getByLabel('Correo')).toBeVisible()
  })
})

test('próximos pagos: muestra lo que vence y pagar la tarjeta la saca de la lista', async ({ page }) => {
  const hoy = today()
  const en5dias = new Date(Date.parse(`${hoy}T12:00:00Z`) + 5 * 86_400_000).toISOString().slice(0, 10)
  const db = new FakeSupabase({
    accounts: [
      account('Cuenta RUT', 300000, { id: 'cuenta-rut' }),
      account('Tarjeta CMR', -45000, { id: 'cmr', type: 'credit_card', payment_day: Number(hoy.slice(8)) }),
    ],
    recurring_rules: [{
      type: 'expense', amount: 25990, account_id: 'cuenta-rut', to_account_id: null, category_id: null, note: 'Internet',
      tags: [], frequency: 'monthly', interval_count: 1, start_date: en5dias, end_date: null, occurrence_count: 0,
      next_date: en5dias, active: true,
    }],
  })
  await db.install(page, { signedIn: true })
  await page.goto('/')

  const section = page.getByRole('region', { name: 'Próximos pagos' })
  await expect(section.getByText('Pagar Tarjeta CMR')).toBeVisible()
  await expect(section.getByText('Internet')).toBeVisible()
  await expect(section.getByText(/^Hoy ·/)).toBeVisible()
  await expect(section.getByText('En 5 días', { exact: false })).toBeVisible()
  await expect(section).toContainText('$70.990')

  await section.getByRole('button', { name: 'Pagar Tarjeta CMR: registrar el pago' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pagar tarjeta' })
  await expect(dialog.getByLabel('Monto')).toHaveValue('$45.000')
  await dialog.getByLabel('Desde').selectOption({ label: 'Cuenta RUT' })
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(dialog).toBeHidden()

  expect(db.tables.transactions).toMatchObject([{ type: 'transfer', amount: 45000, account_id: 'cuenta-rut', to_account_id: 'cmr' }])
  await expect(section.getByText('Pagar Tarjeta CMR')).toBeHidden()
  await expect(section).toContainText('$25.990')
})
