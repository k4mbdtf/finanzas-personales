// Modal basado en <dialog> nativo: foco atrapado, Escape y accesibilidad
// incluidos sin dependencias. En celular es una hoja que sube desde abajo
// (curva de iOS); en escritorio, una ventana centrada. Al cerrar se anima la
// salida y se mantiene el último contenido visible mientras se va.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { prefersReducedMotion } from '@/lib/motion'

const EXIT_MS = 240

export function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [closing, setClosing] = useState(false)
  // Contenido "congelado" para la animación de salida (el padre ya lo quitó).
  const last = useRef<{ title: string; children: ReactNode }>({ title, children })
  if (open) last.current = { title, children }

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      setClosing(false)
      if (!d.open) {
        d.showModal()
        // showModal() enfoca el primer elemento; preferimos el campo marcado.
        d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
      }
      return
    }
    if (d.open) {
      setClosing(true)
      const t = window.setTimeout(() => { d.close(); setClosing(false) }, prefersReducedMotion() ? 0 : EXIT_MS)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const visible = open || closing
  const shown = open ? { title, children } : last.current

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-closing={closing || undefined}
      // Escape: animamos el cierre en vez de cerrar de golpe.
      onCancel={(e) => { e.preventDefault(); onClose() }}
      // Clic en el fondo (fuera del contenido) cierra el modal.
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-lg border-0 bg-surface p-0 text-ink shadow-[var(--shadow-float)]
        md:m-auto md:max-w-lg md:rounded-lg"
    >
      {visible && (
        <div className="px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-6 md:pt-5">
          <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-center justify-between gap-2 bg-surface px-5 pt-1 pb-3 md:-mx-6 md:px-6">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">{shown.title}</h2>
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="pressable grid size-9 place-items-center rounded-full bg-subtle text-muted hover:text-ink">
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
          {shown.children}
        </div>
      )}
    </dialog>
  )
}
