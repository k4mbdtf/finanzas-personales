// Modal basado en <dialog> nativo: foco atrapado, Escape y accesibilidad
// incluidos sin dependencias. En celular se muestra como hoja inferior.
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // showModal() mueve el foco al primer elemento enfocable (y React aplica
      // autoFocus antes de abrir). Por eso se enfoca aquí el campo marcado.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // Clic en el fondo (fuera del contenido) cierra el modal.
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 text-slate-900 shadow-xl
        backdrop:bg-black/50 dark:bg-slate-800 dark:text-slate-100
        md:m-auto md:max-w-lg md:rounded-2xl"
    >
      {open && (
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-full text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
