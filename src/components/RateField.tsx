// Valor del día de la UF o el dólar en un formulario: se muestra (con el equivalente en
// pesos) y se puede corregir, o escribir si no se pudo obtener.
import { formatMoney, rateLabel, type ForeignCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/format'
import { MoneyInput } from './MoneyInput'

export function RateField({ currency, date, rate, loading, editing, error, clp, onEdit, onChange }: {
  currency: ForeignCurrency; date: string; rate: number | null; loading: boolean; editing: boolean; error: string
  /** Equivalente en pesos del monto (cuentas en UF/USD). */
  clp: number | null
  onEdit: () => void; onChange: (v: number | null) => void
}) {
  const name = currency === 'UF' ? 'la UF' : 'el dólar'
  if (!editing) {
    return (
      <p className="-mt-2 text-xs text-muted" aria-live="polite">
        {loading && !rate ? `Buscando el valor de ${name}…` : rate ? (
          <>
            {rateLabel(currency, rate)} el {formatDate(date)}{clp != null && <> · ≈ {formatMoney(clp)}</>}{' '}
            <button type="button" className="link" onClick={onEdit}>Cambiar</button>
          </>
        ) : null}
      </p>
    )
  }
  return (
    <MoneyInput currency="UF" unit={null} label={`Valor de 1 ${currency} el ${formatDate(date)} en pesos`} value={rate} onChange={onChange}
      error={error} hint={rate ? undefined : `No pudimos obtener el valor de ${name}: escríbelo (lo encuentras en tu banco o en el sitio del Banco Central).`} />
  )
}
