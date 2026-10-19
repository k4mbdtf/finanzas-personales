// Crear / editar una categoría (nombre, tipo, ícono, color, archivar).
import { useState, type FormEvent } from 'react'
import { useRefData } from '@/context/RefData'
import { createCategory, deleteCategory, updateCategory } from '@/data/categories'
import { AppError } from '@/lib/errors'
import { COLORS, iconFor } from '@/lib/icons'
import { useConfirm, useToast } from '@/components/Feedback'
import { ColorPicker, IconPicker } from '@/components/Pickers'
import { Alert, Button, Field, Segmented } from '@/components/ui'
import type { Category, CategoryKind } from '@/types'

export function CategoryForm({
  category, defaultKind, onDone,
}: { category?: Category; defaultKind: CategoryKind; onDone: () => void }) {
  const { categories } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind)
  const [icon, setIcon] = useState(category?.icon ?? 'tag')
  const [color, setColor] = useState(category?.color ?? COLORS[0])
  const [archived, setArchived] = useState(category?.archived ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Ponle un nombre a la categoría.')
    setError('')
    setBusy(true)
    try {
      if (category) {
        await updateCategory(category.id, { name: name.trim(), icon, color, archived })
      } else {
        // Las nuevas van al final de su grupo.
        const maxOrder = Math.max(0, ...categories.filter((c) => c.kind === kind).map((c) => c.sort_order))
        await createCategory({ name: name.trim(), kind, icon, color, archived: false, sort_order: maxOrder + 1 })
      }
      toast(category ? 'Categoría actualizada' : 'Categoría creada')
      onDone()
    } catch (err) {
      setError(
        err instanceof AppError && err.code === '23505'
          ? `Ya tienes una categoría de ${kind === 'expense' ? 'gasto' : 'ingreso'} llamada "${name.trim()}".`
          : err instanceof Error ? err.message : 'No se pudo guardar.',
      )
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!category) return
    const ok = await confirm({
      title: 'Eliminar categoría',
      message: (
        <>
          <p>¿Eliminar <strong>{category.name}</strong>?</p>
          <ul className="mt-2 list-disc pl-5">
            <li>Sus movimientos quedarán como <strong>Sin categoría</strong> (no se borran).</li>
            <li>Se eliminarán sus presupuestos.</li>
          </ul>
          <p className="mt-2">Si solo quieres ocultarla, mejor archívala.</p>
        </>
      ),
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCategory(category.id)
      toast('Categoría eliminada')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900" aria-hidden>
        <span className="grid size-12 place-items-center rounded-full text-2xl" style={{ backgroundColor: `${color}33` }}>
          {iconFor(icon)}
        </span>
        <span className="font-semibold">{name.trim() || 'Vista previa'}</span>
      </div>

      <Field label="Nombre" required maxLength={40} data-autofocus={!category || undefined}
        placeholder="Ej: Café, Gimnasio" value={name} onChange={(e) => setName(e.target.value)} />

      {category ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Tipo: <strong>{category.kind === 'expense' ? 'Gasto' : 'Ingreso'}</strong> (no se puede cambiar después de crearla).
        </p>
      ) : (
        <Segmented<CategoryKind> label="Tipo de categoría" value={kind} onChange={setKind}
          options={[{ value: 'expense', label: '− Gasto' }, { value: 'income', label: '+ Ingreso' }]} />
      )}

      <IconPicker value={icon} onChange={setIcon} color={color} />
      <ColorPicker value={color} onChange={setColor} />

      {category && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="size-4" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Archivar (no aparece al registrar movimientos; conserva el historial)
        </label>
      )}

      <Button type="submit" loading={busy}>{category ? 'Guardar cambios' : 'Crear categoría'}</Button>
      {category && <Button type="button" variant="secondary" onClick={onDelete}>Eliminar categoría</Button>}
    </form>
  )
}
