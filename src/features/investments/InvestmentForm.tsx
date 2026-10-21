// Crear / editar una inversión (fondo, acciones, depósito a plazo, cripto, APV...).
// No es una cuenta para gastar: aparece solo en Inversiones. Se mueve con
// "Aportar" y "Rescatar" (transferencias, no gastos) y con "Actualizar valor".
//  * Si el dinero sale ahora de una de tus cuentas, se registra el aporte
//    (resta de esa cuenta sin contar como gasto).
//  * Si ya estaba invertido, se anota como lo aportado antes de usar la app.
import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { inPesos } from '@/lib/currency'
import { createTrackedAccount, deleteAccount, updateAccount } from '@/data/accounts'
import { AppError } from '@/lib/errors'
import { todayISO } from '@/lib/format'
import { COLORS } from '@/lib/icons'
import { findInstitution } from '@/lib/institutions'
import { INVESTMENT_KINDS, PLATFORM_SUGGESTIONS } from '@/lib/investments'
import { AmountInput } from '@/components/AmountInput'
import { useConfirm, useToast } from '@/components/Feedback'
import { INVESTMENT_ICONS } from '@/components/icons'
import { ColorPicker } from '@/components/Pickers'
import { Alert, Button, Checkbox, Field, Select } from '@/components/ui'
import type { AccountWithBalance, InvestmentKind } from '@/types'

const DEFAULT_COLOR = COLORS[0]

export function InvestmentForm({ investment, onDone, onDeleted }: {
  investment?: AccountWithBalance; onDone: () => void; onDeleted?: () => void
}) {
  const { accounts } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  const editing = !!investment

  const [name, setName] = useState(investment?.name ?? '')
  const [platform, setPlatform] = useState(investment?.counterparty ?? '')
  const [kind, setKind] = useState<InvestmentKind>(investment?.investment_kind ?? 'fund')
  const [amount, setAmount] = useState<number | null>(investment ? investment.initial_balance : null)
  const [fromAccountId, setFromAccountId] = useState('')
  const [value, setValue] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [color, setColor] = useState(investment?.color ?? DEFAULT_COLOR)
  const [colorTouched, setColorTouched] = useState(editing)
  const [archived, setArchived] = useState(investment?.archived ?? false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const institution = findInstitution(platform)
  // El aporte inicial es en pesos.
  const usable = accounts.filter((a) => !a.archived && inPesos(a))

  const errors = {
    name: !name.trim() ? 'Ponle un nombre a la inversión.' : '',
    amount: fromAccountId && !amount ? 'Ingresa cuánto aportas.' : '',
    date: !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Ingresa una fecha válida.' : '',
  }
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : '')

  function changePlatform(v: string) {
    setPlatform(v)
    const inst = findInstitution(v)
    if (inst && !colorTouched) setColor(inst.color)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setError('')
    setBusy(true)
    const common = {
      name: name.trim(),
      counterparty: platform.trim() || null,
      institution: institution?.id ?? null,
      investment_kind: kind,
      color,
    }
    try {
      if (investment) {
        await updateAccount(investment.id, { ...common, initial_balance: amount ?? 0, archived })
        toast('Cambios guardados')
      } else {
        await createTrackedAccount(
          // Si sale de una cuenta, el aporte entra por la transferencia; si no, es lo aportado antes.
          { ...common, type: 'investment', initial_balance: fromAccountId ? 0 : amount ?? 0 },
          { cashAccountId: fromAccountId || null, cashAmount: amount, date, value },
        )
        toast('Inversión guardada')
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!investment) return
    const ok = await confirm({
      title: 'Eliminar inversión',
      message: <>¿Eliminar <strong>{investment.name}</strong> y sus valores registrados? Esta acción no se puede deshacer.</>,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteAccount(investment.id)
      toast('Inversión eliminada')
      ;(onDeleted ?? onDone)()
    } catch (err) {
      setError(
        err instanceof AppError && err.code === '23503'
          ? 'Tiene aportes o rescates registrados, por eso no se puede eliminar. Puedes archivarla para ocultarla.'
          : err instanceof Error ? err.message : 'No se pudo eliminar.',
      )
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="Nombre" required maxLength={60} data-autofocus={!editing || undefined} error={show('name')}
        placeholder="Ej: Fondo conservador, Acciones, DAP 90 días" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="¿Dónde está? (opcional)" maxLength={80} list="investment-platforms" placeholder="Ej: Fintual, BancoEstado"
        value={platform} onChange={(e) => changePlatform(e.target.value)}
        hint={institution ? `Se mostrará con el logo de ${institution.name}.` : undefined} />
      <datalist id="investment-platforms">{PLATFORM_SUGGESTIONS.map((p) => <option key={p} value={p} />)}</datalist>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[0.8125rem] font-medium text-soft">Tipo</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(INVESTMENT_KINDS) as InvestmentKind[]).map((k) => {
            const Icon = INVESTMENT_ICONS[k]
            const active = kind === k
            return (
              <label key={k}
                className={`pressable flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm transition-colors duration-200
                  has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                  active ? 'border-ink bg-subtle font-semibold text-ink' : 'border-line bg-surface text-soft hover:text-ink'}`}>
                <input type="radio" name="investment-kind" className="sr-only" checked={active} onChange={() => setKind(k)} />
                <Icon size={18} strokeWidth={active ? 2 : 1.75} aria-hidden />{INVESTMENT_KINDS[k]}
              </label>
            )
          })}
        </div>
      </fieldset>

      {editing ? (
        <AmountInput label="Aportado antes de usar la app" value={amount} onChange={setAmount}
          hint="Los aportes y rescates que registras aquí se suman aparte." />
      ) : (
        <>
          <AmountInput label={fromAccountId ? 'Monto que aportas' : '¿Cuánto has invertido? (opcional)'} value={amount}
            onChange={setAmount} error={show('amount')} />
          <Select label="¿De dónde sale el dinero?" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
            <option value="">Ya estaba invertido (no mover dinero)</option>
            {usable.map((a) => <option key={a.id} value={a.id}>Lo aporto ahora desde {a.name}</option>)}
          </Select>
          {fromAccountId && <p className="-mt-2 text-xs text-muted">Se resta de esa cuenta sin contar como gasto.</p>}
          <div className="grid grid-cols-2 gap-3">
            <AmountInput label="¿Cuánto vale hoy? (opcional)" value={value} onChange={setValue} />
            <Field label="Fecha" type="date" value={date} max={todayISO()} error={show('date')} onChange={(e) => setDate(e.target.value)} />
          </div>
          <p className="-mt-2 text-xs text-muted">Si no sabes cuánto vale, déjalo vacío: valdrá lo aportado hasta que lo actualices.</p>
        </>
      )}

      <ColorPicker value={color} onChange={(c) => { setColor(c); setColorTouched(true) }}
        suggested={institution?.color} suggestedLabel={institution ? `Color de ${institution.name}` : undefined} />

      {investment && (
        <Checkbox label="Archivar" hint="Se oculta de la lista y conserva su historial." checked={archived} onChange={setArchived} />
      )}

      <Button type="submit" size="lg" loading={busy}>{investment ? 'Guardar cambios' : 'Guardar inversión'}</Button>
      {investment && <Button type="button" variant="ghost" icon={Trash2} className="text-neg" onClick={onDelete}>Eliminar inversión</Button>}
    </form>
  )
}
