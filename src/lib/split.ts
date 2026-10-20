// Validación de un movimiento dividido en varias categorías.
// Sin imports a propósito: se prueba con `node --test` (split.test.ts).

export type DraftPart = { categoryId: string | null; amount: number | null }

export type SplitStatus = {
  assigned: number
  /** Total − asignado: positivo falta repartir, negativo se pasó. */
  remaining: number
  /** Mensaje del primer problema, o '' si se puede guardar. */
  error: string
}

export function splitStatus(total: number | null, parts: DraftPart[]): SplitStatus {
  const assigned = parts.reduce((s, p) => s + (p.amount ?? 0), 0)
  const remaining = (total ?? 0) - assigned
  const error =
    parts.length < 2 ? 'Divide en al menos 2 partes.'
    : parts.some((p) => !p.categoryId) ? 'Elige la categoría de cada parte.'
    : parts.some((p) => !p.amount) ? 'Cada parte necesita un monto mayor a $0.'
    : new Set(parts.map((p) => p.categoryId)).size < parts.length ? 'Usa una categoría distinta en cada parte.'
    : remaining !== 0 ? 'Las partes deben sumar el total.'
    : ''
  return { assigned, remaining, error }
}

/** Parte nueva: con lo que falta repartir (si falta algo). */
export function nextPart(total: number | null, parts: DraftPart[]): DraftPart {
  const remaining = splitStatus(total, parts).remaining
  return { categoryId: null, amount: remaining > 0 ? remaining : null }
}
