// Pruebas de aislamiento entre usuarios (RLS + FKs compuestas).
// Uso: npm run seed && npm run test:isolation
// Cada prueba intenta un ataque como Ana contra datos de Bruno y espera que falle.
import { clientFor, admin, ensureUser, deleteUserByEmail, TEST_USERS } from './lib.mjs'

let failed = 0
const ok = (name) => console.log(`  ✔ ${name}`)
const bad = (name, detail = '') => { failed++; console.log(`  ✘ ${name} ${detail}`) }
const check = (cond, name, detail) => (cond ? ok(name) : bad(name, detail))

const [ana, bruno, carla] = await Promise.all(TEST_USERS.map((u) => clientFor(u.email)))
const A = ana.client, B = bruno.client

// IDs reales de Bruno (obtenidos con SU sesión) que Ana intentará usar.
const bAcc = (await B.from('accounts').select('id').limit(1)).data[0].id
const bCat = (await B.from('categories').select('id').eq('kind', 'expense').limit(1)).data[0].id
const bTx = (await B.from('transactions').select('id,amount').limit(1)).data[0]
const bBudget = (await B.from('budgets').select('id').limit(1)).data[0].id
const aAcc = (await A.from('accounts').select('id').limit(1)).data[0].id
const aCat = (await A.from('categories').select('id').eq('kind', 'expense').limit(1)).data[0].id

console.log('\n1. Lectura')
for (const t of ['accounts', 'categories', 'transactions', 'budgets', 'profiles']) {
  const { data } = await A.from(t).select('*')
  check(data.length > 0 && data.every((r) => r.user_id === ana.userId), `Ana solo ve sus filas de ${t} (${data.length})`)
}
const { data: bal } = await A.from('account_balances').select('*')
check(bal.every((r) => r.user_id === ana.userId), 'La vista account_balances solo muestra saldos de Ana')

console.log('\n2. Acceso directo por ID ajeno')
for (const [t, id] of [['accounts', bAcc], ['categories', bCat], ['transactions', bTx.id], ['budgets', bBudget]]) {
  const { data } = await A.from(t).select('*').eq('id', id)
  check(data.length === 0, `SELECT de ${t} ajeno por id devuelve 0 filas`)
}

console.log('\n3. Modificar / borrar filas ajenas (RLS filtra: 0 filas afectadas)')
{
  const { data } = await A.from('transactions').update({ amount: 1 }).eq('id', bTx.id).select()
  check(data.length === 0, 'UPDATE de transacción ajena afecta 0 filas')
  const { data: d2 } = await A.from('transactions').delete().eq('id', bTx.id).select()
  check(d2.length === 0, 'DELETE de transacción ajena afecta 0 filas')
  const { data: d3 } = await A.from('accounts').update({ name: 'HACK' }).eq('id', bAcc).select()
  check(d3.length === 0, 'UPDATE de cuenta ajena afecta 0 filas')
  const { data: d4 } = await A.from('budgets').delete().eq('id', bBudget).select()
  check(d4.length === 0, 'DELETE de presupuesto ajeno afecta 0 filas')
  const { data: still } = await B.from('transactions').select('amount').eq('id', bTx.id)
  check(still[0]?.amount === bTx.amount, 'La transacción de Bruno quedó intacta')
}

console.log('\n4. Insertar haciéndose pasar por otro usuario')
{
  const { error } = await A.from('accounts').insert({ user_id: bruno.userId, name: 'X', type: 'cash' })
  check(!!error, 'INSERT con user_id de Bruno es rechazado', error?.message)
  const { error: e2 } = await A.from('accounts').update({ user_id: bruno.userId }).eq('id', aAcc)
  check(!!e2, 'UPDATE que cambia user_id a Bruno es rechazado', e2?.message)
}

