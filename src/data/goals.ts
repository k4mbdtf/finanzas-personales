// Metas de ahorro y sus abonos. El avance lo calcula la vista goal_progress.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'
import type { Goal, GoalContribution, GoalInput, GoalWithProgress } from '@/types'

export async function listGoals(): Promise<GoalWithProgress[]> {
  const [goals, progress] = await Promise.all([
    supabase.from('goals').select('*').order('archived').order('created_at'),
    supabase.from('goal_progress').select('goal_id, saved'),
  ])
  const saved = new Map(
    unwrap<{ goal_id: string; saved: number }[]>(progress).map((p) => [p.goal_id, Number(p.saved)]),
  )
  return unwrap<Goal[]>(goals).map((g) => ({ ...g, saved: saved.get(g.id) ?? 0 }))
}

export async function createGoal(input: GoalInput): Promise<void> {
  unwrap(await supabase.from('goals').insert(input))
  emitChange('goals')
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<void> {
  unwrap(await supabase.from('goals').update(input).eq('id', id))
  emitChange('goals')
}

/** Borra la meta y sus abonos (no toca cuentas ni movimientos). */
export async function deleteGoal(id: string): Promise<void> {
  unwrap(await supabase.from('goals').delete().eq('id', id))
  emitChange('goals')
}

export async function listContributions(goalId: string): Promise<GoalContribution[]> {
  return unwrap<GoalContribution[]>(
    await supabase.from('goal_contributions').select('id, goal_id, amount, date, note')
      .eq('goal_id', goalId).order('date', { ascending: false }).order('created_at', { ascending: false }),
  )
}

/** amount > 0 = abono; amount < 0 = retiro. */
export async function addContribution(goalId: string, amount: number, date: string, note: string | null): Promise<void> {
  unwrap(await supabase.from('goal_contributions').insert({ goal_id: goalId, amount, date, note }))
  emitChange('goals')
}

export async function deleteContribution(id: string): Promise<void> {
  unwrap(await supabase.from('goal_contributions').delete().eq('id', id))
  emitChange('goals')
}
