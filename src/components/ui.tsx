// Componentes base de UI. Pequeños a propósito: fáciles de leer y modificar.
// Estilo: suizo (jerarquía tipográfica, formas rectas, neutros) + comodidad
// tipo Apple (respuesta táctil, transiciones suaves, objetivos de 44 px).
import {
  useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react'
import { ChevronDown, CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  loading?: boolean
}

const BUTTON_VARIANT = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-[0_1px_2px_rgb(0_0_0/0.10)]',
  secondary: 'border-[1.5px] border-line-strong/45 bg-surface text-ink hover:bg-subtle',
  ghost: 'text-ink hover:bg-subtle',
  danger: 'bg-neg text-on-neg hover:opacity-90',
} as const

const BUTTON_SIZE = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-[0.9375rem] gap-2',
  lg: 'min-h-12 px-5 text-base gap-2',
} as const

export function Button({
  variant = 'primary', size = 'md', icon: Icon, loading, children, className = '', disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`pressable relative inline-flex select-none items-center justify-center rounded-sm font-semibold
        tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50
        ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    >
      <span className={`inline-flex items-center gap-[inherit] ${loading ? 'opacity-0' : ''}`}>
        {Icon && <Icon size={size === 'sm' ? 16 : 18} strokeWidth={2} aria-hidden />}
        {children}
      </span>
      {loading && <Dots />}
    </button>
  )
}

/** Indicador de actividad en botones (tres puntos; sin spinner circular). */
function Dots() {
  return (
    <span className="absolute inset-0 grid place-items-center" aria-hidden>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 rounded-full bg-current"
            style={{ animation: `dots 1s ease-in-out ${i * 0.15}s infinite both` }} />
        ))}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------
// Carga: esqueletos con brillo (no spinners)
// ---------------------------------------------------------------------
export function Loading({ label = 'Cargando…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3" aria-hidden style={{ opacity: 1 - i * 0.18 }}>
          <span className="skeleton size-10 shrink-0 rounded-lg" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skeleton h-3.5 w-2/5" />
            <span className="skeleton h-3 w-3/5" />
          </span>
          <span className="skeleton h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------
const inputCls = `min-h-11 w-full rounded-sm border border-line-strong/70 bg-surface px-3 text-base text-ink
  placeholder:text-muted/60 transition-[border-color,box-shadow] duration-200 ease-out
  hover:border-line-strong focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10
  aria-[invalid=true]:border-neg aria-[invalid=true]:focus:ring-neg/15`

const labelCls = 'text-[0.8125rem] font-medium text-soft'

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-neg">
      <CircleAlert size={15} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Field({
  label, hint, error, inputClassName = '', ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; inputClassName?: string }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${inputCls} ${inputClassName}`}
      />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  )
}

export function Select({
  label, error, children, ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="relative">
        <select id={id} {...rest} aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`${inputCls} appearance-none pr-10`}>
          {children}
        </select>
        <ChevronDown size={18} strokeWidth={2} aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
      </div>
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  )
}

