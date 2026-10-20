// Reglas de categorización: "si la descripción contiene <texto>, usa <categoría>".
// La comparación ignora mayúsculas, tildes y signos ("Pago UBER *TRIP 123" contiene "uber").
// Si varias reglas calzan, gana la de texto más largo (la más específica: "uber eats"
// antes que "uber"). Una regla solo aplica a movimientos del tipo de su categoría.
// Solo importa lógica pura: se prueba con `node --test` (rules.test.ts).
import { normalizeText } from './csv.ts'

export type Rule = { id: string; pattern: string; category_id: string }
export type RuleKind = 'income' | 'expense'

/** minúsculas, sin tildes y solo letras/números separados por un espacio. */
export function ruleKey(s: string): string {
  return normalizeText(s).replace(/[^a-z0-9ñ]+/g, ' ').trim()
}

/**
 * Categoría para un texto según las reglas, o null. `kindOf` dice si la categoría de una
 * regla es de gasto o de ingreso (las de otro tipo no aplican; las de categorías que ya
 * no existen tampoco).
 */
export function matchRule(
  rules: Rule[], text: string | null | undefined, kind: RuleKind, kindOf: (categoryId: string) => RuleKind | undefined,
): Rule | null {
  if (!text) return null
  const hay = ` ${ruleKey(text)} `
  let best: Rule | null = null
  let bestLen = 0
  for (const r of rules) {
    const needle = ruleKey(r.pattern)
    if (!needle || kindOf(r.category_id) !== kind) continue
    // Palabras completas: "bip" calza en "carga bip" pero no en "bipolar".
    if (hay.includes(` ${needle} `) && needle.length > bestLen) {
      best = r
      bestLen = needle.length
    }
  }
  return best
}
