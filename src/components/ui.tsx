// Componentes base de UI. Pequeños a propósito: fáciles de leer y modificar.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
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

const inputCls = `min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900
  focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30
  aria-[invalid=true]:border-red-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100`

export function Field({
  label, hint, error, inputClassName = '', ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; inputClassName?: string }) {
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
        className={`${inputCls} ${inputClassName}`}
      />
      {hint && <p id={`${id}-hint`} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p id={`${id}-err`} className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  )
}

export function Select({
  label, error, children, ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      <select id={id} {...rest} aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined} className={inputCls}>
        {children}
      </select>
      {error && <p id={`${id}-err`} className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  )
}

/** Selector de opciones excluyentes (radio buttons con aspecto de pestañas). */
export function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; activeClass?: string }[]
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        {options.map((o) => {
          const active = o.value === value
          return (
            <label
              key={o.value}
              className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium transition
                has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600
                ${active
                  ? (o.activeClass ?? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white')
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            >
              <input type="radio" name={name} className="sr-only" checked={active} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Estado vacío con guía de primer uso. */
export function EmptyState({
  icon, title, children, action,
}: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-600">
      <span className="text-4xl" aria-hidden>{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{children}</div>}
      {action}
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
