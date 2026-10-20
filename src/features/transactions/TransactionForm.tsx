// Formulario de transacción, pensado para registrar un gasto en < 10 segundos:
//   1) el monto tiene el foco y abre el teclado numérico,
//   2) la categoría se elige con un toque,
//   3) la cuenta recuerda la última usada y la fecha parte en "Hoy".
// Nota y etiquetas quedan en "Más detalles".
// Solo se eligen cuentas de dinero. Los pagos, cobros, aportes y rescates de
// deudas e inversiones también usan este formulario, con esa parte fija.
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Trash2, Wallet } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { TRANSFER_LABEL, isTrackedType, transferKind, type TransferKind } from '@/lib/accounts'
import { ACCOUNT_TYPES } from '@/lib/icons'
import { createTransaction, deleteTransaction, parseTags, updateTransaction } from '@/data/transactions'
import { budgetUsage } from '@/data/budgets'
import { budgetStatus } from '@/lib/budget'
import { addDays } from '@/lib/dates'
import { todayISO } from '@/lib/format'
import { AmountInput } from '@/components/AmountInput'
import { CategoryPicker } from '@/components/CategoryPicker'
import { AccountIcon } from '@/components/icons'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, EmptyState, Field, Segmented, Select, Loading } from '@/components/ui'
import type { AccountWithBalance, Transaction, TxInput, TxType } from '@/types'

const LAST_ACCOUNT_KEY = 'finanzas.lastAccount'

/** Por qué un pago o aporte no cambia los ingresos ni los gastos del mes. */
const FLOW_HINT: Partial<Record<TransferKind, string>> = {
  debt_payment: 'No cuenta como gasto: baja lo que debes.',
  loan_received: 'No cuenta como ingreso: suma a lo que debes.',
  lent: 'No cuenta como gasto: queda como dinero que te deben.',
  collected: 'No cuenta como ingreso: es dinero que te devuelven.',
  contribution: 'No cuenta como gasto: es dinero que inviertes.',
  withdrawal: 'No cuenta como ingreso: es dinero que sacas de tu inversión.',
}

function readLastAccount(): string | null {
  try { return localStorage.getItem(LAST_ACCOUNT_KEY) } catch { return null }
}

type Props = { tx?: Transaction; preset?: Partial<TxInput>; onDone: () => void }

/** Espera a que estén las cuentas antes de montar el formulario (sus valores
 *  por defecto dependen de ellas). */
export function TransactionForm({ tx, preset, onDone }: Props) {
  const { accounts, loading } = useRefData()
  if (loading) return <Loading label="Cargando…" />
  if (!accounts.some((a) => !a.archived) && !tx) {
    return (
      <EmptyState icon={Wallet} title="Primero crea una cuenta"
        action={<Link to="/cuentas" onClick={onDone} className="link">Ir a Cuentas</Link>}>
        Los movimientos se registran en una cuenta (efectivo, banco, tarjeta…).
      </EmptyState>
    )
  }
  return <TransactionFormInner tx={tx} preset={preset} onDone={onDone} />
}

