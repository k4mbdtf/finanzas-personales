import { useState } from 'react'
import { useRefData } from '@/context/RefData'
import { listGoals } from '@/data/goals'
import { useQuery } from '@/hooks/useQuery'
import { formatCLP, formatDate, todayISO } from '@/lib/format'
import { goalStatus } from '@/lib/goals'
import { iconFor } from '@/lib/icons'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressBar'
import { Alert, Button, Card, EmptyState, Spinner } from '@/components/ui'
import type { GoalWithProgress } from '@/types'
import { ContributionForm } from './ContributionForm'
import { GoalForm } from './GoalForm'

type ModalState = { kind: 'edit'; goal?: GoalWithProgress } | { kind: 'money'; goal: GoalWithProgress } | null

export default function GoalsPage() {
  const { accountById } = useRefData()
  const q = useQuery(listGoals, [], ['goals', 'accounts', 'transactions'])
  const [modal, setModal] = useState<ModalState>(null)
  const [showArchived, setShowArchived] = useState(false)
  const today = todayISO()

  const goals = q.data ?? []
  const active = goals.filter((g) => !g.archived)
  const archived = goals.filter((g) => g.archived)

  const card = (g: GoalWithProgress) => {
    const s = goalStatus(g.saved, g.target_amount, g.target_date, today)
    const linked = g.account_id ? accountById.get(g.account_id) : undefined
    return (
      <li key={g.id}>
        <Card className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full text-xl" style={{ backgroundColor: `${g.color}33` }} aria-hidden>
              {s.done ? '🎉' : iconFor(g.icon)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{g.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {linked ? `Saldo de ${linked.name}` : 'Abonos manuales'}
                {g.target_date && ` · para el ${formatDate(g.target_date)}`}
              </p>
            </div>
            <span className="text-sm font-bold tabular-nums">{s.pct}%</span>
          </div>
          <ProgressBar pct={s.pct} label={`${g.name}: ${s.pct}% de la meta`} barClass={s.done ? 'bg-green-600' : 'bg-teal-600'} />
          <p className="text-sm">
            <strong className="tabular-nums">{formatCLP(Math.max(0, g.saved))}</strong>
            <span className="text-slate-500 dark:text-slate-400"> de {formatCLP(g.target_amount)}</span>
          </p>
          <p className={`text-xs ${s.overdue ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}`}>
            {s.done ? '¡Meta cumplida!'
              : s.overdue ? <><span aria-hidden>⚠️ </span>La fecha pasó; te faltan {formatCLP(s.remaining)}</>
              : s.perMonth ? <>Te faltan {formatCLP(s.remaining)}: ahorra ~{formatCLP(s.perMonth)} al mes</>
              : <>Te faltan {formatCLP(s.remaining)}</>}
          </p>
          <div className="mt-auto flex flex-wrap justify-end gap-2">
            <Button variant="secondary" className="min-h-9 text-sm" onClick={() => setModal({ kind: 'edit', goal: g })}>Editar</Button>
            {!g.account_id && (
              <Button className="min-h-9 text-sm" onClick={() => setModal({ kind: 'money', goal: g })}>Abonar / retirar</Button>
            )}
          </div>
        </Card>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Metas de ahorro</h1>
        {goals.length > 0 && <Button onClick={() => setModal({ kind: 'edit' })}>+ Nueva meta</Button>}
      </div>

      {q.error && <Alert>{q.error}</Alert>}
      {q.loading && !q.data ? <Spinner label="Cargando metas…" /> : goals.length === 0 ? (
        <EmptyState icon="🐷" title="Ahorra para algo concreto"
          action={<Button onClick={() => setModal({ kind: 'edit' })}>+ Nueva meta</Button>}>
          Vacaciones, fondo de emergencia, el pie de una casa… Define cuánto y para cuándo, y te diremos cuánto
          ahorrar cada mes.
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">{active.map(card)}</ul>
          {archived.length > 0 && (
            <section>
              <button className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
                aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Ocultar' : 'Ver'} metas archivadas ({archived.length})
              </button>
              {showArchived && <ul className="mt-3 grid gap-3 opacity-75 sm:grid-cols-2">{archived.map(card)}</ul>}
            </section>
          )}
        </>
      )}

      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={modal?.kind === 'money' ? modal.goal.name : modal?.goal ? 'Editar meta' : 'Nueva meta'}>
        {modal?.kind === 'edit' && <GoalForm goal={modal.goal} onDone={() => setModal(null)} />}
        {modal?.kind === 'money' && <ContributionForm goal={modal.goal} onDone={() => setModal(null)} />}
      </Modal>
    </div>
  )
}
