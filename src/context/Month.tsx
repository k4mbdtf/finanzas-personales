// Mes seleccionado en el selector superior ("YYYY-MM"), compartido por las vistas.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { currentMonth } from '@/lib/dates'

type MonthCtx = { month: string; setMonth: (ym: string) => void }
const Ctx = createContext<MonthCtx | null>(null)

const KEY = 'finanzas.month'

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonthState] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(KEY)
      if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved
    } catch { /* almacenamiento no disponible */ }
    return currentMonth()
  })
  const setMonth = (ym: string) => {
    setMonthState(ym)
    try { sessionStorage.setItem(KEY, ym) } catch { /* ignorar */ }
  }
  return <Ctx.Provider value={{ month, setMonth }}>{children}</Ctx.Provider>
}

export function useMonth(): MonthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMonth debe usarse dentro de <MonthProvider>')
  return ctx
}
