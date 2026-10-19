// Datos de referencia que usa casi toda la app (cuentas y categorías).
// Se cargan una vez y se recargan solos cuando cambian.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { listAccounts } from '@/data/accounts'
import { listCategories } from '@/data/categories'
import type { AccountWithBalance, Category } from '@/types'

type RefData = {
  accounts: AccountWithBalance[]
  categories: Category[]
  accountById: Map<string, AccountWithBalance>
  categoryById: Map<string, Category>
  loading: boolean
  error: string
}

const Ctx = createContext<RefData | null>(null)

export function RefDataProvider({ children }: { children: ReactNode }) {
  // Los saldos dependen de las transacciones, por eso también escucha ese tópico.
  const acc = useQuery(listAccounts, [], ['accounts', 'transactions'])
  const cat = useQuery(listCategories, [], ['categories'])

  const value = useMemo<RefData>(() => {
    const accounts = acc.data ?? []
    const categories = cat.data ?? []
    return {
      accounts,
      categories,
      accountById: new Map(accounts.map((a) => [a.id, a])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
      loading: (acc.loading && !acc.data) || (cat.loading && !cat.data),
      error: acc.error || cat.error,
    }
  }, [acc.data, acc.loading, acc.error, cat.data, cat.loading, cat.error])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRefData(): RefData {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRefData debe usarse dentro de <RefDataProvider>')
  return ctx
}
