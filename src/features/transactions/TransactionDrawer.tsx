// Drawer global de "Nueva transacción" / "Editar movimiento".
// Cualquier componente puede abrirlo con useTransactionDrawer().openNew().
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import type { Transaction } from '@/types'
import { TransactionForm } from './TransactionForm'

type DrawerCtx = { openNew: () => void; openEdit: (tx: Transaction) => void }
const Ctx = createContext<DrawerCtx | null>(null)

export function TransactionDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; tx?: Transaction }>({ open: false })
  const openNew = useCallback(() => setState({ open: true }), [])
  const openEdit = useCallback((tx: Transaction) => setState({ open: true, tx }), [])
  const close = () => setState({ open: false })

  return (
    <Ctx.Provider value={{ openNew, openEdit }}>
      {children}
      <Modal open={state.open} onClose={close} title={state.tx ? 'Editar movimiento' : 'Nueva transacción'}>
        <TransactionForm tx={state.tx} onDone={close} />
      </Modal>
    </Ctx.Provider>
  )
}

export function useTransactionDrawer(): DrawerCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTransactionDrawer debe usarse dentro de <TransactionDrawerProvider>')
  return ctx
}
