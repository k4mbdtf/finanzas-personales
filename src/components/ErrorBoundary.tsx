// Evita la pantalla en blanco ante un error inesperado de la interfaz.
import { Component, type ReactNode } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="grid size-14 place-items-center rounded-lg bg-subtle text-ink" aria-hidden>
          <TriangleAlert size={26} strokeWidth={1.5} />
        </span>
        <h1 className="text-xl font-bold tracking-tight">Algo salió mal</h1>
        <p className="text-soft">Ocurrió un error inesperado. Tus datos están a salvo.</p>
        <button onClick={() => window.location.reload()}
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
          <RotateCw size={18} strokeWidth={2} aria-hidden /> Recargar la aplicación
        </button>
      </div>
    )
  }
}
