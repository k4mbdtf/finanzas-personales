import { useState } from 'react'
import { useRefData } from '@/context/RefData'
import { listRules, materializeRecurring, updateRule } from '@/data/recurring'
import { useQuery } from '@/hooks/useQuery'
import { formatCLP, formatDate, todayISO } from '@/lib/format'
import { CalendarClock, Pause, Play, Plus, Repeat } from 'lucide-react'
import { firstOnOrAfter, frequencyLabel } from '@/lib/recurring'
import { useToast } from '@/components/Feedback'
import { CategoryIcon, IconTile, TransferIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { Alert, Button, EmptyState, Loading, PageHeader } from '@/components/ui'
import type { RecurringRule } from '@/types'
import { RecurringForm } from './RecurringForm'

const SIGN = {
  income: ['+', 'text-pos'],
  expense: ['−', 'text-neg'],
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
      <li key={r.id} className="border-b border-line last:border-0">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button onClick={() => setEditing(r)} className="pressable flex min-w-0 flex-1 items-center gap-3.5 text-left">
            {r.type === 'transfer' ? <IconTile icon={TransferIcon} /> : <CategoryIcon name={cat?.icon} color={cat?.color} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{title}</span>
              <span className="line-clamp-2 block text-[0.8125rem] text-muted">
                {frequencyLabel(r.frequency, r.interval_count, r.start_date)} · {account}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted">
                {r.active
                  ? <><CalendarClock size={13} strokeWidth={2} aria-hidden /> Próximo: {formatDate(r.next_date)}</>
                  : <><Pause size={13} strokeWidth={2} aria-hidden /> Pausado</>}
                {r.end_date && <> · hasta {formatDate(r.end_date)}</>}
              </span>
            </span>
            <span className={`shrink-0 text-[0.9375rem] font-semibold tabular-nums ${cls}`}>{sign}{formatCLP(r.amount)}</span>
          </button>
          <button onClick={() => toggle(r)}
            className="pressable grid size-10 shrink-0 place-items-center rounded-full border border-line-strong/45 text-soft hover:bg-subtle hover:text-ink"
            aria-label={r.active ? `Pausar ${title}` : `Reactivar ${title}`} title={r.active ? 'Pausar' : 'Reactivar'}>
            {r.active ? <Pause size={16} strokeWidth={2} aria-hidden /> : <Play size={16} strokeWidth={2} aria-hidden />}
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Recurrentes"
        subtitle={rules.length > 0 && (
          <>Efecto mensual estimado:{' '}
            <strong className={monthlyNet < 0 ? 'text-neg' : 'text-pos'}>
              {monthlyNet < 0 ? '−' : '+'}{formatCLP(Math.abs(monthlyNet))}
            </strong>{' '}(sin transferencias)</>
        )}
        action={rules.length > 0 && <Button icon={Plus} onClick={() => setEditing('new')}>Nuevo</Button>} />

      {q.error && <Alert>{q.error}</Alert>}
      {q.loading && !q.data ? <Loading label="Cargando recurrentes…" /> : rules.length === 0 ? (
        <EmptyState icon={Repeat} title="Automatiza lo que se repite"
          action={<Button icon={Plus} onClick={() => setEditing('new')}>Nuevo recurrente</Button>}>
          Sueldo, arriendo, cuentas, suscripciones o el ahorro mensual: créalos una vez y se registrarán solos en
          su fecha cada vez que abras la app.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 && (
            <ul className="card stagger overflow-hidden">
              {active.map(row)}
            </ul>
          )}
          {paused.length > 0 && (
            <section>
              <h2 className="label-caps mb-2 px-1">Pausados o terminados</h2>
              <ul className="card stagger overflow-hidden opacity-80">
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
