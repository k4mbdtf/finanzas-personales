// Reglas de categorización (migración 0007) y su aplicación a movimientos sin categoría.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { Rule } from '@/lib/rules'

export type CategoryRule = Rule & { created_at: string }

/** La tabla no existe: la migración 0007 aún no se aplicó en este proyecto. */
const MISSING_TABLE = new Set(['PGRST205', '42P01'])

/** Reglas del usuario, o null si la migración 0007 aún no se aplicó (la app sigue funcionando sin ellas). */
export async function listCategoryRules(): Promise<CategoryRule[] | null> {
  const res = await supabase.from('category_rules').select('id, pattern, category_id, created_at').order('pattern')
  if (res.error && MISSING_TABLE.has(res.error.code)) return null
  return unwrap<CategoryRule[]>(res)
}

export async function createCategoryRule(pattern: string, categoryId: string): Promise<void> {
  unwrap(await supabase.from('category_rules').insert({ pattern: pattern.trim(), category_id: categoryId }))
  emitChange('rules')
}

export async function deleteCategoryRule(id: string): Promise<void> {
  unwrap(await supabase.from('category_rules').delete().eq('id', id))
  emitChange('rules')
}

/** Movimientos de ingreso o gasto sin categoría y con descripción (candidatos a las reglas). */
export async function uncategorized(): Promise<{ id: string; type: 'income' | 'expense'; note: string }[]> {
  return unwrap(
    await supabase.from('transactions').select('id, type, note')
      .is('category_id', null).neq('type', 'transfer').not('note', 'is', null).limit(5000),
  )
}

/** Asigna categorías a movimientos: { categoryId: [ids] }. En lotes para no exceder el largo de la URL. */
export async function assignCategories(byCategory: Map<string, string[]>): Promise<number> {
  let n = 0
  for (const [categoryId, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      // Solo si siguen sin categoría (por si se editaron mientras tanto).
      unwrap(await supabase.from('transactions').update({ category_id: categoryId }).in('id', chunk).is('category_id', null))
      n += chunk.length
    }
  }
  emitChange('transactions')
  return n
}
