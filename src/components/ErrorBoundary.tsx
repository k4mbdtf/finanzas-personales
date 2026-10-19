// Evita la pantalla en blanco ante un error inesperado de la interfaz.
import { Component, type ReactNode } from 'react'

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
        <p className="text-4xl" aria-hidden>😵</p>
        <h1 className="text-xl font-bold">Algo salió mal</h1>
        <p className="text-slate-600 dark:text-slate-300">Ocurrió un error inesperado. Tus datos están a salvo.</p>
        <button onClick={() => window.location.reload()}
          className="min-h-11 rounded-lg bg-teal-700 px-4 font-medium text-white hover:bg-teal-800">
          Recargar la aplicación
        </button>
      </div>
    )
  }
}
