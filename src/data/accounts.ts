// Acceso a datos de cuentas. RLS garantiza que solo se ven las del usuario.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { Account, AccountInput, AccountWithBalance } from '@/types'

/** Todas las cuentas (incluidas archivadas) con su saldo actual. */
export async function listAccounts(): Promise<AccountWithBalance[]> {
  const [accs, bals] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('account_balances').select('account_id, balance'),
  ])
  const accounts = unwrap<Account[]>(accs)
  const balances = new Map(
    unwrap<{ account_id: string; balance: number }[]>(bals).map((b) => [b.account_id, Number(b.balance)]),
  )
  return accounts.map((a) => ({ ...a, balance: balances.get(a.id) ?? a.initial_balance }))
}

export async function createAccount(input: AccountInput): Promise<void> {
  unwrap(await supabase.from('accounts').insert(input))
  emitChange('accounts')
}

export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<void> {
  unwrap(await supabase.from('accounts').update(input).eq('id', id))
  emitChange('accounts')
}

/** Falla con código 23503 si la cuenta tiene movimientos (FK restrict). */
export async function deleteAccount(id: string): Promise<void> {
  unwrap(await supabase.from('accounts').delete().eq('id', id))
  emitChange('accounts')
}
