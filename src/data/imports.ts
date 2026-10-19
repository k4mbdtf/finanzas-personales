// Importación de cartolas: detección de duplicados, sugerencias e importación atómica.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import { normalizeForMatch } from '@/lib/csv'
import type { ImportBatch } from '@/types'

/** Huellas que ya existen (filas importadas antes). Consulta en lotes para no exceder el largo de la URL. */
export async function existingHashes(hashes: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < hashes.length; i += 80) {
    const chunk = hashes.slice(i, i + 80)
    const rows = unwrap<{ import_hash: string }[]>(
      await supabase.from('transactions').select('import_hash').in('import_hash', chunk),
    )
    rows.forEach((r) => found.add(r.import_hash))
  }
  return found
}

/** Movimientos ingresados a mano en la cuenta y rango: "fecha|tipo|monto" (posibles duplicados). */
export async function manualKeys(accountId: string, from: string, to: string): Promise<Set<string>> {
  const rows = unwrap<{ date: string; type: string; amount: number }[]>(
    await supabase.from('transactions').select('date, type, amount')
      .eq('account_id', accountId).is('import_hash', null).gte('date', from).lte('date', to).limit(5000),
  )
  return new Set(rows.map((r) => `${r.date}|${r.type}|${Number(r.amount)}`))
}

/** Categoría usada antes para una descripción parecida (la más reciente). Clave: "tipo|texto". */
export async function categoryMemory(): Promise<Map<string, string>> {
  const rows = unwrap<{ note: string; type: string; category_id: string }[]>(
    await supabase.from('transactions').select('note, type, category_id')
      .not('category_id', 'is', null).not('note', 'is', null)
      .order('date', { ascending: false }).limit(3000),
  )
  const map = new Map<string, string>()
  for (const r of rows) {
    const key = `${r.type}|${normalizeForMatch(r.note)}`
    if (!map.has(key)) map.set(key, r.category_id)
  }
  return map
}

export type ImportPayloadRow = {
  type: 'income' | 'expense'
  amount: number
  date: string
  category_id: string | null
  note: string
  import_hash: string
}

/** Todo o nada: si una fila falla, no se importa ninguna. Las ya importadas se omiten. */
export async function importRows(
  accountId: string, filename: string, rows: ImportPayloadRow[],
): Promise<{ inserted: number; skipped: number }> {
  const res = unwrap<{ batch_id: string | null; inserted: number; skipped: number }[]>(
    await supabase.rpc('import_transactions', { p_account_id: accountId, p_filename: filename, p_rows: rows }),
  )
  emitChange('transactions', 'imports', 'accounts')
  return { inserted: Number(res[0]?.inserted ?? 0), skipped: Number(res[0]?.skipped ?? 0) }
}

export async function listBatches(): Promise<ImportBatch[]> {
  return unwrap<ImportBatch[]>(
    await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(20),
  )
}

/** Deshacer: borra el lote y todos sus movimientos. */
export async function deleteBatch(id: string): Promise<void> {
  unwrap(await supabase.from('import_batches').delete().eq('id', id))
  emitChange('transactions', 'imports', 'accounts')
}
