import { Card } from '@/components/ui'

/** Placeholder: el dashboard real se construye en la Fase 4. */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Inicio</h1>
      <Card>
        <p className="text-slate-700 dark:text-slate-300">
          ¡Tu cuenta está lista! Ya creamos tus categorías por defecto. Las cuentas, transacciones y el
          dashboard llegan en las próximas fases.
        </p>
      </Card>
    </div>
  )
}
