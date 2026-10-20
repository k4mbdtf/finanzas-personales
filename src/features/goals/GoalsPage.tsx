import { useState } from 'react'
import { ArrowLeftRight, ChevronDown, CircleCheck, PartyPopper, Pencil, PiggyBank, Plus, TriangleAlert } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { listGoals } from '@/data/goals'
import { useQuery } from '@/hooks/useQuery'
import { formatCLP, formatDate, todayISO } from '@/lib/format'
import { goalStatus } from '@/lib/goals'
import { IconTile, categoryIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressBar'
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from '@/components/ui'
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
        <Card pad="sm" className="flex h-full flex-col gap-4 md:p-5">
          <div className="flex items-start gap-3">
            <IconTile icon={s.done ? PartyPopper : categoryIcon(g.icon)} color={g.color} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{g.name}</p>
              <p className="text-[0.8125rem] text-muted">
                {linked ? `Saldo de ${linked.name}` : 'Abonos manuales'}
                {g.target_date && ` · para el ${formatDate(g.target_date)}`}
              </p>
            </div>
            <span className="text-[0.9375rem] font-bold tabular-nums">{s.pct}%</span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="flex items-baseline gap-1.5">
              <span className="figure-hero text-[1.375rem] leading-tight">{formatCLP(Math.max(0, g.saved))}</span>
              <span className="text-sm text-muted">de {formatCLP(g.target_amount)}</span>
            </p>
            <ProgressBar pct={s.pct} label={`${g.name}: ${s.pct}% de la meta`} barClass={s.done ? 'bg-pos-bar' : 'bg-ink'} thick />
          </div>
          <p className={`flex items-start gap-1.5 text-xs leading-relaxed ${s.done ? 'font-medium text-pos' : s.overdue ? 'font-medium text-warn' : 'text-muted'}`}>
            {s.done && <CircleCheck size={14} strokeWidth={2.25} className="mt-px shrink-0" aria-hidden />}
            {s.overdue && <TriangleAlert size={14} strokeWidth={2.25} className="mt-px shrink-0" aria-hidden />}
            <span>
              {s.done ? '¡Meta cumplida!'
                : s.overdue ? <>La fecha pasó; te faltan {formatCLP(s.remaining)}</>
                : s.perMonth ? <>Te faltan {formatCLP(s.remaining)}: ahorra ~{formatCLP(s.perMonth)} al mes</>
                : <>Te faltan {formatCLP(s.remaining)}</>}
            </span>
          </p>
          <div className="mt-auto flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setModal({ kind: 'edit', goal: g })}>Editar</Button>
            {!g.account_id && (
              <Button size="sm" icon={ArrowLeftRight} onClick={() => setModal({ kind: 'money', goal: g })}>Abonar o retirar</Button>
            )}
          </div>
        </Card>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Metas de ahorro"
        action={goals.length > 0 && <Button icon={Plus} onClick={() => setModal({ kind: 'edit' })}>Nueva meta</Button>} />

      {q.error && <Alert>{q.error}</Alert>}
      {q.loading && !q.data ? <Loading label="Cargando metas…" /> : goals.length === 0 ? (
        <EmptyState icon={PiggyBank} title="Ahorra para algo concreto"
          action={<Button icon={Plus} onClick={() => setModal({ kind: 'edit' })}>Nueva meta</Button>}>
          Vacaciones, fondo de emergencia, el pie de una casa… Define cuánto y para cuándo, y te diremos cuánto
          ahorrar cada mes.
        </EmptyState>
      ) : (
        <>
          <ul className="stagger grid gap-3 sm:grid-cols-2">{active.map(card)}</ul>
          {archived.length > 0 && (
            <section>
              <button className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
                aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Ocultar' : 'Ver'} metas archivadas ({archived.length})
                <ChevronDown size={16} strokeWidth={2} aria-hidden
                  className={`transition-transform duration-300 ease-soft ${showArchived ? 'rotate-180' : ''}`} />
              </button>
              {showArchived && <ul className="stagger mt-3 grid gap-3 opacity-75 sm:grid-cols-2">{archived.map(card)}</ul>}
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
