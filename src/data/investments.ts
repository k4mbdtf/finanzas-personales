// Inversiones: su estado (vista investment_status) y sus valorizaciones.
// Las inversiones en sí son filas de accounts (type = 'investment'): se crean
// con createTrackedAccount y se editan con updateAccount (data/accounts.ts).
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { InvestmentStatus, InvestmentValuation } from '@/types'

/** Estado de cada inversión (aportado, rescatado, valor actual) por id de cuenta. */
export async function listInvestmentStatus(): Promise<Map<string, InvestmentStatus>> {
  const rows = unwrap<InvestmentStatus[]>(
    await supabase.from('investment_status')
      .select('account_id, contributed, withdrawn, valued_at, last_value, current_value'),
  )
  return new Map(rows.map((r) => [r.account_id, {
    ...r,
    contributed: Number(r.contributed),
    withdrawn: Number(r.withdrawn),
    last_value: r.last_value == null ? null : Number(r.last_value),
    current_value: Number(r.current_value),
  }]))
}

/** Valorizaciones de una inversión, de la más nueva a la más antigua. */
export async function listValuations(accountId: string): Promise<InvestmentValuation[]> {
  return unwrap<InvestmentValuation[]>(
    await supabase.from('investment_valuations').select('*').eq('account_id', accountId)
      .order('date', { ascending: false }).order('created_at', { ascending: false }),
  ).map((v) => ({ ...v, value: Number(v.value) }))
}

export async function createValuation(input: { account_id: string; date: string; value: number; note?: string | null }): Promise<void> {
  unwrap(await supabase.from('investment_valuations').insert(input))
  emitChange('investments')
}

export async function deleteValuation(id: string): Promise<void> {
  unwrap(await supabase.from('investment_valuations').delete().eq('id', id))
  emitChange('investments')
}