function TransactionFormInner({ tx, preset, onDone }: Props) {
  const { accounts, accountById, categories } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()

  // Valores iniciales: el movimiento en edición, o el preset (p. ej. "Registrar pago").
  const init: Partial<TxInput> = tx ?? preset ?? {}
  const initFrom = init.account_id ? accountById.get(init.account_id) : undefined
  const initTo = init.to_account_id ? accountById.get(init.to_account_id) : undefined
  // Pago, cobro, aporte o rescate: la deuda o inversión queda fija.
  const lockedTo = init.type === 'transfer' && initTo && isTrackedType(initTo.type) ? initTo : undefined
  const lockedFrom = init.type === 'transfer' && initFrom && isTrackedType(initFrom.type) ? initFrom : undefined
  const locked = lockedTo ?? lockedFrom
  // Movimiento antiguo que quedó con una deuda o inversión como cuenta de un gasto o ingreso.
  const misplaced = init.type !== 'transfer' && initFrom && isTrackedType(initFrom.type) ? initFrom : undefined

  // Solo cuentas de dinero (accounts); en edición se incluye la original aunque esté archivada.
  const usableAccounts = accounts.filter(
    (a) => !a.archived || a.id === init.account_id || a.id === init.to_account_id,
  )
  const lastUsed = (exclude?: string | null) => {
    const last = readLastAccount()
    const candidates = usableAccounts.filter((a) => !a.archived && a.id !== exclude)
    return candidates.find((a) => a.id === last)?.id ?? candidates[0]?.id ?? ''
  }
  // Si el preset fija el destino, el origen por defecto no puede ser esa misma cuenta.
  const defaultAccount = lastUsed(init.to_account_id)

  const [type, setType] = useState<TxType>(init.type ?? 'expense')
  const [amount, setAmount] = useState<number | null>(init.amount ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(init.category_id ?? null)
  // El origen se elige de nuevo si quedó en una deuda o inversión que no es la parte fija.
  const fromNeedsChoice = !!misplaced || (!!lockedTo && !!initFrom && isTrackedType(initFrom.type))
  const [accountId, setAccountId] = useState(fromNeedsChoice ? '' : init.account_id ?? defaultAccount)
  const [toAccountId, setToAccountId] = useState(
    init.to_account_id
      ?? (lockedFrom ? lastUsed() : usableAccounts.find((a) => !a.archived && a.id !== (init.account_id ?? defaultAccount))?.id ?? ''),
  )
  const flowKind = locked
    ? transferKind(accountById.get(accountId)?.type ?? lockedFrom?.type, accountById.get(toAccountId)?.type ?? lockedTo?.type)
    : null
  const [date, setDate] = useState(init.date ?? todayISO())
  const [note, setNote] = useState(init.note ?? '')
  const [tagsText, setTagsText] = useState(init.tags?.join(', ') ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const kindCats = useMemo(
    () => categories.filter((c) => c.kind === type && (!c.archived || c.id === tx?.category_id)),
    [categories, type, tx?.category_id],
  )

  const errors = {
    amount: !amount ? 'Ingresa un monto mayor a $0.' : '',
    category: type !== 'transfer' && !categoryId ? 'Elige una categoría.' : '',
    account: !accountId ? 'Elige una cuenta.' : '',
    toAccount: type === 'transfer' && (!toAccountId || toAccountId === accountId)
      ? (lockedFrom ? 'Elige la cuenta donde llega el dinero.' : 'Elige una cuenta de destino distinta a la de origen.') : '',
    date: !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Ingresa una fecha válida.' : '',
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : '')

  function changeType(t: TxType) {
    setType(t)
    // La categoría de gasto no sirve para un ingreso (y viceversa).
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat || cat.kind !== t) setCategoryId(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors) return
    setError('')
    setBusy(true)
    const input: TxInput = {
      type,
      amount: amount!,
      date,
      account_id: accountId,
      to_account_id: type === 'transfer' ? toAccountId : null,
      category_id: type === 'transfer' ? null : categoryId,
      note: note.trim() || null,
      tags: parseTags(tagsText),
    }
    try {
      if (tx) await updateTransaction(tx.id, input)
      else await createTransaction(input)
      try { localStorage.setItem(LAST_ACCOUNT_KEY, lockedFrom ? toAccountId : accountId) } catch { /* ignorar */ }
      toast(tx ? 'Movimiento actualizado' : flowKind ? `${TRANSFER_LABEL[flowKind]} guardado` : 'Movimiento guardado')
      onDone()
      if (input.type === 'expense' && input.category_id) {
        void warnIfOverBudget(input.category_id, input.date.slice(0, 7))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  /** Después de guardar un gasto, avisa si su categoría pasó el 80% o el 100%. */
  async function warnIfOverBudget(categoryId: string, ym: string) {
    try {
      const usage = await budgetUsage(categoryId, ym)
      if (!usage) return
      const { pct, level } = budgetStatus(usage.spent, usage.amount)
      const name = categories.find((c) => c.id === categoryId)?.name ?? 'Categoría'
      if (level === 'over') toast(`${name}: excediste el presupuesto (${pct}% usado).`, 'error')
      else if (level === 'warn') toast(`${name}: llevas el ${pct}% del presupuesto del mes.`, 'warning')
    } catch { /* el aviso es opcional; si falla no molestamos */ }
  }

  async function onDelete() {
    if (!tx) return
    const ok = await confirm({
      title: 'Eliminar movimiento',
      message: '¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteTransaction(tx.id)
      toast('Movimiento eliminado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  const today = todayISO()
  const yesterday = addDays(today, -1)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      {tx?.installment_plan_id && (
        <Alert kind="info">
          Es la cuota {tx.installment_no} de una compra en cuotas. Puedes ajustar esta cuota; para cambiar la
          compra completa ve a <Link to="/deudas" onClick={onDone} className="underline">Deudas y cuotas</Link>.
        </Alert>
      )}
      {tx?.recurring_rule_id && (
        <Alert kind="info">
          Lo generó un movimiento recurrente. Los cambios aplican solo a este; para cambiar los próximos ve
          a <Link to="/recurrentes" onClick={onDone} className="underline">Recurrentes</Link>.
        </Alert>
      )}

      {misplaced && (
        <Alert kind="warning">
          Este movimiento quedó anotado en <strong>{misplaced.name}</strong>, que es una deuda o inversión y no una
          cuenta para gastar. Elige la cuenta donde ocurrió, o elimínalo.
        </Alert>
      )}

      {locked ? (
        <LockedAccount account={locked} label={lockedTo ? 'Hacia' : 'Desde'}
          hint={flowKind ? FLOW_HINT[flowKind] : undefined} />
      ) : (
        <Segmented<TxType>
          label="Tipo de movimiento"
          value={type}
          onChange={changeType}
          options={[
            { value: 'expense', label: '− Gasto', tone: 'neg' },
            { value: 'income', label: '+ Ingreso', tone: 'pos' },
            { value: 'transfer', label: 'Transferencia', tone: 'accent' },
          ]}
        />
      )}

      <AmountInput label="Monto" value={amount} onChange={setAmount} autoFocus={!tx} big error={show('amount')} />

      {type !== 'transfer' && (
        <CategoryPicker categories={kindCats} value={categoryId} onChange={setCategoryId} error={show('category')} />
      )}

      {locked ? (
        lockedTo ? (
          <Select value={accountId} error={show('account')} onChange={(e) => setAccountId(e.target.value)}
            label={lockedTo.type === 'investment' ? '¿Desde qué cuenta aportas?'
              : lockedTo.type === 'receivable' ? '¿De qué cuenta sale el dinero?' : '¿Desde qué cuenta pagas?'}>
            {!accountId && <option value="">Elegir…</option>}
            {usableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        ) : (
          <Select label="¿A qué cuenta llega el dinero?" value={toAccountId} error={show('toAccount')}
            onChange={(e) => setToAccountId(e.target.value)}>
            {!toAccountId && <option value="">Elegir…</option>}
            {usableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        )
      ) : (
        <div className={`grid gap-3 ${type === 'transfer' ? 'grid-cols-2' : ''}`}>
          <Select label={type === 'transfer' ? 'Desde' : 'Cuenta'} value={accountId}
            error={show('account')} onChange={(e) => setAccountId(e.target.value)}>
            {!accountId && <option value="">Elegir…</option>}
            {usableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          {type === 'transfer' && (
            <Select label="Hacia" value={toAccountId} error={show('toAccount')} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">Elegir…</option>
              {usableAccounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Fecha" type="date" value={date} max="2100-12-31" error={show('date')}
              onChange={(e) => setDate(e.target.value)} />
          </div>
          {[['Hoy', today], ['Ayer', yesterday]].map(([label, value]) => (
            <button key={label} type="button" aria-pressed={date === value} onClick={() => setDate(value)}
              className={`pressable min-h-11 rounded-sm border px-3.5 text-sm font-semibold transition-colors duration-200 ${
                date === value ? 'border-accent bg-accent text-on-accent' : 'border-line-strong/45 bg-surface text-ink hover:bg-subtle'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <details open={!!(tx?.note || tx?.tags.length)} className="group rounded-sm border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Más detalles (nota, etiquetas)
          <ChevronDown size={18} strokeWidth={2} className="text-muted transition-transform duration-300 ease-soft group-open:rotate-180" aria-hidden />
        </summary>
        <div className="flex flex-col gap-3 px-3.5 pb-3.5">
          <Field label="Nota" maxLength={500} placeholder="Ej: almuerzo con el equipo"
            value={note} onChange={(e) => setNote(e.target.value)} />
          <Field label="Etiquetas" placeholder="Ej: viaje, trabajo" hint="Sepáralas con comas."
            value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </div>
      </details>

      <Button type="submit" size="lg" loading={busy}>
        {tx ? 'Guardar cambios' : 'Guardar'}
      </Button>
      {tx && <Button type="button" variant="ghost" icon={Trash2} className="text-neg" onClick={onDelete}>Eliminar movimiento</Button>}
    </form>
  )
}

/** La deuda o inversión de un pago o aporte: se muestra, no se elige. */
function LockedAccount({ account: a, label, hint }: { account: AccountWithBalance; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[0.8125rem] font-medium text-soft">{label}</p>
      <div className="flex items-center gap-3 rounded-sm border border-line bg-subtle/60 px-3.5 py-3">
        <AccountIcon account={a} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{a.name}</p>
          <p className="truncate text-xs text-muted">{[ACCOUNT_TYPES[a.type].label, a.counterparty].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}
