// Reglas automáticas: "si la descripción contiene X, usa la categoría Y". Se aplican al
// importar cartolas y, a pedido, a los movimientos que quedaron sin categoría.
import { useState, type FormEvent } from 'react'
import { ArrowRight, Trash2, Wand2 } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { assignCategories, createCategoryRule, deleteCategoryRule, listCategoryRules, uncategorized } from '@/data/rules'
import { useQuery } from '@/hooks/useQuery'
import { matchRule } from '@/lib/rules'
import { CategoryIcon } from '@/components/icons'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, Card, Field, Loading, SectionHeader, Select } from '@/components/ui'

export function RulesSection() {
  const { categories, categoryById } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  const q = useQuery(listCategoryRules, [], ['rules', 'categories'])
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const kindOf = (id: string) => categoryById.get(id)?.kind
  const active = categories.filter((c) => !c.archived)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (pattern.trim().length < 2) return setError('Escribe al menos 2 letras.')
    if (!categoryId) return setError('Elige la categoría.')
    setError(''); setBusy(true)
    try {
      await createCategoryRule(pattern, categoryId)
      setPattern('')
      toast('Regla agregada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
    setBusy(false)
  }

  async function remove(id: string, text: string) {
    if (!(await confirm({ title: 'Eliminar regla', message: `¿Eliminar la regla «${text}»? Los movimientos ya categorizados no cambian.`, confirmLabel: 'Eliminar', danger: true }))) return
    try {
      await deleteCategoryRule(id)
      toast('Regla eliminada')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error')
    }
  }

  async function applyToUncategorized() {
    setBusy(true)
    try {
      const rules = q.data ?? []
      const byCategory = new Map<string, string[]>()
      for (const t of await uncategorized()) {
        const r = matchRule(rules, t.note, t.type, kindOf)
        if (r) byCategory.set(r.category_id, [...(byCategory.get(r.category_id) ?? []), t.id])
      }
      const total = [...byCategory.values()].reduce((s, ids) => s + ids.length, 0)
      if (total === 0) {
        toast('Ningún movimiento sin categoría calza con tus reglas.', 'warning')
      } else if (await confirm({
        title: 'Aplicar reglas',
        message: `${total} movimiento${total === 1 ? '' : 's'} sin categoría calza${total === 1 ? '' : 'n'} con tus reglas. ¿Asignarles la categoría?`,
        confirmLabel: 'Aplicar',
      })) {
        const n = await assignCategories(byCategory)
        toast(`Se categorizaron ${n} movimiento${n === 1 ? '' : 's'}`)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudieron aplicar las reglas.', 'error')
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="reglas" className="flex flex-col gap-3">
      <SectionHeader id="reglas" title="Reglas automáticas" icon={Wand2} />
      <p className="-mt-2 text-sm text-muted">
        Si la descripción de un movimiento contiene un texto, se le asigna la categoría. Se usan al importar cartolas
        y puedes aplicarlas a los movimientos sin categoría.
      </p>

      {q.error && <Alert>{q.error}</Alert>}
      {q.data === null ? (
        <Alert kind="info">
          Para usar reglas automáticas, ejecuta <code>supabase/migrations/0007_reglas.sql</code> en el SQL Editor de
          Supabase (una sola vez).
        </Alert>
      ) : !q.data ? <Loading rows={2} /> : (
        <>
          <Card pad="sm">
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
              <Field label="Si la descripción contiene" placeholder="Ej: UBER, Jumbo, Netflix" maxLength={60}
                value={pattern} onChange={(e) => setPattern(e.target.value)} />
              <Select label="Usar la categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Elegir…</option>
                <optgroup label="Gastos">
                  {active.filter((c) => c.kind === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
                <optgroup label="Ingresos">
                  {active.filter((c) => c.kind === 'income').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              </Select>
              <Button type="submit" loading={busy}>Agregar regla</Button>
            </form>
            {error && <p className="mt-2 text-sm font-medium text-neg">{error}</p>}
          </Card>

          {q.data.length > 0 && (
            <>
              <Card pad="none">
                <ul aria-label="Reglas">
                  {q.data.map((r) => {
                    const c = categoryById.get(r.category_id)
                    return (
                      <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-muted">contiene </span><strong>«{r.pattern}»</strong>
                        </span>
                        <ArrowRight size={16} strokeWidth={2} className="shrink-0 text-muted" aria-label="usa" />
                        <span className="flex min-w-0 items-center gap-2">
                          <CategoryIcon name={c?.icon} color={c?.color} size="sm" />
                          <span className="truncate text-sm font-medium">{c?.name ?? 'Categoría'}</span>
                        </span>
                        <button type="button" onClick={() => remove(r.id, r.pattern)} aria-label={`Eliminar la regla «${r.pattern}»`}
                          className="pressable grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle hover:text-neg">
                          <Trash2 size={16} strokeWidth={2} aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </Card>
              <div>
                <Button variant="ghost" icon={Wand2} onClick={applyToUncategorized} loading={busy}>
                  Aplicar a movimientos sin categoría
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
