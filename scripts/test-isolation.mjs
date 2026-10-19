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
  const { error } = await client.rpc('delete_my_account')
  check(!error, 'delete_my_account se ejecuta', error?.message)
  const { data: left } = await admin.from('transactions').select('id').eq('user_id', userId)
  const { data: leftA } = await admin.from('accounts').select('id').eq('user_id', userId)
  const { data: leftC } = await admin.from('categories').select('id').eq('user_id', userId)
  check(left.length + leftA.length + leftC.length === 0, 'No queda ningún dato del usuario (cascada)')
  // Ana/Bruno/Carla no se ven afectados:
  const { count: still } = await A.from('accounts').select('*', { count: 'exact', head: true })
  check(still > 0, 'Los datos de Ana siguen intactos')
}

console.log(failed === 0 ? '\n✅ Todas las pruebas pasaron' : `\n❌ ${failed} prueba(s) fallaron`)
process.exit(failed === 0 ? 0 : 1)
