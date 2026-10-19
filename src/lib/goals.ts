// Cálculos de metas de ahorro. Sin imports: se prueba con `node --test` (goals.test.ts).

/** Meses calendario desde `today` hasta `target` (mínimo 1 si la fecha es futura; 0 si ya pasó). */
export function monthsUntil(today: string, target: string): number {
  if (target <= today) return 0
  const [ty, tm, td] = today.split('-').map(Number)
  const [gy, gm, gd] = target.split('-').map(Number)
  let months = (gy - ty) * 12 + (gm - tm)
  if (gd < td) months -= 1 // aún no se cumple el mes completo
  return Math.max(1, months)
}

export function goalStatus(saved: number, target: number, targetDate: string | null, today: string) {
  const remaining = Math.max(0, target - saved)
  const pct = target > 0 ? Math.min(100, Math.max(0, Math.round((saved / target) * 100))) : 0
  const done = saved >= target
  const months = targetDate ? monthsUntil(today, targetDate) : null
  const perMonth = !done && months ? Math.ceil(remaining / months) : null
  const overdue = !done && targetDate != null && targetDate < today
  return { remaining, pct, done, months, perMonth, overdue }
}
