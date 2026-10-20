// Crear / editar una deuda ("Yo debo") o un préstamo que hiciste ("Me deben").
// No son cuentas: no aparecen en Cuentas ni en los formularios de gastos. Se
// mueven con "Registrar pago" / "Registrar cobro" (transferencias, no gastos).
//  * Deuda en cuotas: valor de la cuota, total y cuántas ya pagaste => lo que
//    falta = (total − pagadas) × cuota. Así el avance parte donde vas.
//  * Si el dinero llegó a (o salió de) una de tus cuentas, se registra el
//    movimiento en la misma operación y el saldo de esa cuenta cuadra.
//  * Al editar, "lo que debes hoy" ajusta el punto de partida sin tocar los pagos.
import { useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { createTrackedAccount, deleteAccount, updateAccount } from '@/data/accounts'
import { debtOf, remainingFromInstallments } from '@/lib/debt'
import { AppError } from '@/lib/errors'
import { formatCLP, todayISO } from '@/lib/format'
import { COLORS } from '@/lib/icons'
import { INSTITUTIONS, findInstitution } from '@/lib/institutions'
import { AmountInput } from '@/components/AmountInput'
import { useConfirm, useToast } from '@/components/Feedback'
import { ColorPicker } from '@/components/Pickers'
import { Alert, Button, Checkbox, Field, Segmented, Select } from '@/components/ui'
import type { AccountInput, AccountWithBalance } from '@/types'

export type DebtKind = 'loan' | 'receivable'
type Mode = 'installments' | 'total'

const DEFAULT_COLOR: Record<DebtKind, string> = { loan: COLORS[3], receivable: COLORS[1] }

/** "18,5" -> 18.5 ; "" -> null ; inválido -> NaN */
function parseRate(s: string): number | null {
  if (!s.trim()) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 999 ? n : NaN
}

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max)

