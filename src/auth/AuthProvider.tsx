// Mantiene la sesión de Supabase disponible para toda la app.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  /** true cuando el usuario llegó desde un enlace de recuperación de contraseña */
  recovering: boolean
  clearRecovering: () => void
  /** Error que Supabase dejó en la URL (p. ej. enlace del correo expirado) */
  urlError: string | null
}

const AuthContext = createContext<AuthState | null>(null)

// Se lee al cargar el módulo, antes de que se limpie la URL.
const initialUrlError = (() => {
  const q = new URLSearchParams(window.location.search)
  return q.get('error_code') ?? q.get('error')
})()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    // getSession() espera a que supabase-js canjee el ?code= del enlace del correo.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      stripAuthParams()
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session, loading, recovering,
        clearRecovering: () => setRecovering(false),
        urlError: initialUrlError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

/** Quita ?code=... / ?error=... de la URL tras procesarlos (deja el #/ruta). */
function stripAuthParams() {
  const url = new URL(window.location.href)
  if (url.search) window.history.replaceState(null, '', url.pathname + url.hash)
}
