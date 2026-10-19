import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'

/** Contenedor común de las pantallas públicas (login, registro, etc.). */
export function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <p className="text-3xl" aria-hidden>💰</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      </header>
      <Card>{children}</Card>
      {footer && <div className="text-center text-sm text-slate-600 dark:text-slate-300">{footer}</div>}
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        <Link to="/privacidad" className="underline">Privacidad</Link>
      </p>
    </main>
  )
}

export const linkCls = 'font-medium text-teal-700 underline dark:text-teal-400'
