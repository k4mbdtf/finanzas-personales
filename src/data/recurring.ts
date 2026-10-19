// Reglas de transacciones recurrentes.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { RecurringInput, RecurringRule } from '@/types'

export async function listRules(): Promise<RecurringRule[]> {
  return unwrap<RecurringRule[]>(
    await supabase.from('recurring_rules').select('*').order('active', { ascending: false }).order('next_date'),
  )
}

export async function createRule(input: RecurringInput): Promise<void> {
  unwrap(await supabase.from('recurring_rules').insert(input))
  emitChange('recurring')
}

export async function updateRule(id: string, input: Partial<RecurringInput>): Promise<void> {
  unwrap(await supabase.from('recurring_rules').update(input).eq('id', id))
  emitChange('recurring')
}

/** Los movimientos ya generados se conservan (quedan sin regla). */
export async function deleteRule(id: string): Promise<void> {
  unwrap(await supabase.from('recurring_rules').delete().eq('id', id))
  emitChange('recurring', 'transactions')
}

/** Genera los movimientos pendientes hasta hoy. Devuelve cuántos creó. */
export async function materializeRecurring(): Promise<number> {
  const n = Number(unwrap<number>(await supabase.rpc('materialize_recurring', {})) ?? 0)
  if (n > 0) emitChange('transactions', 'recurring', 'accounts')
  return n
}
