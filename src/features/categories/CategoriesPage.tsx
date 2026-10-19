import { useState } from 'react'
import { useRefData } from '@/context/RefData'
import { iconFor } from '@/lib/icons'
import { Modal } from '@/components/Modal'
import { Alert, Button, Segmented, Spinner } from '@/components/ui'
import type { Category, CategoryKind } from '@/types'
import { CategoryForm } from './CategoryForm'

export default function CategoriesPage() {
  const { categories, loading, error } = useRefData()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const list = categories.filter((c) => c.kind === kind)
  const active = list.filter((c) => !c.archived)
  const archived = list.filter((c) => c.archived)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Categorías</h1>
        <Button onClick={() => setEditing('new')}>+ Nueva</Button>
      </div>

      <Segmented<CategoryKind> label="Tipo de categoría" value={kind} onChange={setKind}
        options={[{ value: 'expense', label: '− Gastos' }, { value: 'income', label: '+ Ingresos' }]} />

      {error && <Alert>{error}</Alert>}
      {loading ? <Spinner label="Cargando categorías…" /> : (
        <>
          <CategoryGrid items={active} onSelect={setEditing} />
          {active.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">No tienes categorías activas de este tipo.</p>
          )}
          {archived.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Archivadas</h2>
              <div className="opacity-70"><CategoryGrid items={archived} onSelect={setEditing} /></div>
            </section>
          )}
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nueva categoría' : 'Editar categoría'}>
        <CategoryForm
          category={editing && editing !== 'new' ? editing : undefined}
          defaultKind={kind}
          onDone={() => setEditing(null)}
        />
      </Modal>
    </div>
  )
}

function CategoryGrid({ items, onSelect }: { items: Category[]; onSelect: (c: Category) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((c) => (
        <li key={c.id}>
          <button onClick={() => onSelect(c)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800">
            <span className="grid size-10 shrink-0 place-items-center rounded-full text-lg" style={{ backgroundColor: `${c.color}33` }} aria-hidden>
              {iconFor(c.icon)}
            </span>
            <span className="min-w-0 truncate font-medium">{c.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
