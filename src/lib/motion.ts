// Preferencia de movimiento del sistema ("reducir movimiento").
// Las animaciones CSS se apagan solas (index.css); esto es para las de JS
// (números que cuentan, gráficos de Recharts, cierre de hojas).
import { useEffect, useRef, useState } from 'react'

const query = () => window.matchMedia('(prefers-reduced-motion: reduce)')

export const prefersReducedMotion = () => query().matches

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = query()
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))

/**
 * Valor que "cuenta" suavemente hasta `target` (cifras del resumen).
 * Al montar parte desde 0; luego anima desde el valor anterior.
 */
export function useAnimatedNumber(target: number, duration = 700): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced ? target : 0)
  const from = useRef(reduced ? target : 0)

  useEffect(() => {
    if (reduced) {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const v = origin + (target - origin) * easeOutExpo(t)
      setValue(v)
      from.current = v
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, reduced])

  return Math.round(value)
}
