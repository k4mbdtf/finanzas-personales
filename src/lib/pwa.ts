// Registro del service worker e instalación de la PWA.
import { useEffect, useState } from 'react'

/** Solo en producción: en desarrollo el SW interferiría con la recarga en caliente. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* sin SW la app funciona igual, solo no queda disponible sin conexión */
    })
  })
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // mostramos nuestro propio botón en Ajustes
  deferred = e as InstallPromptEvent
  listeners.forEach((l) => l())
})

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Estado de instalación para el botón "Instalar app". */
export function useInstallPrompt() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  return {
    installed: isStandalone(),
    canPrompt: deferred !== null,
    ios: isIOS(),
    async install() {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice
      deferred = null
      force((n) => n + 1)
    },
  }
}
