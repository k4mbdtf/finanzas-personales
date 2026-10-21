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

test('resumen anual: totales del año, comparación con el anterior y gasto por categoría', async ({ page }) => {
  const year = Number(today().slice(0, 4))
  const db = new FakeSupabase({ accounts: [account('Cuenta RUT', 0, { id: 'rut' })] })
  const [comida, transporte, sueldo] = db.categories.map((c) => c.id)
  const tx = (type: string, amount: number, date: string, category_id: unknown) => ({ type, amount, date, account_id: 'rut', category_id })
  db.tables.transactions.push(
    ...[
      tx('income', 1_000_000, `${year}-01-05`, sueldo), tx('expense', 300_000, `${year}-01-10`, comida),
      tx('income', 1_000_000, `${year}-02-05`, sueldo), tx('expense', 500_000, `${year}-02-10`, transporte),
      tx('expense', 200_000, `${year - 1}-01-10`, comida), tx('income', 800_000, `${year - 1}-01-05`, sueldo),
      // Después de diciembre del año anterior ya no cuenta para "a la fecha" si el año va en curso.
      tx('expense', 999_000, `${year - 1}-12-31`, transporte),
    ].map((t, i) => ({ id: `tx-${i}`, user_id: 'u', created_at: '', to_account_id: null, note: null, tags: [], ...t })),
  )
  await db.install(page, { signedIn: true })
  await page.goto('/#/anual')

  await expect(page.getByRole('heading', { name: 'Resumen anual' })).toBeVisible()
  const kpi = (label: RegExp) => page.locator('.card', { has: page.locator('.label-caps', { hasText: label }) })
  await expect(kpi(/^Ingresos$/)).toContainText('$2.000.000')
  await expect(kpi(/^Gastos$/)).toContainText('$800.000')
  await expect(kpi(/^Ahorro · 60%$/)).toContainText('$1.200.000')
  await expect(kpi(/^Gasto promedio al mes$/)).toContainText('$400.000')
  // Año en curso: compara con el mismo período del año anterior (enero hasta este mes).
  const month = new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, Number(today().slice(5, 7)) - 1, 1))).replace('.', '')
  await expect(kpi(/^Gastos$/)).toContainText(`vs ene–${month} ${year - 1}`)

  const rows = page.getByRole('table', { name: /Gasto por categoría/ }).getByRole('row')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(1)).toContainText('Transporte')
  await expect(rows.nth(1)).toContainText('Nueva')
  await expect(rows.nth(2)).toContainText('Comida')
  await expect(rows.nth(2)).toContainText('+$100.000')

  await page.getByRole('button', { name: `Año anterior: ${year - 1}` }).click()
  await expect(kpi(/^Gastos$/)).toContainText('$1.199.000')
  await expect(kpi(/^Gastos$/)).toContainText(`Sin datos de ${year - 2}`)
})

