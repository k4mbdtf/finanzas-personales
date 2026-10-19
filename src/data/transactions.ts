// Acceso a datos de transacciones.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { Transaction, TxInput, TxType } from '@/types'

export type TxFilters = {
  from: string // YYYY-MM-DD (inclusive)
  to: string // YYYY-MM-DD (inclusive)
  type?: TxType | ''
  accountId?: string
  categoryId?: string
  tag?: string
  text?: string
}

const UUID = /^[0-9a-f-]{36}$/i

/** Escapa los comodines de LIKE para buscar el texto literal. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export async function listTransactions(
  f: TxFilters,
  limit = 50,
): Promise<{ rows: Transaction[]; total: number }> {
  let q = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .gte('date', f.from)
    .lte('date', f.to)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (f.type) q = q.eq('type', f.type)
  // Una cuenta aparece como origen o destino (transferencias).
  if (f.accountId && UUID.test(f.accountId)) {
    q = q.or(`account_id.eq.${f.accountId},to_account_id.eq.${f.accountId}`)
  }
  if (f.categoryId === 'none') q = q.is('category_id', null).neq('type', 'transfer')
  else if (f.categoryId) q = q.eq('category_id', f.categoryId)
  if (f.tag) q = q.contains('tags', [f.tag])
  if (f.text?.trim()) q = q.ilike('note', `%${escapeLike(f.text.trim())}%`)

  const res = await q
  return { rows: unwrap<Transaction[]>(res), total: res.count ?? 0 }
}

/** Etiquetas usadas por el usuario (para el filtro). */
export async function listTags(): Promise<string[]> {
  const rows = unwrap<{ tags: string[] }[]>(
    await supabase.from('transactions').select('tags').neq('tags', '{}').limit(2000),
  )
  return [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'es'))
}

export async function createTransaction(input: TxInput): Promise<void> {
  unwrap(await supabase.from('transactions').insert(input))
  emitChange('transactions')
}

export async function updateTransaction(id: string, input: TxInput): Promise<void> {
  unwrap(await supabase.from('transactions').update(input).eq('id', id))
  emitChange('transactions')
}

export async function deleteTransaction(id: string): Promise<void> {
  unwrap(await supabase.from('transactions').delete().eq('id', id))
  emitChange('transactions')
}

/** "Comida, Viaje ,comida" -> ["comida", "viaje"] */
export function parseTags(text: string): string[] {
  const tags = text
    .split(',')
    .map((t) => t.trim().toLowerCase().slice(0, 30))
    .filter(Boolean)
  return [...new Set(tags)].slice(0, 10)
}