export function DebtForm({
  debt, defaultKind = 'loan', onDone, onDeleted,
}: { debt?: AccountWithBalance; defaultKind?: DebtKind; onDone: () => void; onDeleted?: () => void }) {
  const { accounts } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  const editing = !!debt

  const [kind, setKind] = useState<DebtKind>((debt?.type as DebtKind | undefined) ?? defaultKind)
  const isLoan = kind === 'loan'
  const [name, setName] = useState(debt?.name ?? '')
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '')
  const [mode, setMode] = useState<Mode>('installments')
  const [cuota, setCuota] = useState<number | null>(debt?.loan_installment ?? null)
  const [countText, setCountText] = useState(debt?.loan_installments_count?.toString() ?? '')
  const [paidBeforeText, setPaidBeforeText] = useState('0')
  const [amount, setAmount] = useState<number | null>(
    debt ? (debt.type === 'loan' ? debtOf(debt) : Math.max(0, debt.balance)) : null,
  )
  const [loanAmount, setLoanAmount] = useState<number | null>(debt?.loan_amount ?? null)
  const [paymentDay, setPaymentDay] = useState(debt?.payment_day?.toString() ?? '')
  const [rate, setRate] = useState(debt?.interest_rate != null ? String(debt.interest_rate).replace('.', ',') : '')
  const [cashAccountId, setCashAccountId] = useState('')
  const [cashAmount, setCashAmount] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [color, setColor] = useState(debt?.color ?? DEFAULT_COLOR[defaultKind])
  const [colorTouched, setColorTouched] = useState(editing)
  const [archived, setArchived] = useState(debt?.archived ?? false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const usable = accounts.filter((a) => !a.archived)
  const institution = isLoan ? findInstitution(counterparty) : undefined
  const count = Number(countText)
  const paidBefore = Number(paidBeforeText || 0)
  const byInstallments = isLoan && !editing && mode === 'installments'

  // Lo que se debe (o te deben) hoy, según lo ingresado.
  const owedToday = byInstallments
    ? (cuota && count ? remainingFromInstallments(cuota, count, paidBefore) : null)
    : amount

  const errors = useMemo(() => ({
    name: isLoan && !name.trim() ? 'Ponle un nombre a la deuda.' : '',
    counterparty: !isLoan && !counterparty.trim() ? 'Escribe quién te debe.' : '',
    cuota: byInstallments && !cuota ? 'Ingresa el valor de la cuota.' : '',
    count: byInstallments && (!Number.isInteger(count) || count < 1 || count > 600) ? 'Entre 1 y 600 cuotas.'
      : isLoan && editing && countText && (count < 1 || count > 600) ? 'Entre 1 y 600 cuotas.' : '',
    paidBefore: byInstallments && Number.isInteger(count) && count > 0 && paidBefore >= count
      ? 'Si ya pagaste todas las cuotas, no queda deuda que registrar.' : '',
    amount: !byInstallments && !editing && !amount ? (isLoan ? 'Ingresa cuánto debes.' : 'Ingresa cuánto te deben.') : '',
    paymentDay: paymentDay && (+paymentDay < 1 || +paymentDay > 31) ? 'Debe ser un día entre 1 y 31.' : '',
    rate: Number.isNaN(parseRate(rate)) ? 'Ingresa un porcentaje válido (ej: 18,5).' : '',
    cashAmount: cashAccountId && !cashAmount ? 'Ingresa el monto.' : '',
    date: cashAccountId && !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Ingresa una fecha válida.' : '',
  }), [isLoan, name, counterparty, byInstallments, cuota, count, countText, paidBefore, amount, editing, paymentDay, rate, cashAccountId, cashAmount, date])
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : '')

  function changeCounterparty(v: string) {
    setCounterparty(v)
    // Si es un banco conocido, toma su color (si no se eligió otro).
    const inst = isLoan ? findInstitution(v) : undefined
    if (inst && !colorTouched) setColor(inst.color)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setError('')
    setBusy(true)
    const finalName = name.trim() || `Préstamo a ${counterparty.trim()}`
    const common = {
      name: finalName,
      counterparty: counterparty.trim() || null,
      institution: institution?.id ?? null,
      color,
    }
    // Al crear con "Monto total" no se guardan cuotas aunque se hayan escrito antes de cambiar.
    const withInstallments = isLoan && (editing || mode === 'installments')
    const loanFields = {
      loan_amount: isLoan ? loanAmount : null,
      loan_installment: withInstallments ? cuota : null,
      loan_installments_count: withInstallments && countText ? count : null,
      interest_rate: isLoan ? parseRate(rate) : null,
      payment_day: isLoan && paymentDay ? +paymentDay : null,
    }
    try {
      if (debt) {
        // "Lo que debes hoy" mueve el punto de partida; los pagos registrados no cambian.
        const current = debt.type === 'loan' ? debtOf(debt) : Math.max(0, debt.balance)
        const next = amount ?? 0
        const initial = debt.type === 'loan' ? debt.initial_balance + current - next : debt.initial_balance + next - current
        await updateAccount(debt.id, { ...common, ...loanFields, initial_balance: initial, archived } satisfies Partial<AccountInput>)
        toast('Cambios guardados')
      } else {
        const total = owedToday ?? 0
        const moved = cashAccountId ? cashAmount ?? 0 : 0
        // Con movimiento inicial, ese monto ya entra al saldo por la transferencia.
        const initial = isLoan ? -(total - moved) : total - moved
        await createTrackedAccount(
          { ...common, ...loanFields, type: kind, initial_balance: initial },
          { cashAccountId: cashAccountId || null, cashAmount: moved || null, date },
        )
        toast(isLoan ? 'Deuda guardada' : 'Préstamo guardado')
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!debt) return
    const ok = await confirm({
      title: isLoan ? 'Eliminar deuda' : 'Eliminar préstamo',
      message: <>¿Eliminar <strong>{debt.name}</strong>? Esta acción no se puede deshacer.</>,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteAccount(debt.id)
      toast('Eliminado')
      ;(onDeleted ?? onDone)()
    } catch (err) {
      setError(
        err instanceof AppError && err.code === '23503'
          ? 'Tiene pagos o cobros registrados, por eso no se puede eliminar. Puedes archivarla para ocultarla.'
          : err instanceof Error ? err.message : 'No se pudo eliminar.',
      )
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}

      {!editing && (
        <Segmented<DebtKind> label="¿Quién le debe a quién?" value={kind}
          onChange={(k) => { setKind(k); if (!colorTouched) setColor(DEFAULT_COLOR[k]) }}
          options={[{ value: 'loan', label: 'Yo debo', tone: 'neg' }, { value: 'receivable', label: 'Me deben', tone: 'pos' }]} />
      )}

      {isLoan ? (
        <>
          <Field label="Nombre" required maxLength={60} data-autofocus={!editing || undefined} error={show('name')}
            placeholder="Ej: Crédito de consumo" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="¿A quién le debes? (opcional)" maxLength={80} list="debt-banks" placeholder="Ej: BancoEstado, Juan"
            value={counterparty} onChange={(e) => changeCounterparty(e.target.value)}
            hint={institution ? `Se mostrará con el logo de ${institution.name}.` : undefined} />
          <datalist id="debt-banks">{INSTITUTIONS.map((i) => <option key={i.id} value={i.name} />)}</datalist>
        </>
      ) : (
        <>
          <Field label="¿Quién te debe?" required maxLength={80} data-autofocus={!editing || undefined} error={show('counterparty')}
            placeholder="Ej: Juan" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          <Field label="Nombre (opcional)" maxLength={60} placeholder={`Préstamo a ${counterparty.trim() || '…'}`}
            value={name} onChange={(e) => setName(e.target.value)} />
        </>
      )}

      {isLoan && !editing && (
        <Segmented<Mode> label="¿Cómo la pagas?" value={mode} onChange={setMode}
          options={[{ value: 'installments', label: 'En cuotas' }, { value: 'total', label: 'Monto total' }]} />
      )}

      {byInstallments ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <AmountInput label="Valor de la cuota" value={cuota} onChange={setCuota} error={show('cuota')} />
            <Field label="Total de cuotas" inputMode="numeric" placeholder="Ej: 24" value={countText}
              error={show('count')} onChange={(e) => setCountText(digits(e.target.value, 3))} />
          </div>
          <Field label="¿Cuántas cuotas ya pagaste?" inputMode="numeric" placeholder="0" value={paidBeforeText}
            error={show('paidBefore')} onChange={(e) => setPaidBeforeText(digits(e.target.value, 3))}
            hint="Las que pagaste antes de registrarla aquí." />
          {owedToday != null && owedToday > 0 && (
            <p className="rounded-sm bg-subtle px-3.5 py-3 text-sm">
              Te quedan <strong>{count - paidBefore} cuotas</strong>: debes <strong className="tabular-nums">{formatCLP(owedToday)}</strong>.
            </p>
          )}
        </>
      ) : (
        <AmountInput label={isLoan ? (editing ? 'Lo que debes hoy' : '¿Cuánto debes hoy?') : (editing ? 'Lo que te deben hoy' : '¿Cuánto te debe?')}
          value={amount} onChange={setAmount} error={show('amount')}
          hint={editing ? 'Corrige el saldo sin borrar los pagos registrados.' : undefined} />
      )}

      {isLoan && (
        <>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <AmountInput label="Valor de la cuota (opcional)" value={cuota} onChange={setCuota} />
              <Field label="Total de cuotas (opcional)" inputMode="numeric" placeholder="Ej: 24" value={countText}
                error={show('count')} onChange={(e) => setCountText(digits(e.target.value, 3))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Día de pago (opcional)" inputMode="numeric" placeholder="Ej: 10" value={paymentDay}
              error={show('paymentDay')} onChange={(e) => setPaymentDay(digits(e.target.value, 2))} />
            <Field label="Tasa anual % (opcional)" inputMode="decimal" placeholder="Ej: 18,5" value={rate}
              error={show('rate')} onChange={(e) => setRate(e.target.value.replace(/[^\d,.]/g, '').slice(0, 7))} />
          </div>
          <AmountInput label="Monto que pediste (opcional)" value={loanAmount} onChange={setLoanAmount}
            hint="Solo informativo: el avance se calcula con lo que debes y lo que pagas." />
        </>
      )}

      {!editing && (
        <details className="group rounded-sm border border-line" open={!!cashAccountId}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3.5 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>
              {isLoan ? '¿El dinero llegó a una de tus cuentas?' : '¿El dinero salió de una de tus cuentas?'}
              <span className="mt-0.5 block text-xs font-normal text-muted">
                {isLoan ? 'Para un préstamo nuevo: suma el dinero a esa cuenta sin contarlo como ingreso.'
                  : 'Resta el dinero de esa cuenta sin contarlo como gasto.'}
              </span>
            </span>
            <ChevronDown size={18} strokeWidth={2} aria-hidden
              className="mt-0.5 shrink-0 text-muted transition-transform duration-300 ease-soft group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-3 px-3.5 pb-3.5">
            <Select label={isLoan ? 'Cuenta donde llegó' : 'Cuenta de donde salió'} value={cashAccountId}
              onChange={(e) => {
                setCashAccountId(e.target.value)
                if (e.target.value && cashAmount == null) setCashAmount(isLoan ? loanAmount ?? owedToday : owedToday)
              }}>
              <option value="">{isLoan ? 'No (solo anotar la deuda)' : 'No (solo anotarlo)'}</option>
              {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            {cashAccountId && (
              <div className="grid grid-cols-2 gap-3">
                <AmountInput label={isLoan ? 'Monto recibido' : 'Monto prestado'} value={cashAmount}
                  onChange={setCashAmount} error={show('cashAmount')} />
                <Field label="Fecha" type="date" value={date} max="2100-12-31" error={show('date')}
                  onChange={(e) => setDate(e.target.value)} />
              </div>
            )}
          </div>
        </details>
      )}

      <ColorPicker value={color} onChange={(c) => { setColor(c); setColorTouched(true) }}
        suggested={institution?.color} suggestedLabel={institution ? `Color de ${institution.name}` : undefined} />

      {debt && (
        <Checkbox label="Archivar" hint="Se oculta de la lista y conserva su historial." checked={archived} onChange={setArchived} />
      )}

      <Button type="submit" size="lg" loading={busy}>
        {debt ? 'Guardar cambios' : isLoan ? 'Guardar deuda' : 'Guardar préstamo'}
      </Button>
      {debt && <Button type="button" variant="ghost" icon={Trash2} className="text-neg" onClick={onDelete}>Eliminar</Button>}
    </form>
  )
}