console.log('\n5. Referencias cruzadas (FK compuestas)')
{
  const base = { type: 'expense', amount: 1000 }
  let r = await A.from('transactions').insert({ ...base, account_id: bAcc, category_id: aCat })
  check(!!r.error, 'No se puede crear transacción en la CUENTA de Bruno', r.error?.message)
  r = await A.from('transactions').insert({ ...base, account_id: aAcc, category_id: bCat })
  check(!!r.error, 'No se puede usar la CATEGORÍA de Bruno', r.error?.message)
  r = await A.from('transactions').insert({ type: 'transfer', amount: 1000, account_id: aAcc, to_account_id: bAcc })
  check(!!r.error, 'No se puede transferir HACIA una cuenta de Bruno', r.error?.message)
  r = await A.from('budgets').insert({ category_id: bCat, month: '2030-01-01', amount: 1000 })
  check(!!r.error, 'No se puede crear presupuesto sobre categoría de Bruno', r.error?.message)
  const { data: mine } = await A.from('transactions').insert({ ...base, account_id: aAcc, category_id: aCat }).select().single()
  r = await A.from('transactions').update({ account_id: bAcc }).eq('id', mine.id)
  check(!!r.error, 'No se puede MOVER una transacción propia a cuenta de Bruno', r.error?.message)
  await A.from('transactions').delete().eq('id', mine.id)
}

console.log('\n6. Integridad de datos')
{
  const r1 = await A.from('transactions').insert({ type: 'income', amount: 1000, account_id: aAcc, category_id: aCat })
  check(!!r1.error, 'Categoría de gasto no se acepta en un ingreso', r1.error?.message)
  const r2 = await A.from('transactions').insert({ type: 'expense', amount: 0, account_id: aAcc, category_id: aCat })
  check(!!r2.error, 'Monto 0 rechazado', r2.error?.message)
  const r3 = await A.from('transactions').insert({ type: 'transfer', amount: 5, account_id: aAcc, to_account_id: aAcc })
  check(!!r3.error, 'Transferencia a la misma cuenta rechazada', r3.error?.message)
  const r4 = await A.from('accounts').insert({ name: 'Mala', type: 'cash', credit_limit: 100 })
  check(!!r4.error, 'Cupo en cuenta que no es tarjeta rechazado', r4.error?.message)
}

console.log('\n7. Sin sesión (anon)')
{
  const { createClient } = await import('@supabase/supabase-js')
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  for (const t of ['accounts', 'transactions', 'categories', 'budgets', 'profiles']) {
    const { data, error } = await anon.from(t).select('*')
    check(!!error || data.length === 0, `anon no lee ${t}`, error?.message)
  }
  const { error } = await anon.rpc('delete_my_account')
  check(!!error, 'anon no puede ejecutar delete_my_account', error?.message)
  const { data: ka, error: eKa } = await anon.rpc('keepalive')
  check(!eKa && ka === 'ok', 'anon puede llamar a keepalive y solo recibe "ok"', eKa?.message)
}

console.log('\n7b. Fase 3: categorías, presupuestos y RPC de gasto')
{
  const range = { p_from: '2000-01-01', p_to: '2100-12-31' }
  const { data: sp, error } = await A.rpc('spending_by_category', range)
  check(!error, 'Ana puede llamar a spending_by_category', error?.message)
  const anaCatIds = new Set((await A.from('categories').select('id')).data.map((c) => c.id))
  check(sp.every((r) => r.category_id === null || anaCatIds.has(r.category_id)), 'spending_by_category solo devuelve categorías de Ana')
  const { data: anaExp } = await A.from('transactions').select('amount').eq('type', 'expense')
  const expected = anaExp.reduce((s, t) => s + Number(t.amount), 0)
  const got = sp.reduce((s, r) => s + Number(r.total), 0)
  check(got === expected, `El gasto total del RPC coincide con los gastos de Ana (${got} = ${expected})`)

  const { error: eAnon } = await (await import('@supabase/supabase-js'))
    .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    .rpc('spending_by_category', range)
  check(!!eAnon, 'anon no puede llamar a spending_by_category', eAnon?.message)

  const incomeCat = (await A.from('categories').select('id').eq('kind', 'income').limit(1)).data[0].id
  const r1 = await A.from('budgets').insert({ category_id: incomeCat, month: '2030-02-01', amount: 1000 })
  check(!!r1.error, 'No se puede presupuestar una categoría de ingreso', r1.error?.message)

  const r2 = await A.from('budgets').upsert(
    { category_id: bCat, month: '2030-03-01', amount: 1000 }, { onConflict: 'user_id,category_id,month' })
  check(!!r2.error, 'UPSERT de presupuesto sobre categoría de Bruno es rechazado', r2.error?.message)

  const usedCat = (await A.from('transactions').select('category_id').eq('type', 'expense').not('category_id', 'is', null).limit(1)).data[0].category_id
  const r3 = await A.from('categories').update({ kind: 'income' }).eq('id', usedCat)
  check(!!r3.error, 'No se puede cambiar el tipo de una categoría con movimientos', r3.error?.message)

  const r4 = await A.from('categories').update({ name: 'HACK' }).eq('id', bCat).select()
  check(r4.data?.length === 0, 'UPDATE de categoría de Bruno afecta 0 filas')
  const r5 = await A.from('categories').delete().eq('id', bCat).select()
  check(r5.data?.length === 0, 'DELETE de categoría de Bruno afecta 0 filas')
}

