// Confirmaciones ("¿Eliminar?") y avisos breves (toasts) para toda la app.
//   const confirm = useConfirm(); if (await confirm({...})) { ... }
//   const toast = useToast(); toast('Guardado')
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './ui'

type ConfirmOptions = { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }
type ToastKind = 'success' | 'warning' | 'error'

const TOAST_STYLE: Record<ToastKind, { icon: string; cls: string }> = {
  success: { icon: '✓', cls: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' },
  warning: { icon: '⚠️', cls: 'bg-amber-400 text-amber-950' },
  error: { icon: '⛔', cls: 'bg-red-700 text-white' },
}
type Ctx = {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  toast: (msg: string, kind?: ToastKind) => void
}

const FeedbackCtx = createContext<Ctx | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: ToastKind }[]>([])

  const confirm = useCallback((o: ConfirmOptions) => {
    setPending(o)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const answer = (v: boolean) => {
    resolver.current(v)
    setPending(null)
  }

  const toast = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'success' ? 3500 : 6000)
  }, [])

  return (
    <FeedbackCtx.Provider value={{ confirm, toast }}>
      {children}

      <Modal open={!!pending} onClose={() => answer(false)} title={pending?.title ?? ''}>
        <div className="text-sm text-slate-700 dark:text-slate-300">{pending?.message}</div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => answer(false)}>Cancelar</Button>
          <Button variant={pending?.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>
            {pending?.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </Modal>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'success' ? 'status' : 'alert'}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${TOAST_STYLE[t.kind].cls}`}
          >
            {TOAST_STYLE[t.kind].icon} {t.msg}
          </div>
        ))}
      </div>
    </FeedbackCtx.Provider>
  )
}

function useFeedback(): Ctx {
  const ctx = useContext(FeedbackCtx)
  if (!ctx) throw new Error('Debe usarse dentro de <FeedbackProvider>')
  return ctx
}
export const useConfirm = () => useFeedback().confirm
export const useToast = () => useFeedback().toast
