// Crear / editar una cuenta. En tarjetas de crédito se pide la deuda actual
// (positiva en pantalla) y se guarda como saldo inicial negativo.
import { useState, type FormEvent } from 'react'
import { createAccount, deleteAccount, updateAccount } from '@/data/accounts'
import { AppError } from '@/lib/errors'
import { ACCOUNT_TYPES, COLORS } from '@/lib/icons'
import { AmountInput } from '@/components/AmountInput'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, Field } from '@/components/ui'
import type { Account, AccountType } from '@/types'

export function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank')
  const isCard = type === 'credit_card'
  const [initial, setInitial] = useState<number | null>(
    account ? Math.abs(account.initial_balance) : null,
  )
  const [negative, setNegative] = useState(account ? account.initial_balance < 0 && account.type !== 'credit_card' : false)
  const [limit, setLimit] = useState<number | null>(account?.credit_limit ?? null)
  const [closingDay, setClosingDay] = useState(account?.closing_day?.toString() ?? '')
  const [paymentDay, setPaymentDay] = useState(account?.payment_day?.toString() ?? '')
  const [color, setColor] = useState(account?.color ?? COLORS[0])
  const [archived, setArchived] = useState(account?.archived ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const dayError = (v: string) =>
    v && (!/^\d+$/.test(v) || +v < 1 || +v > 31) ? 'Debe ser un día entre 1 y 31.' : ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Ponle un nombre a la cuenta.')
    if (isCard && (dayError(closingDay) || dayError(paymentDay))) return
    setError('')
    setBusy(true)
    const amount = initial ?? 0
    const input = {
      name: name.trim(),
      type,
      // Tarjeta: la deuda se guarda negativa. Otras: negativo solo si se marcó "sobregiro".
      initial_balance: isCard || negative ? -amount : amount,
      credit_limit: isCard ? limit : null,
      closing_day: isCard && closingDay ? +closingDay : null,
      payment_day: isCard && paymentDay ? +paymentDay : null,
      color,
      archived,
    }
    try {
      if (account) await updateAccount(account.id, input)
      else await createAccount(input)
      toast(account ? 'Cuenta actualizada' : 'Cuenta creada')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!account) return
    const ok = await confirm({
      title: 'Eliminar cuenta',
      message: <>¿Eliminar <strong>{account.name}</strong>? Esta acción no se puede deshacer.</>,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteAccount(account.id)
      toast('Cuenta eliminada')
      onDone()
    } catch (err) {
      setError(
        err instanceof AppError && err.code === '23503'
          ? 'Esta cuenta tiene movimientos, por eso no se puede eliminar. Puedes archivarla para ocultarla.'
          : err instanceof Error ? err.message : 'No se pudo eliminar.',
      )
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="Nombre" required maxLength={60} data-autofocus={!account || undefined}
        placeholder="Ej: Cuenta RUT, Visa Banco X" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo</span>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((t) => (
            <label key={t}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600 ${
                type === t
                  ? 'border-teal-600 bg-teal-50 font-semibold dark:bg-teal-900/30'
                  : 'border-slate-300 dark:border-slate-600'}`}>
              <input type="radio" name="account-type" className="sr-only" checked={type === t} onChange={() => setType(t)} />
              <span aria-hidden>{ACCOUNT_TYPES[t].icon}</span>{ACCOUNT_TYPES[t].label}
            </label>
          ))}
        </div>
      </div>

      <AmountInput label={isCard ? 'Deuda actual de la tarjeta' : 'Saldo inicial'} value={initial} onChange={setInitial} />
      {!isCard && (
        <label className="-mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="size-4" checked={negative} onChange={(e) => setNegative(e.target.checked)} />
          El saldo inicial es negativo (sobregiro / línea de crédito)
        </label>
      )}

      {isCard && (
        <>
          <AmountInput label="Cupo total" value={limit} onChange={setLimit} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Día de cierre" inputMode="numeric" placeholder="Ej: 20" value={closingDay}
              error={dayError(closingDay)} onChange={(e) => setClosingDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <Field label="Día de pago" inputMode="numeric" placeholder="Ej: 5" value={paymentDay}
              error={dayError(paymentDay)} onChange={(e) => setPaymentDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </div>
          <Alert kind="info">Para registrar el pago de la tarjeta, usa una <strong>transferencia</strong> desde tu cuenta bancaria hacia la tarjeta.</Alert>
        </>
      )}

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Color</legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="account-color" className="peer sr-only" checked={color === c} onChange={() => setColor(c)} />
              <span
                className="grid size-9 place-items-center rounded-full text-sm text-white ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 dark:ring-offset-slate-800 dark:peer-checked:ring-white"
                style={{ backgroundColor: c }}
              >
                {color === c ? '✓' : ''}
                <span className="sr-only">Color {c}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {account && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="size-4" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Archivar (ocultar de los formularios; conserva su historial)
        </label>
      )}

      <Button type="submit" loading={busy}>{account ? 'Guardar cambios' : 'Crear cuenta'}</Button>
      {account && <Button type="button" variant="secondary" onClick={onDelete}>Eliminar cuenta</Button>}
    </form>
  )
}
