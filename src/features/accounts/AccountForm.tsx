// Crear / editar una cuenta de dinero: efectivo, banco, ahorro o tarjeta.
//  * Al crear se elige el banco (logo y color de marca) y el producto
//    (CuentaRUT, Cuenta Corriente, Tarjeta de Crédito...): el nombre y el color
//    se completan solos y se pueden cambiar.
//  * Tarjeta de crédito: se pide la deuda actual (positiva en pantalla) y se
//    guarda como saldo inicial negativo. Pagarla es una transferencia.
// Las deudas y los "me deben" se crean en Deudas; las inversiones, en Inversiones.
import { useState, type FormEvent, type ReactNode } from 'react'
import { Banknote, Landmark, Trash2 } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { createAccount, deleteAccount, updateAccount } from '@/data/accounts'
import { getRate, saveRate } from '@/data/rates'
import { useQuery } from '@/hooks/useQuery'
import { CURRENCIES, toCLP, type Currency } from '@/lib/currency'
import { todayISO } from '@/lib/format'
import { AppError } from '@/lib/errors'
import { COLORS } from '@/lib/icons'
import { INSTITUTIONS, OTHER_PRODUCTS, institutionById, productAccountName, type Product } from '@/lib/institutions'
import { MoneyInput } from '@/components/MoneyInput'
import { RateField } from '@/components/RateField'
import { ACCOUNT_ICONS, AccountIcon, IconTile, InstitutionMark } from '@/components/icons'
import { ColorPicker } from '@/components/Pickers'
import { useConfirm, useToast } from '@/components/Feedback'
import { Alert, Button, Checkbox, Field, Segmented } from '@/components/ui'
import type { Account, AccountInput } from '@/types'

type MoneyType = 'cash' | 'bank' | 'savings' | 'credit_card'

const TYPE_LABEL: Record<MoneyType, string> = {
  cash: 'Efectivo', bank: 'Cuenta bancaria', savings: 'Cuenta de ahorro', credit_card: 'Tarjeta de crédito',
}
const CASH_COLOR = '#4f7a3a'

/** Dónde está el dinero: efectivo, un banco de la lista u otro banco. */
type Where = 'cash' | 'other' | string

const chipCls = (active: boolean) =>
  `pressable flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border px-3 text-center text-sm leading-tight transition-colors duration-200
   has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
     active ? 'border-ink bg-subtle font-semibold text-ink' : 'border-line bg-surface text-soft hover:text-ink'}`

