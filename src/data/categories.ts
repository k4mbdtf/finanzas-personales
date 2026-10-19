// Acceso a datos de categorías.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { Category, CategoryInput } from '@/types'

export async function listCategories(): Promise<Category[]> {
  return unwrap<Category[]>(
    await supabase.from('categories').select('*').order('kind').order('sort_order').order('name'),
  )
}

export async function createCategory(input: CategoryInput): Promise<void> {
  unwrap(await supabase.from('categories').insert(input))
  emitChange('categories')
}

export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<void> {
  unwrap(await supabase.from('categories').update(input).eq('id', id))
  emitChange('categories')
}

/** Los movimientos quedan "Sin categoría" (FK on delete set null) y sus
 *  presupuestos se eliminan (on delete cascade). */
export async function deleteCategory(id: string): Promise<void> {
  unwrap(await supabase.from('categories').delete().eq('id', id))
  emitChange('categories', 'transactions', 'budgets')
}
