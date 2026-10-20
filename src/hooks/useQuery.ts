import { useEffect, useState } from 'react'
import { onChange, type Topic } from '@/lib/events'

type State<T> = { data: T | undefined; error: string; loading: boolean }

/**
 * Ejecuta `fn` al montar, cuando cambian `deps` y cuando se emite un cambio en
 * alguno de los `topics`. Mantiene los datos anteriores mientras recarga.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], topics: Topic[] = []) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: '', loading: true })
  const [version, setVersion] = useState(0)
  const topicsKey = topics.join(',')

  useEffect(() => {
    if (!topicsKey) return
    const list = topicsKey.split(',') as Topic[]
    return onChange((t) => { if (list.includes(t)) setVersion((v) => v + 1) })
  }, [topicsKey])

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: '' }))
    fn()
      .then((data) => alive && setState({ data, error: '', loading: false }))
      .catch((e: unknown) =>
        alive && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Error inesperado' })),
      )
    return () => { alive = false }
    // `deps` las entrega quien llama (como en useEffect) y ESLint las revisa en cada
    // llamada a useQuery (exhaustive-deps con additionalHooks en eslint.config.js).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  return { ...state, reload: () => setVersion((v) => v + 1) }
}

/** Devuelve `value` después de `ms` sin cambios (para búsquedas al escribir). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}
