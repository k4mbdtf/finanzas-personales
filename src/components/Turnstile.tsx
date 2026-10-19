// Widget de Cloudflare Turnstile sin dependencias externas.
// Si VITE_TURNSTILE_SITE_KEY está vacío no se muestra (útil en desarrollo).
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
export const captchaEnabled = Boolean(SITE_KEY)

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('No se pudo cargar el captcha')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export type TurnstileHandle = { reset: () => void }

/** onToken recibe el token (o null si expiró). Los tokens son de un solo uso:
 *  llama a ref.reset() después de cada intento de envío. */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (t: string | null) => void }>(
  function Turnstile({ onToken }, ref) {
    const box = useRef<HTMLDivElement>(null)
    const widgetId = useRef<string | null>(null)
    const cb = useRef(onToken)
    cb.current = onToken

    useImperativeHandle(ref, () => ({
      reset: () => {
        cb.current(null)
        if (widgetId.current) window.turnstile?.reset(widgetId.current)
      },
    }))

    useEffect(() => {
      if (!SITE_KEY) return
      let cancelled = false
      loadScript()
        .then(() => {
          if (cancelled || !box.current || !window.turnstile) return
          widgetId.current = window.turnstile.render(box.current, {
            sitekey: SITE_KEY,
            language: 'es',
            theme: 'auto',
            callback: (t: string) => cb.current(t),
            'expired-callback': () => cb.current(null),
            'error-callback': () => cb.current(null),
          })
        })
        .catch(() => cb.current(null))
      return () => {
        cancelled = true
        if (widgetId.current) window.turnstile?.remove(widgetId.current)
        widgetId.current = null
      }
    }, [])

    if (!SITE_KEY) return null
    return <div ref={box} className="min-h-[65px]" />
  },
)
