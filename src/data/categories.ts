// Acceso a datos de categorías (el CRUD completo llega en la Fase 3).
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import type { Category } from '@/types'

export async function listCategories(): Promise<Category[]> {
  return unwrap<Category[]>(
    await supabase.from('categories').select('*').order('kind').order('sort_order').order('name'),
  )
}
