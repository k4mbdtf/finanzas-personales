// Datos de referencia que usa casi toda la app (cuentas y categorías).
// Se cargan una vez y se recargan solos cuando cambian.
//   accounts:    solo cuentas de dinero (efectivo, banco, ahorro, tarjeta): las
//                que aparecen en Cuentas y en los formularios de movimientos.
//   debts:       deudas y "me deben" (sección Deudas).
//   investments: inversiones (sección Inversiones).
//   accountById: TODAS, para mostrar nombres en listas y movimientos.
//   multiCurrency / rates / viewCurrency: opción de UF y dólares (migración 0009),
//                valores de hoy y la moneda en que se quieren ver los saldos.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { listAccounts } from '@/data/accounts'
import { listCategories } from '@/data/categories'
import { getProfile } from '@/data/profile'
import { todayRates } from '@/data/rates'
import { isDebtType, isMoneyType } from '@/lib/accounts'
import { currencyOf, type Currency, type ForeignCurrency, type Rates } from '@/lib/currency'
import { todayISO } from '@/lib/format'
import type { AccountWithBalance, Category } from '@/types'

type RefData = {
  accounts: AccountWithBalance[]
  debts: AccountWithBalance[]
  investments: AccountWithBalance[]
  categories: Category[]
  accountById: Map<string, AccountWithBalance>
  categoryById: Map<string, Category>
  loading: boolean
  error: string
  /** Opción "Usar UF y dólares" activada en Ajustes. */
  multiCurrency: boolean
  /** La migración 0009 está aplicada (se puede activar la opción). */
  currencyAvailable: boolean
  /** Valor de hoy de la UF y el dólar (los que se pudieron obtener). */
  rates: Rates
  /** Moneda en que se muestran los saldos y totales ("Ver en"); siempre CLP sin la opción. */
  viewCurrency: Currency
  setViewCurrency: (c: Currency) => void
}

const VIEW_KEY = 'finanzas.viewCurrency'

const Ctx = createContext<RefData | null>(null)

export function RefDataProvider({ children }: { children: ReactNode }) {
  // Los saldos dependen de las transacciones, por eso también escucha ese tópico.
  const acc = useQuery(listAccounts, [], ['accounts', 'transactions'])
  const cat = useQuery(listCategories, [], ['categories'])
  const profile = useQuery(getProfile, [], ['profile'])
  const multiCurrency = !!profile.data?.multiCurrency

  // Valores de hoy: de las monedas de las cuentas y, con la opción activa, de UF y USD (para "Ver en").
  const needed = new Set<ForeignCurrency>(multiCurrency ? ['UF', 'USD'] : [])
  for (const a of acc.data ?? []) {
    const c = currencyOf(a)
    if (c !== 'CLP') needed.add(c)
  }
  const neededKey = [...needed].sort().join(',')
  const rates = useQuery(
    (): Promise<Rates> => (neededKey ? todayRates(neededKey.split(',') as ForeignCurrency[], todayISO()) : Promise.resolve({})),
    [neededKey], ['rates'],
  )

  const [view, setView] = useState<Currency>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY)
      if (v === 'UF' || v === 'USD') return v
    } catch { /* almacenamiento no disponible */ }
    return 'CLP'
  })
  const setViewCurrency = (c: Currency) => {
    setView(c)
    try { localStorage.setItem(VIEW_KEY, c) } catch { /* ignorar */ }
  }
  // Sin la opción, o sin el valor de esa moneda, se ve en pesos.
  const viewCurrency: Currency = multiCurrency && (view === 'CLP' || rates.data?.[view]) ? view : 'CLP'

  const value = useMemo<RefData>(() => {
    const all = acc.data ?? []
    const categories = cat.data ?? []
    return {
      accounts: all.filter((a) => isMoneyType(a.type)),
      debts: all.filter((a) => isDebtType(a.type)),
      investments: all.filter((a) => a.type === 'investment'),
      categories,
      accountById: new Map(all.map((a) => [a.id, a])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
      loading: (acc.loading && !acc.data) || (cat.loading && !cat.data),
      error: acc.error || cat.error,
      multiCurrency,
      currencyAvailable: !!profile.data?.currencyAvailable,
      rates: rates.data ?? {},
      viewCurrency,
      setViewCurrency,
    }
  }, [acc.data, acc.loading, acc.error, cat.data, cat.loading, cat.error, multiCurrency, profile.data, rates.data, viewCurrency])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRefData(): RefData {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRefData debe usarse dentro de <RefDataProvider>')
  return ctx
}