test.describe('reglas de categorización', () => {
  test('crear una regla y aplicarla a los movimientos sin categoría', async ({ page }) => {
    const db = new FakeSupabase({
      accounts: [account('Cuenta RUT', 100000, { id: 'rut' })],
      transactions: [
        { type: 'expense', amount: 8500, date: today(), account_id: 'rut', category_id: null, note: 'PAGO UBER *TRIP 8812' },
        { type: 'expense', amount: 3000, date: today(), account_id: 'rut', category_id: null, note: 'Kiosko' },
      ],
    })
    const transporte = db.categories[1]
    await db.install(page, { signedIn: true })
    await page.goto('/#/categorias')

    const section = page.getByRole('region', { name: 'Reglas automáticas' })
    await section.getByLabel('Si la descripción contiene').fill('Uber')
    await section.getByLabel('Usar la categoría').selectOption({ label: 'Transporte' })
    await section.getByRole('button', { name: 'Agregar regla' }).click()
    await expect(section.getByRole('list', { name: 'Reglas' })).toContainText('«Uber»')
    expect(db.tables.category_rules).toMatchObject([{ pattern: 'Uber', category_id: transporte.id }])

    await section.getByRole('button', { name: 'Aplicar a movimientos sin categoría' }).click()
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: 'Aplicar reglas' }))
    await expect(dialog).toContainText('1 movimiento sin categoría calza')
    await dialog.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Se categorizaron 1 movimiento')).toBeVisible()
    expect(db.tables.transactions.map((t) => t.category_id)).toEqual([transporte.id, null])
  })

  test('al importar una cartola, la regla elige la categoría', async ({ page }) => {
    const db = new FakeSupabase({ accounts: [account('Cuenta RUT', 100000, { id: 'rut' })] })
    db.tables.category_rules = [{ id: 'r1', user_id: 'u', pattern: 'uber', category_id: db.categories[1].id, created_at: '' }]
    await db.install(page, { signedIn: true })
    await page.goto('/#/importar')

    const csv = 'Fecha;Descripción;Monto\n15/10/2026;PAGO UBER TRIP 123;-8.500\n16/10/2026;JUMBO LAS CONDES;-45.000\n'
    await page.locator('input[type=file]').setInputFiles({ name: 'cartola.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.getByRole('button', { name: 'Revisar movimientos' }).click()
    await expect(page.getByLabel('Categoría de la fila 2')).toHaveValue(db.categories[1].id as string)
    await expect(page.getByLabel('Categoría de la fila 3')).toHaveValue('')
  })

  test('sin la migración 0007, la sección avisa qué hacer y el resto funciona', async ({ page }) => {
    const db = new FakeSupabase({ accounts: [account('Cuenta RUT', 100000)] })
    db.missing.add('category_rules')
    await db.install(page, { signedIn: true })
    await page.goto('/#/categorias')
    await expect(page.getByText('0007_reglas.sql')).toBeVisible()
    await expect(page.getByRole('button', { name: /Comida/ })).toBeVisible()
  })
})

