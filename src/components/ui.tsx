// Componentes base de UI. Pequeños a propósito: fáciles de leer y modificar.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'

export function Button({
  variant = 'primary', loading, children, className = '', disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}) {
  const styles = {
    primary: 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    danger: 'bg-red-700 text-white hover:bg-red-800',
  }[variant]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-medium transition
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600
        disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      <span className="sr-only">{label ?? 'Cargando…'}</span>
    </span>
  )
}

export function Field({
  label, hint, error, ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900
          focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30
          aria-[invalid=true]:border-red-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
      {hint && <p id={`${id}-hint`} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p id={`${id}-err`} className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  )
}

/** Mensaje de estado. Incluye ícono de texto para no depender solo del color. */
export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const map = {
    error: ['⚠️', 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'],
    success: ['✅', 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100'],
    info: ['ℹ️', 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100'],
  } as const
  const [icon, cls] = map[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg border p-3 text-sm ${cls}`}>
      <span aria-hidden>{icon}</span>
      <div>{children}</div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {children}
    </div>
  )
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center text-slate-600 dark:text-slate-300">
      <Spinner label="Cargando la aplicación…" />
    </div>
  )
}
