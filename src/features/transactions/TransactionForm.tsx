// Formulario de transacción, pensado para registrar un gasto en < 10 segundos:
//   1) el monto tiene el foco y abre el teclado numérico,
//   2) la categoría se elige con un toque,
//   3) la cuenta recuerda la última usada y la fecha parte en "Hoy".
// Nota y etiquetas quedan en "Más detalles".
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useRefData } from '@/context/RefData'
import { createTransaction, deleteTransaction, parseTags, updateTransaction } from '@/data/transactions'
import { addDays } from '@/lib/dates'
import { todayISO } from '@/lib/format'
import { iconFor } from '@/lib/icons'
import { AmountInput } from '@/components/AmountInput'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, EmptyState, Field, Segmented, Select, Spinner } from '@/components/ui'
import type { Transaction, TxInput, TxType } from '@/types'

const LAST_ACCOUNT_KEY = 'finanzas.lastAccount'

function readLastAccount(): string | null {
  try { return localStorage.getItem(LAST_ACCOUNT_KEY) } catch { return null }
}

type Props = { tx?: Transaction; onDone: () => void }

/** Espera a que estén las cuentas antes de montar el formulario (sus valores
 *  por defecto dependen de ellas). */
export function TransactionForm({ tx, onDone }: Props) {
  const { accounts, loading } = useRefData()
  if (loading) return <Spinner label="Cargando…" />
  if (!accounts.some((a) => !a.archived) && !tx) {
    return (
      <EmptyState icon="🏦" title="Primero crea una cuenta"
        action={<Link to="/cuentas" onClick={onDone} className="font-medium text-teal-700 underline dark:text-teal-400">Ir a Cuentas</Link>}>
        Los movimientos se registran en una cuenta (efectivo, banco, tarjeta…).
      </EmptyState>
    )
  }
  return <TransactionFormInner tx={tx} onDone={onDone} />
}

function TransactionFormInner({ tx, onDone }: Props) {
  const { accounts, categories } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()

  // En edición se incluye la cuenta original aunque esté archivada.
  const usableAccounts = accounts.filter(
    (a) => !a.archived || a.id === tx?.account_id || a.id === tx?.to_account_id,
  )
  const defaultAccount = (() => {
    const last = readLastAccount()
    return usableAccounts.find((a) => a.id === last && !a.archived)?.id ?? usableAccounts[0]?.id ?? ''
  })()

  const [type, setType] = useState<TxType>(tx?.type ?? 'expense')
  const [amount, setAmount] = useState<number | null>(tx?.amount ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(tx?.category_id ?? null)
  const [accountId, setAccountId] = useState(tx?.account_id ?? defaultAccount)
  const [toAccountId, setToAccountId] = useState(
    tx?.to_account_id ?? usableAccounts.find((a) => a.id !== (tx?.account_id ?? defaultAccount))?.id ?? '',
  )
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [note, setNote] = useState(tx?.note ?? '')
  const [tagsText, setTagsText] = useState(tx?.tags.join(', ') ?? '')
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
      ? 'Elige una cuenta de destino distinta a la de origen.' : '',
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
      try { localStorage.setItem(LAST_ACCOUNT_KEY, accountId) } catch { /* ignorar */ }
      toast(tx ? 'Movimiento actualizado' : 'Movimiento guardado')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
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

      <Segmented<TxType>
        label="Tipo de movimiento"
        value={type}
        onChange={changeType}
        options={[
          { value: 'expense', label: '− Gasto', activeClass: 'bg-red-700 text-white shadow-sm' },
          { value: 'income', label: '+ Ingreso', activeClass: 'bg-green-700 text-white shadow-sm' },
          { value: 'transfer', label: '⇄ Transferencia', activeClass: 'bg-slate-700 text-white shadow-sm' },
        ]}
      />

      <AmountInput label="Monto" value={amount} onChange={setAmount} autoFocus={!tx} big error={show('amount')} />

      {type !== 'transfer' && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Categoría</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {kindCats.map((c) => {
              const active = c.id === categoryId
              return (
                <button key={c.id} type="button" aria-pressed={active} onClick={() => setCategoryId(c.id)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium ${
                    active
                      ? 'border-transparent ring-2 ring-teal-600'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                  style={active ? { backgroundColor: `${c.color}26` } : undefined}>
                  <span className="text-xl" aria-hidden>{iconFor(c.icon)}</span>
                  <span className="line-clamp-1">{c.name}</span>
                </button>
              )
            })}
          </div>
          {show('category') && <p className="mt-1 text-sm text-red-700 dark:text-red-400">{show('category')}</p>}
        </fieldset>
      )}

      <div className={`grid gap-3 ${type === 'transfer' ? 'grid-cols-2' : ''}`}>
        <Select label={type === 'transfer' ? 'Desde' : 'Cuenta'} value={accountId}
          error={show('account')} onChange={(e) => setAccountId(e.target.value)}>
          {usableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        {type === 'transfer' && (
          <Select label="Hacia" value={toAccountId} error={show('toAccount')} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">Elegir…</option>
            {usableAccounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Fecha" type="date" value={date} max="2100-12-31" error={show('date')}
              onChange={(e) => setDate(e.target.value)} />
          </div>
          {[['Hoy', today], ['Ayer', yesterday]].map(([label, value]) => (
            <button key={label} type="button" aria-pressed={date === value} onClick={() => setDate(value)}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${
                date === value ? 'border-teal-600 bg-teal-50 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100' : 'border-slate-300 dark:border-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <details open={!!(tx?.note || tx?.tags.length)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-medium">Más detalles (nota, etiquetas)</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Nota" maxLength={500} placeholder="Ej: almuerzo con el equipo"
            value={note} onChange={(e) => setNote(e.target.value)} />
          <Field label="Etiquetas" placeholder="Ej: viaje, trabajo" hint="Sepáralas con comas."
            value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </div>
      </details>

      <Button type="submit" loading={busy} className="min-h-12 text-base">
        {tx ? 'Guardar cambios' : 'Guardar'}
      </Button>
      {tx && <Button type="button" variant="secondary" onClick={onDelete}>Eliminar movimiento</Button>}
    </form>
  )
}
