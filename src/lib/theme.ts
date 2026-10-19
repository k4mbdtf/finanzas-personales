// Tema claro/oscuro: "system" sigue al sistema operativo; "light"/"dark" lo fijan.
// Se aplica con la clase .dark en <html> (ver @custom-variant en index.css).
// El script inline de index.html hace lo mismo antes de pintar (sin parpadeo).
import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'finanzas.theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* almacenamiento no disponible */ }
  return 'system'
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#0f766e')
}

export function setThemePref(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref) } catch { /* ignorar */ }
  apply(pref)
}

/** Llamar una vez al iniciar: reacciona a cambios del sistema en modo "system". */
export function initTheme() {
  apply(getThemePref())
  media().addEventListener('change', () => { if (getThemePref() === 'system') apply('system') })
}

/** true si la app está en oscuro ahora (observa la clase de <html>). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}
