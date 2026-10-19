// Drawer global de "Nueva transacción" / "Editar movimiento".
// Cualquier componente puede abrirlo con useTransactionDrawer().openNew(),
// opcionalmente con valores iniciales (p. ej. "Registrar pago" de una deuda).
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import type { Transaction, TxInput } from '@/types'
import { TransactionForm } from './TransactionForm'

type DrawerCtx = {
  openNew: (preset?: Partial<TxInput>, title?: string) => void
  openEdit: (tx: Transaction) => void
}
const Ctx = createContext<DrawerCtx | null>(null)

type State = { open: boolean; tx?: Transaction; preset?: Partial<TxInput>; title?: string }

export function TransactionDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ open: false })
  const openNew = useCallback((preset?: Partial<TxInput>, title?: string) => setState({ open: true, preset, title }), [])
  const openEdit = useCallback((tx: Transaction) => setState({ open: true, tx }), [])
  const close = () => setState({ open: false })

  return (
    <Ctx.Provider value={{ openNew, openEdit }}>
      {children}
      <Modal open={state.open} onClose={close}
        title={state.tx ? 'Editar movimiento' : state.title ?? 'Nueva transacción'}>
        <TransactionForm tx={state.tx} preset={state.preset} onDone={close} />
      </Modal>
    </Ctx.Provider>
  )
}

export function useTransactionDrawer(): DrawerCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTransactionDrawer debe usarse dentro de <TransactionDrawerProvider>')
  return ctx
}
