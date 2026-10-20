// Acceso a datos de cuentas. RLS garantiza que solo se ven las del usuario.
// Incluye las de seguimiento (deudas, me deben, inversiones): RefData las separa.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { Account, AccountInput, AccountWithBalance } from '@/types'

type BalanceRow = { account_id: string; balance: number; inflow: number; outflow: number }

/** Todas las cuentas (incluidas archivadas) con su saldo y lo que entró y salió. */
export async function listAccounts(): Promise<AccountWithBalance[]> {
  const [accs, bals] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('account_balances').select('account_id, balance, inflow, outflow'),
  ])
  const accounts = unwrap<Account[]>(accs)
  const balances = new Map(unwrap<BalanceRow[]>(bals).map((b) => [b.account_id, b]))
  return accounts.map((a) => {
    const b = balances.get(a.id)
    return {
      ...a,
      balance: b ? Number(b.balance) : a.initial_balance,
      inflow: Number(b?.inflow ?? 0),
      outflow: Number(b?.outflow ?? 0),
    }
  })
}

export async function createAccount(input: AccountInput): Promise<void> {
  unwrap(await supabase.from('accounts').insert(input))
  emitChange('accounts')
}

export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<void> {
  unwrap(await supabase.from('accounts').update(input).eq('id', id))
  emitChange('accounts', 'investments')
}

/** Falla con código 23503 si la cuenta tiene movimientos (FK restrict). */
export async function deleteAccount(id: string): Promise<void> {
  unwrap(await supabase.from('accounts').delete().eq('id', id))
  emitChange('accounts', 'investments')
}

/** Movimiento inicial al crear una deuda o inversión (opcional). */
export type OpeningMove = {
  /** Cuenta propia: donde llegó el préstamo, desde donde prestaste o aportaste. */
  cashAccountId?: string | null
  cashAmount?: number | null
  date?: string
  /** Solo inversiones: valor actual en esa fecha. */
  value?: number | null
}

/** Crea una deuda, un "me deben" o una inversión con su movimiento inicial (atómico, en la BD). */
export async function createTrackedAccount(input: Partial<AccountInput> & Pick<AccountInput, 'type' | 'name'>, move: OpeningMove = {}): Promise<string> {
  const id = unwrap<string>(await supabase.rpc('create_tracked_account', {
    p_account: input,
    p_cash_account: move.cashAccountId || null,
    p_cash_amount: move.cashAccountId ? move.cashAmount ?? null : null,
    p_date: move.date ?? null,
    p_value: move.value ?? null,
  }))
  emitChange('accounts', 'transactions', 'investments')
  return id
}