console.log('\n7c. Fase 4: RPC monthly_totals')
{
  const range = { p_from: '2000-01-01', p_to: '2100-12-31' }
  const { data: mt, error } = await A.rpc('monthly_totals', range)
  check(!error, 'Ana puede llamar a monthly_totals', error?.message)
  const { data: anaTx } = await A.from('transactions').select('type, amount')
  const sum = (t) => anaTx.filter((x) => x.type === t).reduce((s, x) => s + Number(x.amount), 0)
  const inc = mt.reduce((s, r) => s + Number(r.income), 0)
  const exp = mt.reduce((s, r) => s + Number(r.expense), 0)
  check(inc === sum('income') && exp === sum('expense'),
    `monthly_totals coincide con los datos de Ana y excluye transferencias (${inc}/${exp})`)
  const { data: mtB } = await B.rpc('monthly_totals', range)
  const incB = mtB.reduce((s, r) => s + Number(r.income), 0)
  check(incB !== inc || sum('income') === 0, 'Bruno obtiene sus propios totales, no los de Ana')
  const { error: eAnon } = await (await import('@supabase/supabase-js'))
    .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    .rpc('monthly_totals', range)
  check(!!eAnon, 'anon no puede llamar a monthly_totals', eAnon?.message)
}

console.log('\n7d. Etapa 2: metas, recurrentes, cuotas, importaciones, patrimonio')
{
  for (const t of ['goals', 'goal_contributions', 'recurring_rules', 'installment_plans', 'import_batches', 'goal_progress']) {
    const { data, error } = await A.from(t).select('user_id')
    check(!error && data.every((r) => r.user_id === ana.userId), `Ana solo ve sus filas de ${t} (${data?.length ?? 0})`, error?.message)
  }
  const bPlan = (await B.from('installment_plans').select('id').limit(1)).data[0].id
  const bGoal = (await B.from('goals').select('id').limit(1)).data[0].id
  const bCard = (await B.from('accounts').select('id').eq('type', 'credit_card').limit(1)).data[0].id
  const aRule = (await A.from('recurring_rules').select('id').limit(1)).data[0].id

  let r = await A.from('installment_plans').select('*').eq('id', bPlan)
  check(r.data.length === 0, 'Ana no puede leer la compra en cuotas de Bruno por id')
  r = await A.from('goals').update({ name: 'HACK' }).eq('id', bGoal).select()
  check(r.data.length === 0, 'UPDATE de meta de Bruno afecta 0 filas')
  r = await A.from('installment_plans').delete().eq('id', bPlan).select()
  check(r.data.length === 0, 'DELETE de compra de Bruno afecta 0 filas')
  r = await B.from('recurring_rules').update({ amount: 1 }).eq('id', aRule).select()
  check(r.data.length === 0, 'Bruno no puede modificar el recurrente de Ana')

  r = await A.from('goals').insert({ name: 'x', target_amount: 1, account_id: bAcc })
  check(!!r.error, 'Meta vinculada a cuenta de Bruno es rechazada', r.error?.message)
  r = await A.from('goal_contributions').insert({ goal_id: bGoal, amount: 1000 })
  check(!!r.error, 'Abono a meta de Bruno es rechazado', r.error?.message)
  r = await A.from('recurring_rules').insert({ type: 'expense', amount: 1, account_id: bAcc, frequency: 'monthly', start_date: '2026-01-01' })
  check(!!r.error, 'Recurrente sobre cuenta de Bruno es rechazado', r.error?.message)
  r = await A.rpc('create_installment_plan', {
    p_description: 'x', p_account_id: bCard, p_category_id: null, p_total_amount: 1000,
    p_installments_count: 2, p_first_date: '2026-01-01', p_installment_amount: null,
  })
  check(!!r.error, 'Cuotas en la tarjeta de Bruno es rechazado', r.error?.message)
  r = await A.rpc('import_transactions', {
    p_account_id: bAcc, p_filename: 'x.csv', p_rows: [{ type: 'expense', amount: 1, date: '2026-01-01', import_hash: 'hack' }],
  })
  check(!!r.error, 'Importar en la cuenta de Bruno es rechazado', r.error?.message)

  const bTxBefore = (await B.from('transactions').select('*', { count: 'exact', head: true })).count
  await A.rpc('materialize_recurring', {})
  const bTxAfter = (await B.from('transactions').select('*', { count: 'exact', head: true })).count
  check(bTxBefore === bTxAfter, 'materialize_recurring de Ana no crea movimientos para Bruno')

  const aBatch = (await A.from('import_batches').select('account_id').limit(1)).data[0]
  r = await A.rpc('import_transactions', {
    p_account_id: aBatch.account_id, p_filename: 'cartola-ana.csv',
    p_rows: [{ type: 'expense', amount: 4500, date: '2026-01-01', note: 'CAFETERIA', import_hash: 'seed-ana-1' }],
  })
  check(!r.error && r.data[0].inserted === 0 && r.data[0].skipped === 1, 'Reimportar la misma fila se omite (duplicado)', r.error?.message)

  const now = new Date().toISOString().slice(0, 8) + '01'
  r = await A.rpc('net_worth_by_month', { p_from: now, p_to: now })
  // Las inversiones cuentan por su valor actual (0006), el resto por su saldo.
  const { data: invRows } = await A.from('accounts').select('id').eq('type', 'investment')
  const invIds = new Set(invRows.map((x) => x.id))
  const { data: bals } = await A.from('account_balances').select('account_id, balance')
  const { data: invStatus } = await A.from('investment_status').select('current_value')
  const sum = bals.filter((b) => !invIds.has(b.account_id)).reduce((s, b) => s + Number(b.balance), 0)
    + invStatus.reduce((s, x) => s + Number(x.current_value), 0)
  check(!r.error && Number(r.data[0].assets) - Number(r.data[0].liabilities) === sum,
    `Patrimonio de Ana = saldos + valor de inversiones (${sum})`, r.error?.message)

  const { createClient } = await import('@supabase/supabase-js')
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  for (const t of ['goals', 'goal_contributions', 'recurring_rules', 'installment_plans', 'import_batches', 'goal_progress']) {
    const { data, error } = await anon.from(t).select('*')
    check(!!error || data.length === 0, `anon no lee ${t}`, error?.message)
  }
  for (const [fn, args] of [
    ['materialize_recurring', {}],
    ['net_worth_by_month', { p_from: now, p_to: now }],
    ['import_transactions', { p_account_id: aBatch.account_id, p_filename: 'x', p_rows: [] }],
    ['create_installment_plan', { p_description: 'x', p_account_id: bCard, p_category_id: null, p_total_amount: 1, p_installments_count: 2, p_first_date: now, p_installment_amount: null }],
  ]) {
    const { error } = await anon.rpc(fn, args)
    check(!!error, `anon no puede ejecutar ${fn}`, error?.message)
  }
}

