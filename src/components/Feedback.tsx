// Confirmaciones ("¿Eliminar?") y avisos breves (toasts) para toda la app.
//   const confirm = useConfirm(); if (await confirm({...})) { ... }
//   const toast = useToast(); toast('Guardado')
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './ui'

type ConfirmOptions = { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }
type ToastKind = 'success' | 'warning' | 'error'

// El aviso es siempre una cápsula oscura (como el HUD de iOS); los colores de
// los íconos son los de modo oscuro, que tienen ≥ 7:1 sobre ese fondo.
const TOAST_ICON = {
  success: { Icon: CircleCheck, color: '#7fd6a1' },
  warning: { Icon: TriangleAlert, color: '#f2c46b' },
  error: { Icon: CircleAlert, color: '#ff9e94' },
} as const

type Ctx = {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  toast: (msg: string, kind?: ToastKind) => void
}

const FeedbackCtx = createContext<Ctx | null>(null)

type Toast = { id: number; msg: string; kind: ToastKind; leaving?: boolean }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})
  const [toasts, setToasts] = useState<Toast[]>([])

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
    const life = kind === 'success' ? 3200 : 6000
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]) // máximo 3 a la vez
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), life)
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), life + 220)
  }, [])

  return (
    <FeedbackCtx.Provider value={{ confirm, toast }}>
      {children}

      <Modal open={!!pending} onClose={() => answer(false)} title={pending?.title ?? ''}>
        <div className="text-[0.9375rem] leading-relaxed text-soft">{pending?.message}</div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => answer(false)}>Cancelar</Button>
          <Button variant={pending?.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>
            {pending?.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      </Modal>

      <div aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[500] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const { Icon, color } = TOAST_ICON[t.kind]
          return (
            <div key={t.id} role={t.kind === 'success' ? 'status' : 'alert'}
              style={{ animation: t.leaving ? 'fade-out 220ms ease-in both' : 'toast-in 380ms var(--ease-soft) both' }}
              className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg bg-[#1c1c1c]/92 px-4 py-3 text-sm font-medium text-[#f5f1e8]
                shadow-[var(--shadow-float)] backdrop-blur-xl dark:bg-[#2c2c2e]/92 dark:text-[#f5f5f7]">
              <Icon size={18} strokeWidth={2} style={{ color }} className="mt-px shrink-0" aria-hidden />
              <span>{t.msg}</span>
            </div>
          )
        })}
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
