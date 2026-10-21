// Mostrar montos según la moneda de cada cuenta y la moneda elegida en "Ver en".
import { useRefData } from '@/context/RefData'
import { balanceCLP, currencyOf, formatMoney, fromCLP, nativeBalance, type Currency } from '@/lib/currency'

type Acc = { currency?: Currency | null; balance: number; balance_native?: number | null }

export function useMoney() {
  const { rates, viewCurrency, multiCurrency } = useRefData()
  /** Pesos en la moneda de "Ver en" (en pesos si falta el valor). */
  const view = (clp: number) => {
    const v = fromCLP(clp, viewCurrency, rates)
    return v == null ? formatMoney(clp) : formatMoney(v, viewCurrency)
  }
  return {
    rates, viewCurrency, multiCurrency, view,
    /** Saldo de hoy en pesos (UF/USD al valor de hoy). */
    clp: (a: Acc) => balanceCLP(a, rates),
    /** Saldo en la moneda de la cuenta. */
    native: (a: Acc) => formatMoney(nativeBalance(a), currencyOf(a)),
    /** "≈ ..." en la moneda de "Ver en", solo si es distinta a la de la cuenta. */
    approx: (a: Acc) => (currencyOf(a) === viewCurrency ? null : `≈ ${view(balanceCLP(a, rates))}`),
  }
}
