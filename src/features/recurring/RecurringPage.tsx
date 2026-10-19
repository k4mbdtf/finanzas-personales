import { useState } from 'react'
import { useRefData } from '@/context/RefData'
import { listRules, materializeRecurring, updateRule } from '@/data/recurring'
import { useQuery } from '@/hooks/useQuery'
import { formatCLP, formatDate, todayISO } from '@/lib/format'
import { iconFor } from '@/lib/icons'
import { firstOnOrAfter, frequencyLabel } from '@/lib/recurring'
import { useToast } from '@/components/Feedback'
import { Modal } from '@/components/Modal'
import { Alert, Button, EmptyState, Spinner } from '@/components/ui'
import type { RecurringRule } from '@/types'
import { RecurringForm } from './RecurringForm'

const SIGN = {
  income: ['+', 'text-green-700 dark:text-green-400'],
  expense: ['−', 'text-red-700 dark:text-red-400'],
  transfer: ['', ''],
} as const

/** Equivalente mensual aproximado de una regla (para el resumen). */
function perMonth(r: RecurringRule): number {
  if (r.frequency === 'monthly') return r.amount / r.interval_count
  if (r.frequency === 'weekly') return (r.amount * 52) / 12 / r.interval_count
  return r.amount / 12 / r.interval_count
}

export default function RecurringPage() {
  const { categoryById, accountById } = useRefData()
  const toast = useToast()
  const q = useQuery(listRules, [], ['recurring'])
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null)

  const rules = q.data ?? []
  const active = rules.filter((r) => r.active)
  const paused = rules.filter((r) => !r.active)
  const monthlyNet = active.reduce(
    (s, r) => (r.type === 'transfer' ? s : s + (r.type === 'income' ? perMonth(r) : -perMonth(r))), 0)

  async function toggle(r: RecurringRule) {
    try {
      if (r.active) {
        await updateRule(r.id, { active: false })
        toast('Pausado')
        return
      }
      // Al reactivar no se rellenan las fechas que pasaron mientras estaba pausado:
      // se reprograma desde la próxima fecha a partir de hoy.
      const next = firstOnOrAfter(r, r.occurrence_count, todayISO())
      if (!next) {
        toast('Este recurrente ya terminó (su fecha de término pasó). Edítalo para extenderlo.', 'warning')
        return
      }
      await updateRule(r.id, next === r.next_date
        ? { active: true }
        : { active: true, start_date: next, occurrence_count: 0 })
      const created = await materializeRecurring()
      toast(created > 0 ? `Reactivado. Se registró el de hoy` : `Reactivado: próximo el ${formatDate(next)}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo cambiar', 'error')
    }
  }

  const row = (r: RecurringRule) => {
    const cat = r.category_id ? categoryById.get(r.category_id) : undefined
    const [sign, cls] = SIGN[r.type]
    const title = r.note || (r.type === 'transfer' ? 'Transferencia' : cat?.name ?? 'Sin categoría')
    const account = r.type === 'transfer'
      ? `${accountById.get(r.account_id)?.name ?? ''} → ${accountById.get(r.to_account_id ?? '')?.name ?? ''}`
      : accountById.get(r.account_id)?.name ?? ''
    return (
      <li key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setEditing(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-full text-lg" aria-hidden
              style={{ backgroundColor: `${cat?.color ?? '#64748b'}26` }}>
              {r.type === 'transfer' ? '⇄' : iconFor(cat?.icon)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{title}</span>
              <span className="line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
                {frequencyLabel(r.frequency, r.interval_count, r.start_date)} · {account}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {r.active ? <>Próximo: {formatDate(r.next_date)}</> : <>⏸ Pausado</>}
                {r.end_date && <> · hasta {formatDate(r.end_date)}</>}
              </span>
            </span>
            <span className={`shrink-0 font-semibold tabular-nums ${cls}`}>{sign}{formatCLP(r.amount)}</span>
          </button>
          <button onClick={() => toggle(r)}
            className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
            aria-label={r.active ? `Pausar ${title}` : `Reactivar ${title}`}>
            {r.active ? '⏸ Pausar' : '▶ Activar'}
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Recurrentes</h1>
        {rules.length > 0 && <Button onClick={() => setEditing('new')}>+ Nuevo</Button>}
      </div>

      {q.error && <Alert>{q.error}</Alert>}
      {q.loading && !q.data ? <Spinner label="Cargando recurrentes…" /> : rules.length === 0 ? (
        <EmptyState icon="🔁" title="Automatiza lo que se repite"
          action={<Button onClick={() => setEditing('new')}>+ Nuevo recurrente</Button>}>
          Sueldo, arriendo, cuentas, suscripciones o el ahorro mensual: créalos una vez y se registrarán solos en
          su fecha cada vez que abras la app.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Efecto mensual estimado de los activos:{' '}
            <strong className={monthlyNet < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>
              {monthlyNet < 0 ? '−' : '+'}{formatCLP(Math.abs(monthlyNet))}
            </strong>{' '}
            (sin transferencias)
          </p>
          {active.length > 0 && (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              {active.map(row)}
            </ul>
          )}
          {paused.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Pausados o terminados</h2>
              <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white opacity-80 dark:border-slate-700 dark:bg-slate-800">
                {paused.map(row)}
              </ul>
            </section>
          )}
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nuevo recurrente' : 'Editar recurrente'}>
        {editing && <RecurringForm rule={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}