export function AccountForm({
  account, defaultType = 'bank', onDone,
}: { account?: Account; defaultType?: MoneyType; onDone: () => void }) {
  const confirm = useConfirm()
  const toast = useToast()
  const { multiCurrency } = useRefData()
  const editing = !!account
  // Moneda: se elige al crear (con la opción "Usar UF y dólares"); después no cambia.
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'CLP')
  const foreign = currency !== 'CLP'

  const [where, setWhere] = useState<Where | ''>(
    account ? (account.type === 'cash' ? 'cash' : account.institution ?? 'other') : '',
  )
  const [productId, setProductId] = useState<string | null>(null)
  const [type, setType] = useState<MoneyType>((account?.type as MoneyType | undefined) ?? defaultType)
  const [name, setName] = useState(account?.name ?? '')
  const [nameTouched, setNameTouched] = useState(editing)
  const [color, setColor] = useState(account?.color ?? COLORS[0])
  const [colorTouched, setColorTouched] = useState(editing)
  const [showBanks, setShowBanks] = useState(!editing)
  const isCard = type === 'credit_card'
  const [initial, setInitial] = useState<number | null>(
    account ? Math.abs(Number(account.initial_balance_native ?? account.initial_balance)) : null)
  const [negative, setNegative] = useState(account ? account.initial_balance < 0 && account.type !== 'credit_card' : false)
  const [limit, setLimit] = useState<number | null>(account?.credit_limit ?? null)
  const [closingDay, setClosingDay] = useState(account?.closing_day?.toString() ?? '')
  const [paymentDay, setPaymentDay] = useState(account?.payment_day?.toString() ?? '')
  const [archived, setArchived] = useState(account?.archived ?? false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Cuenta en UF/USD: valor de hoy para guardar el saldo inicial también en pesos.
  const today = todayISO()
  const rateQ = useQuery(() => (currency !== 'CLP' ? getRate(currency, today) : Promise.resolve(null)), [currency, today])
  const [rateOverride, setRateOverride] = useState<number | null>(null)
  const [editingRate, setEditingRate] = useState(false)
  const rate = rateOverride ?? rateQ.data ?? null

  const inst = where && where !== 'cash' && where !== 'other' ? institutionById(where) : undefined
  const products: Product[] = inst?.products ?? (where === 'other' ? OTHER_PRODUCTS : [])

  function chooseWhere(w: Where) {
    setWhere(w)
    if (w === 'cash') {
      setType('cash')
      setProductId(null)
      if (!nameTouched) setName('Efectivo')
      if (!colorTouched) setColor(CASH_COLOR)
      return
    }
    const next = institutionById(w)
    if (!next) {
      // Otro banco: se elige el tipo y se escribe el nombre.
      if (type === 'cash') setType('bank')
      setProductId(null)
      if (!nameTouched) setName('')
      if (!colorTouched) setColor(COLORS[0])
      return
    }
    if (!colorTouched) setColor(next.color)
    if (editing) {
      if (type === 'cash') setType('bank')
      return
    }
    // Al crear se preselecciona el primer producto (o la tarjeta si se llegó desde Deudas).
    const p = next.products.find((x) => defaultType === 'credit_card' && x.type === 'credit_card') ?? next.products[0]
    chooseProduct(p, next)
  }

  function chooseProduct(p: Product, i = inst) {
    setProductId(p.id)
    setType(p.type)
    if (!nameTouched && i) setName(productAccountName(i, p))
  }

  const dayError = (v: string) =>
    v && (!/^\d+$/.test(v) || +v < 1 || +v > 31) ? 'Debe ser un día entre 1 y 31.' : ''
  const errors = {
    where: !where ? 'Elige dónde está tu dinero.' : '',
    name: !name.trim() ? 'Ponle un nombre a la cuenta.' : '',
    closing: isCard ? dayError(closingDay) : '',
    payment: isCard ? dayError(paymentDay) : '',
    rate: foreign && !rate ? `Ingresa el valor de 1 ${currency} hoy.` : '',
  }
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : '')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setError('')
    setBusy(true)
    const amount = initial ?? 0
    const sign = isCard || negative ? -1 : 1
    const input: AccountInput = {
      name: name.trim(),
      type,
      // Tarjeta: deuda guardada en negativo. Otras: negativo solo si se marcó "sobregiro".
      // En UF/USD: el saldo en su moneda y, en pesos, al valor de hoy.
      initial_balance: sign * (foreign ? toCLP(amount, rate!) : amount),
      ...(foreign && { initial_balance_native: sign * amount }),
      // La moneda se guarda solo al crear (sin la migración 0009 la columna no existe).
      ...(!account && foreign && { currency }),
      credit_limit: isCard && limit != null ? Math.round(limit) : null,
      closing_day: isCard && closingDay ? +closingDay : null,
      payment_day: isCard && paymentDay ? +paymentDay : null,
      counterparty: null,
      loan_amount: null,
      loan_installment: null,
      loan_installments_count: null,
      interest_rate: null,
      institution: type !== 'cash' && inst ? inst.id : null,
      investment_kind: null,
      color,
      archived,
    }
    try {
      if (account) await updateAccount(account.id, input)
      else await createAccount(input)
      if (currency !== 'CLP' && rateOverride && editingRate) void saveRate(currency, today, rateOverride).catch(() => {})
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
  const preview = { type, color, institution: type !== 'cash' && inst ? inst.id : null, investment_kind: null }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && <Alert>{error}</Alert>}

      {showBanks ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[0.8125rem] font-medium text-soft">¿Dónde está tu dinero?</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            <WhereTile active={where === 'cash'} onSelect={() => chooseWhere('cash')} label="Efectivo"
              logo={<IconTile icon={Banknote} color={CASH_COLOR} />} />
            {INSTITUTIONS.map((i) => (
              <WhereTile key={i.id} active={where === i.id} onSelect={() => chooseWhere(i.id)} label={i.short}
                logo={<InstitutionMark id={i.id} />} />
            ))}
            <WhereTile active={where === 'other'} onSelect={() => chooseWhere('other')} label="Otro banco"
              logo={<IconTile icon={Landmark} />} />
          </div>
          {show('where') && <p className="text-sm font-medium text-neg">{show('where')}</p>}
        </fieldset>
      ) : (
        <div className="flex items-center gap-3 rounded-sm border border-line px-3.5 py-3">
          <AccountIcon account={preview} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{where === 'cash' ? 'Efectivo' : inst?.name ?? 'Otro banco'}</p>
            <p className="text-xs text-muted">{TYPE_LABEL[type]}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowBanks(true)}>Cambiar banco</Button>
        </div>
      )}

      {where && where !== 'cash' && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[0.8125rem] font-medium text-soft">Tipo de cuenta</legend>
          <div className="grid grid-cols-2 gap-2">
            {editing || !inst
              ? (['bank', 'savings', 'credit_card'] as const).map((t) => (
                <label key={t} className={chipCls(type === t)}>
                  <input type="radio" name="account-type" className="sr-only" checked={type === t} onChange={() => setType(t)} />
                  {(() => { const Icon = ACCOUNT_ICONS[t]; return <Icon size={18} strokeWidth={type === t ? 2 : 1.75} aria-hidden /> })()}
                  {TYPE_LABEL[t]}
                </label>
              ))
              : products.map((p) => (
                <label key={p.id} className={chipCls(productId === p.id)}>
                  <input type="radio" name="account-product" className="sr-only" checked={productId === p.id}
                    onChange={() => chooseProduct(p)} />
                  {p.label}
                </label>
              ))}
          </div>
        </fieldset>
      )}

      {where && (
        <>
          <Field label="Nombre" required maxLength={60} error={show('name')}
            placeholder={where === 'other' ? 'Ej: Cuenta Corriente Banco X' : 'Ej: Cuenta para gastos'}
            value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true) }} />

          {multiCurrency && !editing && (
            <Segmented<Currency> label="Moneda de la cuenta" value={currency}
              onChange={(c) => { setCurrency(c); setInitial(null); setLimit(null); setRateOverride(null); setEditingRate(false) }}
              options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: CURRENCIES[c].label }))} />
          )}
          {editing && foreign && <p className="text-sm text-muted">Cuenta en {CURRENCIES[currency].name} (la moneda no se cambia).</p>}

          <MoneyInput currency={currency}
            label={isCard ? (editing ? 'Deuda al agregarla' : 'Deuda actual de la tarjeta') : editing ? 'Saldo al agregarla' : 'Saldo actual'}
            hint={editing ? 'Es el punto de partida: el saldo de hoy se calcula sumando tus movimientos.' : undefined}
            value={initial} onChange={setInitial} />
          {currency !== 'CLP' && (
            <RateField currency={currency} date={today} rate={rate} loading={rateQ.loading}
              editing={editingRate || (!rate && !rateQ.loading)} error={show('rate')}
              clp={initial != null && rate ? toCLP(initial, rate) : null}
              onEdit={() => { setEditingRate(true); setRateOverride(rate) }}
              onChange={(v) => { setRateOverride(v); setEditingRate(true) }} />
          )}
          {!isCard && (
            <Checkbox label="El saldo es negativo (sobregiro o línea de crédito)" checked={negative} onChange={setNegative} />
          )}

          {isCard && (
            <>
              <MoneyInput currency={currency} label="Cupo total" value={limit} onChange={setLimit} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Día de cierre" inputMode="numeric" placeholder="Ej: 20" value={closingDay}
                  error={show('closing')} onChange={(e) => setClosingDay(digits(e.target.value, 2))} />
                <Field label="Día de pago" inputMode="numeric" placeholder="Ej: 5" value={paymentDay}
                  error={show('payment')} onChange={(e) => setPaymentDay(digits(e.target.value, 2))} />
              </div>
              <Alert kind="info">Para pagar la tarjeta usa <strong>Pagar</strong> en Deudas y cuotas (es una transferencia desde tu cuenta, no un gasto).</Alert>
            </>
          )}

          <ColorPicker value={color} onChange={(c) => { setColor(c); setColorTouched(true) }}
            suggested={inst?.color} suggestedLabel={inst ? `Color de ${inst.name}` : undefined} />

          <div className="flex items-center gap-3 rounded-sm bg-subtle/70 px-3.5 py-3" aria-hidden>
            <AccountIcon account={preview} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name.trim() || 'Nombre de la cuenta'}</p>
              <p className="text-xs text-muted">Así se verá en tus cuentas</p>
            </div>
          </div>

          {account && (
            <Checkbox label="Archivar" hint="Se oculta de los formularios y conserva su historial." checked={archived} onChange={setArchived} />
          )}

          <Button type="submit" size="lg" loading={busy}>{account ? 'Guardar cambios' : 'Crear cuenta'}</Button>
        </>
      )}
      {account && <Button type="button" variant="ghost" icon={Trash2} className="text-neg" onClick={onDelete}>Eliminar cuenta</Button>}
    </form>
  )
}

function WhereTile({ active, onSelect, label, logo }: {
  active: boolean; onSelect: () => void; label: string; logo: ReactNode
}) {
  return (
    <label className={`pressable flex cursor-pointer flex-col items-center gap-1.5 rounded-sm border px-0.5 pt-2.5 pb-2 text-center transition-colors duration-200
      has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
        active ? 'border-ink bg-subtle' : 'border-transparent hover:bg-subtle/60'}`}>
      <input type="radio" name="account-where" className="sr-only" checked={active} onChange={onSelect} />
      {logo}
      <span className={`line-clamp-2 w-full text-[0.6875rem] leading-tight break-words ${active ? 'font-semibold text-ink' : 'text-soft'}`}>{label}</span>
    </label>
  )
}
