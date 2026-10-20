// Crea 3 usuarios de prueba con datos DISTINTOS (vía RLS, como lo haría la app).
// Uso: npm run seed
import { TEST_USERS, ensureUser, clientFor } from './lib.mjs'

const today = new Date()
const iso = (daysAgo) => {
  const d = new Date(today)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
const month0 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)

// Cada usuario tiene cuentas y montos distintos para detectar fugas fácilmente.
const PLANS = {
  'ana.test@example.com': {
    accounts: [
      { name: 'Efectivo Ana', type: 'cash', initial_balance: 50000 },
      { name: 'Cuenta RUT Ana', type: 'bank', initial_balance: 1200000, institution: 'bancoestado' },
    ],
    tx: [
      ['income', 1500000, 'Sueldo', 1, 'Sueldo octubre'],
      ['expense', 85000, 'Alimentación', 1, 'Supermercado'],
      ['expense', 12500, 'Transporte', 0, 'Bip!'],
    ],
    budget: ['Alimentación', 200000],
  },
  'bruno.test@example.com': {
    accounts: [
      { name: 'Banco Bruno', type: 'bank', initial_balance: 300000 },
      { name: 'Ahorro Bruno', type: 'savings', initial_balance: 5000000 },
      { name: 'Visa Bruno', type: 'credit_card', initial_balance: 0, credit_limit: 1500000, closing_day: 20, payment_day: 5 },
    ],
    tx: [
      ['income', 900000, 'Honorarios', 1, 'Proyecto web'],
      ['expense', 450000, 'Vivienda', 1, 'Arriendo'],
      ['expense', 9990, 'Suscripciones', 0, 'Streaming'],
    ],
    budget: ['Vivienda', 500000],
  },
  'carla.test@example.com': {
    accounts: [{ name: 'Cuenta Carla', type: 'bank', initial_balance: 80000 }],
    tx: [
      ['income', 2200000, 'Sueldo', 1, 'Sueldo'],
      ['expense', 33000, 'Ocio', 0, 'Cine'],
    ],
    budget: ['Ocio', 60000],
  },
}

for (const { email } of TEST_USERS) {
  await ensureUser(email)
  const { client, userId } = await clientFor(email)
  const plan = PLANS[email]

  const { data: cats } = await client.from('categories').select('id,name')
  const catId = (n) => cats.find((c) => c.name === n)?.id

  // Evita duplicar si se ejecuta el seed dos veces.
  const { count } = await client.from('accounts').select('*', { count: 'exact', head: true })
  if (count > 0) { console.log(`↺ ${email} ya tiene datos, se omite`); continue }

  const { data: accs, error: e1 } = await client.from('accounts').insert(plan.accounts).select()
  if (e1) throw e1

  const rows = plan.tx.map(([type, amount, cat, daysAgo, note]) => ({
    type, amount, category_id: catId(cat), account_id: accs[0].id, date: iso(daysAgo), note,
  }))
  // Una transferencia entre cuentas propias (no cuenta como ingreso/gasto).
  if (accs.length > 1) {
    rows.push({ type: 'transfer', amount: 20000, account_id: accs[0].id, to_account_id: accs[1].id, date: iso(2), note: 'Traspaso' })
  }
  const { error: e2 } = await client.from('transactions').insert(rows)
  if (e2) throw e2

  const { error: e3 } = await client.from('budgets').insert({
    category_id: catId(plan.budget[0]), month: month0, amount: plan.budget[1],
  })
  if (e3) throw e3

  await seedStage2(client, email, accs, catId)

  console.log(`✔ ${email} (${userId}): ${accs.length} cuentas, ${rows.length} transacciones + datos de la Etapa 2`)
}

/** Datos de la Etapa 2 (migración 0005), distintos por usuario. */
async function seedStage2(client, email, accs, catId) {
  const ok = (res, what) => { if (res.error) throw new Error(`${what}: ${res.error.message}`); return res.data }

  if (email.startsWith('ana')) {
    ok(await client.from('accounts').insert({
      name: 'Crédito consumo Ana', type: 'loan', initial_balance: -500000, loan_amount: 1000000,
      loan_installment: 50000, loan_installments_count: 24, payment_day: 10, counterparty: 'Banco Ana',
    }), 'préstamo')
    const goal = ok(await client.from('goals').insert({ name: 'Vacaciones Ana', target_amount: 600000 }).select().single(), 'meta')
    ok(await client.from('goal_contributions').insert({ goal_id: goal.id, amount: 100000 }), 'abono')
    ok(await client.from('recurring_rules').insert({
      type: 'income', amount: 1500000, account_id: accs[1].id, category_id: catId('Sueldo'),
      note: 'Sueldo mensual', frequency: 'monthly', start_date: iso(40),
    }), 'recurrente')
    ok(await client.rpc('materialize_recurring', {}), 'materialize')
    ok(await client.rpc('import_transactions', {
      p_account_id: accs[1].id, p_filename: 'cartola-ana.csv',
      p_rows: [
        { type: 'expense', amount: 4500, date: iso(3), note: 'CAFETERIA', import_hash: 'seed-ana-1' },
        { type: 'expense', amount: 23990, date: iso(4), note: 'FARMACIA', import_hash: 'seed-ana-2' },
      ],
    }), 'importación')
  }

  if (email.startsWith('bruno')) {
    const card = accs.find((a) => a.type === 'credit_card')
    ok(await client.rpc('create_installment_plan', {
      p_description: 'Televisor Bruno', p_account_id: card.id, p_category_id: catId('Ocio'),
      p_total_amount: 300000, p_installments_count: 6, p_first_date: iso(10), p_installment_amount: null,
    }), 'cuotas')
    const savings = accs.find((a) => a.type === 'savings')
    ok(await client.from('goals').insert({ name: 'Auto Bruno', target_amount: 8000000, account_id: savings.id }), 'meta')
    // Inversión (0006): aporte desde el ahorro y su valor actual.
    ok(await client.rpc('create_tracked_account', {
      p_account: { type: 'investment', name: 'Fondo Bruno', investment_kind: 'fund', counterparty: 'Fintual' },
      p_cash_account: savings.id, p_cash_amount: 200000, p_date: iso(30), p_value: 200000,
    }), 'inversión')
  }

  if (email.startsWith('carla')) {
    ok(await client.from('accounts').insert({
      name: 'Pedro me debe', type: 'receivable', initial_balance: 50000, counterparty: 'Pedro',
    }), 'me deben')
    ok(await client.from('recurring_rules').insert({
      type: 'expense', amount: 9990, account_id: accs[0].id, category_id: catId('Suscripciones'),
      note: 'Streaming Carla', frequency: 'monthly', start_date: iso(0),
    }), 'recurrente')
  }
}
console.log('\nContraseña de todos los usuarios de prueba: ver PASSWORD en scripts/lib.mjs')