console.log('\n7e. Deudas separadas, bancos e inversiones (0006)')
{
  for (const t of ['investment_valuations', 'investment_status']) {
    const { data, error } = await A.from(t).select('user_id')
    check(!error && data.every((r) => r.user_id === ana.userId), `Ana solo ve sus filas de ${t} (${data?.length ?? 0})`, error?.message)
  }
  const bInv = (await B.from('accounts').select('id').eq('type', 'investment').limit(1)).data[0]?.id
  check(!!bInv, 'Bruno tiene una inversión de prueba (seed)')
  let r = await A.from('investment_status').select('*').eq('account_id', bInv)
  check(r.data.length === 0, 'Ana no puede leer el estado de la inversión de Bruno')
  r = await A.from('investment_valuations').insert({ account_id: bInv, value: 1 })
  check(!!r.error, 'Ana no puede registrar un valor en la inversión de Bruno', r.error?.message)
  r = await A.rpc('create_tracked_account', { p_account: { type: 'receivable', name: 'x' }, p_cash_account: bAcc, p_cash_amount: 100 })
  check(!!r.error, 'Ana no puede sacar dinero de la cuenta de Bruno al crear una deuda', r.error?.message)
  const aCat = (await A.from('categories').select('id').eq('kind', 'expense').limit(1)).data[0].id
  const aLoan = (await A.from('accounts').select('id').eq('type', 'loan').limit(1)).data[0]?.id
  if (aLoan) {
    r = await A.from('transactions').insert({ type: 'expense', amount: 1, account_id: aLoan, category_id: aCat })
    check(!!r.error, 'Un gasto anotado en una deuda se rechaza', r.error?.message)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  for (const t of ['investment_valuations', 'investment_status']) {
    const { data, error } = await anon.from(t).select('*')
    check(!!error || data.length === 0, `anon no lee ${t}`, error?.message)
  }
  r = await anon.rpc('create_tracked_account', { p_account: { type: 'loan', name: 'x' } })
  check(!!r.error, 'anon no puede ejecutar create_tracked_account', r.error?.message)
}

console.log('\n8. Alta automática y eliminación de cuenta (usuario desechable)')
{
  const email = 'desechable.test@example.com'
  await deleteUserByEmail(email)
  await ensureUser(email)
  const { client, userId } = await clientFor(email)
  const { count } = await client.from('categories').select('*', { count: 'exact', head: true })
  check(count >= 10, `Trigger creó categorías por defecto (${count})`)
  const { data: prof } = await client.from('profiles').select('timezone,currency').single()
  check(prof?.currency === 'CLP' && prof?.timezone === 'America/Santiago', 'Trigger creó el perfil (CLP, America/Santiago)')
  const { data: acc } = await client.from('accounts').insert({ name: 'Temp', type: 'cash' }).select().single()
  await client.from('transactions').insert({ type: 'income', amount: 10, account_id: acc.id })
  // Datos de la Etapa 2, para comprobar que también se borran en cascada.
  const { data: card } = await client.from('accounts')
    .insert({ name: 'Tarjeta temp', type: 'credit_card', credit_limit: 100000 }).select().single()
  await client.rpc('create_installment_plan', {
    p_description: 'Temp', p_account_id: card.id, p_category_id: null, p_total_amount: 3000,
    p_installments_count: 3, p_first_date: '2026-01-01', p_installment_amount: null,
  })
  const { data: g } = await client.from('goals').insert({ name: 'Temp', target_amount: 1000 }).select().single()
  await client.from('goal_contributions').insert({ goal_id: g.id, amount: 100 })
  await client.from('recurring_rules').insert({ type: 'income', amount: 5, account_id: acc.id, frequency: 'weekly', start_date: '2026-01-01' })
  await client.rpc('import_transactions', {
    p_account_id: acc.id, p_filename: 'temp.csv', p_rows: [{ type: 'income', amount: 7, date: '2026-01-02', import_hash: 'temp-1' }],
  })
  // Inversión con aporte y valor (0006).
  await client.rpc('create_tracked_account', {
    p_account: { type: 'investment', name: 'Temp', investment_kind: 'fund' },
    p_cash_account: acc.id, p_cash_amount: 5, p_value: 6,
  })
  const { error } = await client.rpc('delete_my_account')
  check(!error, 'delete_my_account se ejecuta (con datos de la Etapa 2 e inversiones)', error?.message)
  let leftovers = 0
  for (const t of ['transactions', 'accounts', 'categories', 'budgets', 'goals', 'goal_contributions',
                   'recurring_rules', 'installment_plans', 'import_batches', 'investment_valuations', 'profiles']) {
    const { data } = await admin.from(t).select('user_id').eq('user_id', userId)
    leftovers += data?.length ?? 0
  }
  check(leftovers === 0, 'No queda ningún dato del usuario en ninguna tabla (cascada)')
  // Ana/Bruno/Carla no se ven afectados:
  const { count: still } = await A.from('accounts').select('*', { count: 'exact', head: true })
  check(still > 0, 'Los datos de Ana siguen intactos')
}

console.log(failed === 0 ? '\n✅ Todas las pruebas pasaron' : `\n❌ ${failed} prueba(s) fallaron`)
process.exit(failed === 0 ? 0 : 1)