test.describe('dividir movimientos', () => {
  let db: FakeSupabase
  test.beforeEach(async ({ page }) => {
    db = new FakeSupabase({ accounts: [account('Cuenta RUT', 100000, { id: 'rut' })] })
    await db.install(page, { signedIn: true })
  })

  test('dividir un gasto en dos categorías, editarlo y quitar la división', async ({ page }) => {
    const [comida, transporte] = db.categories.map((c) => c.id)
    await page.goto('/#/movimientos')
    await page.getByRole('button', { name: 'Nueva transacción' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nueva transacción' })
    await dialog.getByLabel('Monto').fill('50000')
    await dialog.getByRole('button', { name: 'Dividir en varias categorías' }).click()
    await expect(dialog.getByText('Falta repartir $50.000')).toBeVisible()
    await dialog.getByLabel('Categoría de la parte 1').selectOption({ label: 'Comida' })
    await dialog.getByLabel('Monto de la parte 1').fill('30000')
    await dialog.getByLabel('Categoría de la parte 2').selectOption({ label: 'Transporte' })
    await dialog.getByLabel('Monto de la parte 2').fill('25000')
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(dialog.getByText('Las partes deben sumar el total.')).toBeVisible()
    await expect(dialog.getByText('Sobran $5.000')).toBeVisible()
    await dialog.getByLabel('Monto de la parte 2').fill('20000')
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(dialog).toBeHidden()

    expect(db.tables.transactions).toHaveLength(2)
    expect(db.tables.transactions).toMatchObject([
      { type: 'expense', amount: 30000, category_id: comida, split_group: expect.any(String) },
      { type: 'expense', amount: 20000, category_id: transporte, split_group: db.tables.transactions[0].split_group },
    ])
    await expect(page.getByText('2 movimientos')).toBeVisible()
    await expect(page.getByText('(dividido)')).toHaveCount(2)

    // Editar desde la segunda parte: se abre el movimiento completo.
    await page.getByRole('button', { name: /Transporte/ }).click()
    const edit = page.getByRole('dialog', { name: 'Editar movimiento' })
    await expect(edit.getByLabel('Monto total')).toHaveValue('$50.000')
    await expect(edit.getByLabel('Monto de la parte 1')).toHaveValue('$30.000')
    await edit.getByRole('button', { name: 'Quitar la división (una sola categoría)' }).click()
    await edit.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(edit).toBeHidden()
    expect(db.tables.transactions).toMatchObject([{ amount: 50000, category_id: comida, split_group: null }])
    await expect(page.getByText('1 movimiento')).toBeVisible()
  })

  test('eliminar un movimiento dividido elimina todas sus partes', async ({ page }) => {
    const [comida, transporte] = db.categories.map((c) => c.id)
    const part = { type: 'expense', date: today(), account_id: 'rut', note: 'Súper', split_group: 'g1' }
    db.tables.transactions.push(
      { id: 'p1', user_id: 'u', created_at: '1', to_account_id: null, tags: [], ...part, amount: 7000, category_id: comida },
      { id: 'p2', user_id: 'u', created_at: '2', to_account_id: null, tags: [], ...part, amount: 3000, category_id: transporte },
    )
    await page.goto('/#/movimientos')
    await page.getByRole('button', { name: /Comida/ }).click()
    await page.getByRole('button', { name: 'Eliminar movimiento' }).click()
    await expect(page.getByText('dividido en 2 categorías')).toBeVisible()
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(page.getByText('0 movimientos')).toBeVisible()
    expect(db.tables.transactions).toHaveLength(0)
  })
})

test('sin la migración 0008 no se ofrece dividir', async ({ page }) => {
  const db = new FakeSupabase({ accounts: [account('Cuenta RUT', 100000)] })
  db.missingColumns.add('split_group')
  await db.install(page, { signedIn: true })
  await page.goto('/')
  await page.getByRole('button', { name: 'Nueva transacción' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nueva transacción' })
  await expect(dialog.getByRole('button', { name: 'Comida' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Dividir en varias categorías' })).toHaveCount(0)
})

test.describe('UF y dólares', () => {
  const profile = (on: boolean) => [{ user_id: USER.id, multi_currency: on }]

  test('se activa en Ajustes; apagada, no se elige moneda al crear una cuenta', async ({ page }) => {
    const db = new FakeSupabase({ profiles: profile(false), accounts: [account('Cuenta RUT', 100000)] })
    await db.install(page, { signedIn: true })
    await page.goto('/#/cuentas')
    await page.getByRole('button', { name: 'Nueva cuenta' }).first().click()
    await page.getByRole('dialog').getByText('Efectivo', { exact: true }).click()
    await expect(page.getByRole('dialog').getByText('Moneda de la cuenta')).toHaveCount(0)

    await page.goto('/#/ajustes')
    await page.getByLabel('Usar UF y dólares').check()
    await expect(page.getByText('Ahora puedes crear cuentas en UF y dólares')).toBeVisible()
    expect(db.tables.profiles[0].multi_currency).toBe(true)
  })

  test('crear una cuenta en dólares: saldo en USD y en pesos al valor de hoy', async ({ page }) => {
    const db = new FakeSupabase({ profiles: profile(true), accounts: [account('Cuenta RUT', 100000)] })
    await db.install(page, { signedIn: true })
    await page.goto('/#/cuentas')
    await page.getByRole('button', { name: 'Nueva cuenta' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nueva cuenta' })
    await dialog.getByText('Efectivo', { exact: true }).click()
    await dialog.getByText('Dólares', { exact: true }).click()
    await dialog.getByLabel('Nombre').fill('Dólares en efectivo')
    await dialog.getByLabel('Saldo actual (US$)').fill('1.000')
    await expect(dialog.getByText('1 USD = $950')).toBeVisible()
    await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(dialog).toBeHidden()

    expect(db.tables.accounts[1]).toMatchObject({ currency: 'USD', initial_balance: 950000, initial_balance_native: 1000 })
    const card = page.getByRole('button', { name: /Dólares en efectivo/ })
    await expect(card).toContainText('US$1.000,00')
    await expect(card).toContainText('≈ $950.000')
    // Total en pesos de hoy: 100.000 + 950.000.
    await expect(page.getByText('$1.050.000').first()).toBeVisible()

    await page.getByText('Dólares', { exact: true }).click()
    await expect(page.getByText('US$1.105,26').first()).toBeVisible()
  })

  test.describe('movimientos', () => {
    let db: FakeSupabase
    test.beforeEach(async ({ page }) => {
      db = new FakeSupabase({
        profiles: profile(true),
        accounts: [
          account('Cuenta RUT', 100000, { id: 'rut' }),
          account('Cuenta USD', 950000, { id: 'usd', currency: 'USD', initial_balance_native: 1000 }),
        ],
      })
      await db.install(page, { signedIn: true })
    })

    test('un gasto en dólares se guarda en USD y en pesos del día', async ({ page }) => {
      await page.goto('/#/movimientos')
      await page.getByRole('button', { name: 'Nueva transacción' }).first().click()
      const dialog = page.getByRole('dialog', { name: 'Nueva transacción' })
      await dialog.getByLabel('Cuenta').selectOption({ label: 'Cuenta USD' })
      await dialog.getByLabel('Monto (US$)').fill('20,5')
      await expect(dialog.getByText('≈ $19.475')).toBeVisible()
      await dialog.getByRole('button', { name: 'Comida' }).click()
      await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(dialog).toBeHidden()

      expect(db.tables.transactions).toMatchObject([{ type: 'expense', account_id: 'usd', amount: 19475, amount_native: 20.5 }])
      await expect(page.getByText('−US$20,50')).toBeVisible()
      await page.goto('/#/cuentas')
      await expect(page.getByRole('button', { name: /Cuenta USD/ })).toContainText('US$979,50')
    })

    test('vender dólares: sale en USD y llega lo que dice el banco en pesos', async ({ page }) => {
      await page.goto('/#/movimientos')
      await page.getByRole('button', { name: 'Nueva transacción' }).first().click()
      const dialog = page.getByRole('dialog', { name: 'Nueva transacción' })
      await expect(dialog).toBeVisible()
      await dialog.getByText('Transferencia', { exact: true }).click()
      await dialog.getByLabel('Desde').selectOption({ label: 'Cuenta USD' })
      await dialog.getByLabel('Hacia').selectOption({ label: 'Cuenta RUT' })
      await dialog.getByLabel('Monto que sale (US$)').fill('100')
      await expect(dialog.getByLabel('Llega a Cuenta RUT')).toHaveValue('$95.000')
      await dialog.getByLabel('Llega a Cuenta RUT').fill('93000')
      await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(dialog).toBeHidden()
      expect(db.tables.transactions).toMatchObject([
        { type: 'transfer', account_id: 'usd', to_account_id: 'rut', amount: 93000, amount_native: 100 },
      ])
      expect(db.tables.transactions[0].to_amount_native).toBeUndefined()
    })

    test('sin el valor del día se escribe a mano y queda guardado', async ({ page }) => {
      db.indicators = 'fail'
      await page.goto('/#/movimientos')
      await page.getByRole('button', { name: 'Nueva transacción' }).first().click()
      const dialog = page.getByRole('dialog', { name: 'Nueva transacción' })
      await dialog.getByLabel('Cuenta').selectOption({ label: 'Cuenta USD' })
      await dialog.getByLabel('Monto (US$)').fill('20,5')
      await dialog.getByRole('button', { name: 'Comida' }).click()
      await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(dialog.getByText(/Ingresa el valor de 1 USD/).first()).toBeVisible()
      await dialog.getByLabel(/Valor de 1 USD el/).fill('1000')
      await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(dialog).toBeHidden()
      expect(db.tables.transactions).toMatchObject([{ amount: 20500, amount_native: 20.5 }])
      await expect.poll(() => db.tables.exchange_rates?.length ?? 0).toBe(1)
      expect(db.tables.exchange_rates[0]).toMatchObject({ currency: 'USD', clp: 1000 })
    })
  })
})

test.describe('deudas en UF', () => {
  test('crédito en UF con el dinero que llegó, y pagar la cuota en pesos', async ({ page }) => {
    const db = new FakeSupabase({
      profiles: [{ user_id: USER.id, multi_currency: true }],
      accounts: [account('Cuenta RUT', 100000, { id: 'rut' })],
    })
    await db.install(page, { signedIn: true })
    await page.goto('/#/deudas')
    await page.getByRole('button', { name: 'Nueva deuda' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Nombre').fill('Hipotecario')
    await dialog.getByText('UF', { exact: true }).click()
    await dialog.getByLabel('Valor de la cuota (UF)').fill('15,25')
    await dialog.getByLabel('Total de cuotas').fill('240')
    await dialog.getByLabel('¿Cuántas cuotas ya pagaste?').fill('40')
    await expect(dialog.getByText('UF 3.050,00')).toBeVisible()
    await dialog.getByText('¿El dinero llegó a una de tus cuentas?').click()
    await dialog.getByLabel('Cuenta donde llegó').selectOption({ label: 'Cuenta RUT' })
    // 3.050 UF × $39.500 = $120.475.000, precompletado en pesos.
    await expect(dialog.getByLabel('Monto recibido (pesos)')).toHaveValue('$120.475.000')
    await dialog.getByRole('button', { name: 'Guardar deuda' }).click()
    await expect(dialog).toBeHidden()

    expect(db.tables.accounts[1]).toMatchObject({
      name: 'Hipotecario', type: 'loan', currency: 'UF', initial_balance: 0, initial_balance_native: 0, loan_installment: 15.25,
    })
    expect(db.tables.transactions).toMatchObject([
      { type: 'transfer', account_id: db.tables.accounts[1].id, to_account_id: 'rut', amount: 120475000, amount_native: 3050 },
    ])
    const loan = page.getByRole('listitem').filter({ hasText: 'Hipotecario' })
    await expect(loan).toContainText('UF 3.050,00')
    await expect(loan).toContainText('Cuota 40 de 240')

    await loan.getByRole('button', { name: 'Pagar' }).click()
    const pay = page.getByRole('dialog', { name: 'Registrar pago' })
    await expect(pay.getByLabel('Llega a Hipotecario (UF)')).toHaveValue('15,25')
    await expect(pay.getByLabel('Monto que sale')).toHaveValue('$602.375')
    await pay.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(pay).toBeHidden()
    expect(db.tables.transactions[1]).toMatchObject({ type: 'transfer', account_id: 'rut', amount: 602375, to_amount_native: 15.25 })
    await expect(loan).toContainText('UF 3.034,75')
  })

  test('patrimonio: trae el valor de fin de cada mes de las monedas en uso', async ({ page }) => {
    const db = new FakeSupabase({
      profiles: [{ user_id: USER.id, multi_currency: true }],
      accounts: [account('Hipotecario', -3950000, { type: 'loan', currency: 'UF', initial_balance_native: -100 })],
    })
    await db.install(page, { signedIn: true })
    await page.goto('/#/patrimonio')
    await expect.poll(() => (db.tables.exchange_rates ?? []).filter((r) => r.currency === 'UF').length).toBeGreaterThanOrEqual(12)
    // Y recién después consulta el patrimonio.
    await expect.poll(() => db.requests.some((r) => r.path.startsWith('/rest/v1/rpc/net_worth_by_month'))).toBe(true)
  })
})