/** Casilla de verificación con texto (objetivo táctil cómodo). */
export function Checkbox({
  label, hint, checked, onChange,
}: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-xs accent-[var(--accent)]" />
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------
// Selector segmentado con indicador deslizante (como en iOS)
// ---------------------------------------------------------------------
type Tone = 'neutral' | 'accent' | 'pos' | 'neg'
const TONE_BG: Record<Tone, string> = { neutral: 'bg-surface', accent: 'bg-accent', pos: 'bg-pos', neg: 'bg-neg' }
const TONE_TEXT: Record<Tone, string> = { neutral: 'text-ink', accent: 'text-on-accent', pos: 'text-on-pos', neg: 'text-on-neg' }

export function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; icon?: LucideIcon; tone?: Tone }[]
  onChange: (v: T) => void
}) {
  const name = useId()
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const tone = options[index]?.tone ?? 'neutral'
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="relative grid auto-cols-fr grid-flow-col rounded-md bg-subtle p-1">
        <span aria-hidden
          className={`absolute inset-y-1 left-1 rounded-sm shadow-[0_1px_3px_rgb(0_0_0/0.12)] transition-[transform,background-color] duration-300 ease-soft ${TONE_BG[tone]}`}
          style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }} />
        {options.map((o) => {
          const active = o.value === value
          const Icon = o.icon
          return (
            <label key={o.value}
              className={`relative z-10 flex min-h-10 cursor-pointer select-none items-center justify-center gap-1.5 rounded-sm px-2
                text-sm font-medium transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1
                has-[:focus-visible]:outline-ink ${active ? TONE_TEXT[o.tone ?? 'neutral'] : 'text-muted hover:text-ink'}`}>
              <input type="radio" name={name} className="sr-only" checked={active} onChange={() => onChange(o.value)} />
              {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

// ---------------------------------------------------------------------
// Contenedores y estados
// ---------------------------------------------------------------------
export function Card({
  children, className = '', pad = 'md',
}: { children: ReactNode; className?: string; pad?: 'none' | 'sm' | 'md' }) {
  const p = { none: '', sm: 'p-4', md: 'p-5 md:p-6' }[pad]
  return <div className={`card ${p} ${className}`}>{children}</div>
}

/** Encabezado de página: título grande (y acción opcional a la derecha). */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="title-page">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  )
}

/** Título de sección con acción opcional (p. ej. "Ver todos"). */
export function SectionHeader({ title, action, icon: Icon, iconClass = '' }: {
  title: string; action?: ReactNode; icon?: LucideIcon; iconClass?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
        {Icon && <Icon size={18} strokeWidth={2} className={iconClass} aria-hidden />}
        {title}
      </h2>
      {action && <div className="shrink-0 text-sm">{action}</div>}
    </div>
  )
}

/** Enlace con aspecto de botón principal (para navegar, no para acciones). */
export const buttonLinkCls =
  'pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent px-4 text-[0.9375rem] font-semibold tracking-[-0.01em] text-on-accent hover:bg-accent-hover'

/** Estado vacío con guía de primer uso (ícono + texto + acción). */
export function EmptyState({
  icon: Icon, title, children, action,
}: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="animate-enter flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong/40 bg-surface/60 px-6 py-12 text-center">
      <span className="mb-1 grid size-14 place-items-center rounded-lg bg-subtle text-ink" aria-hidden>
        <Icon size={26} strokeWidth={1.5} />
      </span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children && <div className="max-w-sm text-sm leading-relaxed text-soft">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Mensaje de estado con ícono (no depende solo del color). */
export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info' | 'warning'; children: ReactNode }) {
  const map = {
    error: [CircleAlert, 'border-neg/25 bg-neg-soft', 'text-neg'],
    warning: [CircleAlert, 'border-warn/25 bg-warn-soft', 'text-warn'],
    success: [CircleCheck, 'border-pos/25 bg-pos-soft', 'text-pos'],
    info: [Info, 'border-line bg-info-soft', 'text-soft'],
  } as const
  const [Icon, box, iconCls] = map[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'}
      className={`animate-fade flex gap-2.5 rounded-sm border px-3.5 py-3 text-sm leading-relaxed text-ink ${box}`}>
      <Icon size={18} strokeWidth={2} className={`mt-px shrink-0 ${iconCls}`} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Etiqueta pequeña de estado. */
export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'pos' | 'neg' | 'warn'; children: ReactNode }) {
  const cls = {
    neutral: 'bg-subtle text-soft',
    pos: 'bg-pos-soft text-pos',
    neg: 'bg-neg-soft text-neg',
    warn: 'bg-warn-soft text-warn',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>
}

/** Marca de la app: cuadrado carbón con "$" + nombre. */
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-sm bg-accent text-[15px] font-bold text-on-accent" aria-hidden>$</span>
      {!compact && <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">Mis Finanzas</span>}
    </span>
  )
}

export function FullScreenLoader() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <span className="sr-only">Cargando la aplicación…</span>
      <div className="flex flex-col items-center gap-5" aria-hidden>
        <Logo />
        <span className="relative block h-0.5 w-36 overflow-hidden rounded-full bg-subtle">
          <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-ink"
            style={{ animation: 'indeterminate 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} />
        </span>
      </div>
    </div>
  )
}
