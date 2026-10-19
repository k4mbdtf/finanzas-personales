// Crear / editar una cuenta.
//  * Tarjeta de crédito y préstamo: se pide la deuda actual (positiva en
//    pantalla) y se guarda como saldo inicial negativo.
//  * "Me deben": el monto que te deben, en positivo.
// Los pagos de deudas son transferencias (no cuentan como gasto).
import { useState, type FormEvent } from 'react'
import { createAccount, deleteAccount, updateAccount } from '@/data/accounts'
import { AppError } from '@/lib/errors'
import { ACCOUNT_TYPES, COLORS } from '@/lib/icons'
import { AmountInput } from '@/components/AmountInput'
import { ColorPicker } from '@/components/Pickers'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, Field } from '@/components/ui'
import type { Account, AccountInput, AccountType } from '@/types'

const AMOUNT_LABEL: Record<AccountType, string> = {
  cash: 'Saldo inicial',
  bank: 'Saldo inicial',
  savings: 'Saldo inicial',
  credit_card: 'Deuda actual de la tarjeta',
  loan: 'Deuda actual (lo que te falta pagar)',
  receivable: 'Monto que te deben',
}

/** "18,5" -> 18.5 ; "" -> null ; inválido -> NaN */
function parseRate(s: string): number | null {
  if (!s.trim()) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 999 ? n : NaN
}

export function AccountForm({
  account, defaultType = 'bank', onDone,
}: { account?: Account; defaultType?: AccountType; onDone: () => void }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? defaultType)
  const isCard = type === 'credit_card'
  const isLoan = type === 'loan'
  const isReceivable = type === 'receivable'
  const isDebt = isCard || isLoan
  const [initial, setInitial] = useState<number | null>(account ? Math.abs(account.initial_balance) : null)
  const [negative, setNegative] = useState(
    account ? account.initial_balance < 0 && !['credit_card', 'loan'].includes(account.type) : false,
  )
  const [limit, setLimit] = useState<number | null>(account?.credit_limit ?? null)
  const [closingDay, setClosingDay] = useState(account?.closing_day?.toString() ?? '')
  const [paymentDay, setPaymentDay] = useState(account?.payment_day?.toString() ?? '')
  const [counterparty, setCounterparty] = useState(account?.counterparty ?? '')
  const [loanAmount, setLoanAmount] = useState<number | null>(account?.loan_amount ?? null)
  const [loanInstallment, setLoanInstallment] = useState<number | null>(account?.loan_installment ?? null)
  const [loanCount, setLoanCount] = useState(account?.loan_installments_count?.toString() ?? '')
  const [rate, setRate] = useState(account?.interest_rate != null ? String(account.interest_rate).replace('.', ',') : '')
  const [color, setColor] = useState(account?.color ?? COLORS[0])
  const [archived, setArchived] = useState(account?.archived ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const dayError = (v: string) =>
    v && (!/^\d+$/.test(v) || +v < 1 || +v > 31) ? 'Debe ser un día entre 1 y 31.' : ''
  const countError = loanCount && (+loanCount < 1 || +loanCount > 600) ? 'Entre 1 y 600 cuotas.' : ''
  const rateError = Number.isNaN(parseRate(rate)) ? 'Ingresa un porcentaje válido (ej: 18,5).' : ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Ponle un nombre a la cuenta.')
    if ((isCard && dayError(closingDay)) || (isDebt && dayError(paymentDay)) || (isLoan && (countError || rateError))) return
    setError('')
    setBusy(true)
    const amount = initial ?? 0
    const input: AccountInput = {
      name: name.trim(),
      type,
      // Deudas: se guardan negativas. Otras: negativo solo si se marcó "sobregiro".
      initial_balance: isDebt || (negative && !isReceivable) ? -amount : amount,
      credit_limit: isCard ? limit : null,
      closing_day: isCard && closingDay ? +closingDay : null,
      payment_day: isDebt && paymentDay ? +paymentDay : null,
      counterparty: (isLoan || isReceivable) && counterparty.trim() ? counterparty.trim() : null,
      loan_amount: isLoan ? loanAmount : null,
      loan_installment: isLoan ? loanInstallment : null,
      loan_installments_count: isLoan && loanCount ? +loanCount : null,
      interest_rate: isLoan ? parseRate(rate) : null,
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
          ? 'Esta cuenta tiene movimientos, recurrentes o compras en cuotas asociadas, por eso no se puede eliminar. Puedes archivarla para ocultarla.'
          : err instanceof Error ? err.message : 'No se pudo eliminar.',
      )
    }
  }

  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="Nombre" required maxLength={60} data-autofocus={!account || undefined}
        placeholder={isLoan ? 'Ej: Crédito de consumo' : isReceivable ? 'Ej: Préstamo a Juan' : 'Ej: Cuenta RUT, Visa Banco X'}
        value={name} onChange={(e) => setName(e.target.value)} />

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

      {(isLoan || isReceivable) && (
        <Field label={isLoan ? '¿A quién le debes? (banco o persona)' : '¿Quién te debe?'} maxLength={80}
          placeholder={isLoan ? 'Ej: Banco Estado' : 'Ej: Juan'} value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)} />
      )}

      <AmountInput label={AMOUNT_LABEL[type]} value={initial} onChange={setInitial} />
      {!isDebt && !isReceivable && (
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
              error={dayError(closingDay)} onChange={(e) => setClosingDay(digits(e.target.value, 2))} />
            <Field label="Día de pago" inputMode="numeric" placeholder="Ej: 5" value={paymentDay}
              error={dayError(paymentDay)} onChange={(e) => setPaymentDay(digits(e.target.value, 2))} />
          </div>
          <Alert kind="info">Para pagar la tarjeta usa <strong>Pagar</strong> en Deudas y cuotas (es una transferencia desde tu cuenta, no un gasto).</Alert>
        </>
      )}

      {isLoan && (
        <>
          <AmountInput label="Monto original del préstamo (opcional)" value={loanAmount} onChange={setLoanAmount} />
          <div className="grid grid-cols-2 gap-3">
            <AmountInput label="Cuota mensual (opcional)" value={loanInstallment} onChange={setLoanInstallment} />
            <Field label="N° de cuotas (opcional)" inputMode="numeric" placeholder="Ej: 36" value={loanCount}
              error={countError} onChange={(e) => setLoanCount(digits(e.target.value, 3))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tasa anual % (opcional)" inputMode="decimal" placeholder="Ej: 18,5" value={rate}
              error={rateError} onChange={(e) => setRate(e.target.value.replace(/[^\d,.]/g, '').slice(0, 7))} />
            <Field label="Día de pago (opcional)" inputMode="numeric" placeholder="Ej: 10" value={paymentDay}
              error={dayError(paymentDay)} onChange={(e) => setPaymentDay(digits(e.target.value, 2))} />
          </div>
          <Alert kind="info">
            Cada pago se registra con <strong>Registrar pago</strong> en Deudas y cuotas: es una transferencia desde tu
            cuenta, así el capital no se cuenta como gasto. Si quieres, anota los intereses como un gasto aparte.
          </Alert>
        </>
      )}

      {isReceivable && (
        <Alert kind="info">Cuando te paguen, usa <strong>Registrar cobro</strong> en Deudas y cuotas (transferencia hacia tu cuenta).</Alert>
      )}

      <ColorPicker value={color} onChange={setColor} />

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
