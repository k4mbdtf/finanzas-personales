import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { CategoryIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { Alert, Button, Loading, PageHeader, Segmented } from '@/components/ui'
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Categorías"
        action={<Button icon={Plus} onClick={() => setEditing('new')}>Nueva</Button>} />

      <div className="max-w-sm">
        <Segmented<CategoryKind> label="Tipo de categoría" value={kind} onChange={setKind}
          options={[{ value: 'expense', label: 'Gastos' }, { value: 'income', label: 'Ingresos' }]} />
      </div>

      {error && <Alert>{error}</Alert>}
      {loading ? <Loading label="Cargando categorías…" /> : (
        <>
          {/* key: al cambiar de tipo la grilla vuelve a entrar en cascada */}
          <CategoryGrid key={kind} items={active} onSelect={setEditing} />
          {active.length === 0 && (
            <p className="text-sm text-soft">No tienes categorías activas de este tipo.</p>
          )}
          {archived.length > 0 && (
            <section>
              <h2 className="label-caps mb-2 px-1">Archivadas</h2>
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
    <ul className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <li key={c.id}>
          <button onClick={() => onSelect(c)}
            className="card pressable flex w-full items-center gap-3 p-3 text-left transition-[border-color] duration-200 hover:border-line-strong/40">
            <CategoryIcon name={c.icon} color={c.color} />
            <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
            <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
