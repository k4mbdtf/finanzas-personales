import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, Logo } from '@/components/ui'

/** Contenedor común de las pantallas públicas (login, registro, etc.). */
export function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="animate-page mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-6 text-center">
        <Logo />
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.03em]">{title}</h1>
      </header>
      <Card>{children}</Card>
      {footer && <div className="text-center text-sm text-soft">{footer}</div>}
      <p className="text-center text-xs text-muted">
        <Link to="/privacidad" className="link font-normal">Privacidad</Link>
      </p>
    </main>
  )
}

export const linkCls = 'link'
