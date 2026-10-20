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

/** ¿Está la migración 0008 (dividir movimientos)? Se consulta una vez por sesión. */
let splitCheck: Promise<boolean> | null = null
export function splitAvailable(): Promise<boolean> {
  splitCheck ??= Promise.resolve(supabase.from('transactions').select('split_group').limit(1)).then((res) => {
    if (!res.error) return true
    if (res.error.code !== '42703') splitCheck = null // otro error (p. ej. sin conexión): se reintenta
    return false
  })
  return splitCheck
}

/** Todas las partes de un movimiento dividido, en el orden en que se crearon. */
export async function listSplitParts(group: string): Promise<Transaction[]> {
  return unwrap<Transaction[]>(
    await supabase.from('transactions').select('*').eq('split_group', group).order('created_at').order('id'),
  )
}

export type SplitPart = { categoryId: string; amount: number }

/**
 * Guarda un movimiento dividido (atómico, en la BD). `anchorId`: el movimiento que se
 * divide o una parte del grupo que se edita; con una sola parte deja de estar dividido.
 */
export async function saveSplit(input: {
  anchorId: string | null; type: 'income' | 'expense'; date: string; accountId: string
  note: string | null; tags: string[]; parts: SplitPart[]
}): Promise<void> {
  unwrap(await supabase.rpc('save_split', {
    p_anchor: input.anchorId, p_type: input.type, p_date: input.date, p_account_id: input.accountId,
    p_note: input.note, p_tags: input.tags,
    p_parts: input.parts.map((p) => ({ category_id: p.categoryId, amount: p.amount })),
  }))
  emitChange('transactions')
}

/** Elimina todas las partes de un movimiento dividido. */
export async function deleteSplitGroup(group: string): Promise<void> {
  unwrap(await supabase.from('transactions').delete().eq('split_group', group))
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
