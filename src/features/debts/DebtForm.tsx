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
import { CURRENCIES, currencyOf, formatMoney, inPesos, nativeBalance, toCLP, type Currency } from '@/lib/currency'
import { createTrackedAccount, deleteAccount, updateAccount } from '@/data/accounts'
import { getRate, saveRate } from '@/data/rates'
import { useQuery } from '@/hooks/useQuery'
import { debtOf, remainingFromInstallments } from '@/lib/debt'
import { AppError } from '@/lib/errors'
import { todayISO } from '@/lib/format'
import { COLORS } from '@/lib/icons'
import { INSTITUTIONS, findInstitution } from '@/lib/institutions'
import { AmountInput } from '@/components/AmountInput'
import { MoneyInput } from '@/components/MoneyInput'
import { RateField } from '@/components/RateField'
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
  const { accounts, multiCurrency } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  const editing = !!debt
  // Moneda (con "Usar UF y dólares"): se elige al crear. En UF/USD los montos van en esa moneda.
  const [currency, setCurrency] = useState<Currency>(debt ? currencyOf(debt) : 'CLP')
  const foreign = currency !== 'CLP'
  const today = todayISO()
  const rateQ = useQuery(() => (currency !== 'CLP' ? getRate(currency, today) : Promise.resolve(null)), [currency, today])
  const [rateOverride, setRateOverride] = useState<number | null>(null)
  const [editingRate, setEditingRate] = useState(false)
  const fx = rateOverride ?? rateQ.data ?? null

  const [kind, setKind] = useState<DebtKind>((debt?.type as DebtKind | undefined) ?? defaultKind)
  const isLoan = kind === 'loan'
  const [name, setName] = useState(debt?.name ?? '')
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '')
  const [mode, setMode] = useState<Mode>('installments')
  const [cuota, setCuota] = useState<number | null>(debt?.loan_installment ?? null)
  const [countText, setCountText] = useState(debt?.loan_installments_count?.toString() ?? '')
  const [paidBeforeText, setPaidBeforeText] = useState('0')
  // Lo que se debe hoy, en la moneda de la deuda.
  const owedNow = (d: AccountWithBalance) => (d.type === 'loan' ? debtOf({ balance: nativeBalance(d) }) : Math.max(0, nativeBalance(d)))
  const [amount, setAmount] = useState<number | null>(debt ? owedNow(debt) : null)
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

  // El movimiento inicial es en pesos.
  const usable = accounts.filter((a) => !a.archived && inPesos(a))
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
    fx: foreign && !fx ? `Ingresa el valor de 1 ${currency} hoy.` : '',
    date: cashAccountId && !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Ingresa una fecha válida.' : '',
  }), [isLoan, name, counterparty, byInstallments, cuota, count, countText, paidBefore, amount, editing, paymentDay, rate, cashAccountId, cashAmount, date, foreign, fx, currency])
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
    // En UF/USD el saldo inicial se guarda en esa moneda y, en pesos, al valor de hoy.
    const inPesosToday = (v: number) => (foreign ? toCLP(v, fx!) : v)
    try {
      if (debt) {
        // "Lo que debes hoy" mueve el punto de partida; los pagos registrados no cambian.
        const current = owedNow(debt)
        const next = amount ?? 0
        const delta = debt.type === 'loan' ? current - next : next - current
        await updateAccount(debt.id, {
          ...common, ...loanFields, archived,
          initial_balance: debt.initial_balance + inPesosToday(delta),
          ...(foreign && { initial_balance_native: Number(debt.initial_balance_native ?? 0) + delta }),
        } satisfies Partial<AccountInput>)
        toast('Cambios guardados')
      } else {
        const total = owedToday ?? 0
        const moved = cashAccountId ? cashAmount ?? 0 : 0
        // El dinero que se movió (en pesos), en la moneda de la deuda.
        const movedNative = foreign ? Math.round((moved / fx!) * 100) / 100 : moved
        // Con movimiento inicial, ese monto ya entra al saldo por la transferencia.
        const initial = isLoan ? -(total - movedNative) : total - movedNative
        await createTrackedAccount(
          {
            ...common, ...loanFields, type: kind, initial_balance: inPesosToday(initial),
            ...(foreign && { currency, initial_balance_native: initial }),
          },
          { cashAccountId: cashAccountId || null, cashAmount: moved || null, date, native: foreign && moved ? movedNative : null },
        )
        toast(isLoan ? 'Deuda guardada' : 'Préstamo guardado')
      }
      if (currency !== 'CLP' && rateOverride && editingRate) void saveRate(currency, today, rateOverride).catch(() => {})
      onDone()
    } catch (err) {
      setError(foreign && err instanceof AppError && (err.code === '23514' || err.code === 'PGRST202')
        ? 'Para deudas en UF o dólares, ejecuta supabase/migrations/0010_deudas_multimoneda.sql en el SQL Editor de Supabase.'
        : err instanceof Error ? err.message : 'No se pudo guardar.')
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

      {multiCurrency && !editing && (
        <Segmented<Currency> label="Moneda de la deuda" value={currency}
          onChange={(c) => { setCurrency(c); setCuota(null); setAmount(null); setLoanAmount(null); setCashAmount(null); setRateOverride(null); setEditingRate(false) }}
          options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: CURRENCIES[c].label }))} />
      )}
      {editing && foreign && <p className="text-sm text-muted">Deuda en {CURRENCIES[currency].name} (la moneda no se cambia).</p>}

      {isLoan && !editing && (
        <Segmented<Mode> label="¿Cómo la pagas?" value={mode} onChange={setMode}
          options={[{ value: 'installments', label: 'En cuotas' }, { value: 'total', label: 'Monto total' }]} />
      )}

      {byInstallments ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput currency={currency} label="Valor de la cuota" value={cuota} onChange={setCuota} error={show('cuota')} />
            <Field label="Total de cuotas" inputMode="numeric" placeholder="Ej: 24" value={countText}
              error={show('count')} onChange={(e) => setCountText(digits(e.target.value, 3))} />
          </div>
          <Field label="¿Cuántas cuotas ya pagaste?" inputMode="numeric" placeholder="0" value={paidBeforeText}
            error={show('paidBefore')} onChange={(e) => setPaidBeforeText(digits(e.target.value, 3))}
            hint="Las que pagaste antes de registrarla aquí." />
          {owedToday != null && owedToday > 0 && (
            <p className="rounded-sm bg-subtle px-3.5 py-3 text-sm">
              Te quedan <strong>{count - paidBefore} cuotas</strong>: debes <strong className="tabular-nums">{formatMoney(owedToday, currency)}</strong>.
            </p>
          )}
        </>
      ) : (
        <MoneyInput currency={currency} label={isLoan ? (editing ? 'Lo que debes hoy' : '¿Cuánto debes hoy?') : (editing ? 'Lo que te deben hoy' : '¿Cuánto te debe?')}
          value={amount} onChange={setAmount} error={show('amount')}
          hint={editing ? 'Corrige el saldo sin borrar los pagos registrados.' : undefined} />
      )}

      {isLoan && (
        <>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput currency={currency} label="Valor de la cuota (opcional)" value={cuota} onChange={setCuota} />
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
          <MoneyInput currency={currency} label="Monto que pediste (opcional)" value={loanAmount} onChange={setLoanAmount}
            hint="Solo informativo: el avance se calcula con lo que debes y lo que pagas." />
        </>
      )}

      {currency !== 'CLP' && (
        <RateField currency={currency} date={today} rate={fx} loading={rateQ.loading}
          editing={editingRate || (!fx && !rateQ.loading)} error={show('fx')}
          clp={owedToday != null && fx ? toCLP(owedToday, fx) : null}
          onEdit={() => { setEditingRate(true); setRateOverride(fx) }}
          onChange={(v) => { setRateOverride(v); setEditingRate(true) }} />
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
                // En UF/USD, el monto en pesos al valor de hoy.
                const base = isLoan ? loanAmount ?? owedToday : owedToday
                if (e.target.value && cashAmount == null && base != null) setCashAmount(foreign ? (fx ? toCLP(base, fx) : null) : base)
              }}>
              <option value="">{isLoan ? 'No (solo anotar la deuda)' : 'No (solo anotarlo)'}</option>
              {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            {cashAccountId && (
              <div className="grid grid-cols-2 gap-3">
                <AmountInput label={`${isLoan ? 'Monto recibido' : 'Monto prestado'}${foreign ? ' (pesos)' : ''}`} value={cashAmount}
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
