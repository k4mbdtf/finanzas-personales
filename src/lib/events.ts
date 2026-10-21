// Bus de eventos mínimo: cuando se modifica un tipo de dato, las vistas que lo
// usan se recargan solas. Evita agregar una librería de caché (react-query).

export type Topic =
  | 'accounts' | 'categories' | 'transactions' | 'budgets'
  | 'goals' | 'recurring' | 'installments' | 'imports' | 'investments' | 'rules'
  | 'profile' | 'rates'

type Listener = (topic: Topic) => void
const listeners = new Set<Listener>()

export function emitChange(...topics: Topic[]) {
  for (const t of topics) listeners.forEach((l) => l(t))
}

export function onChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
