// Resumen anual: ingresos, gastos y ahorro del año comparados con el anterior, meses
// destacados, barras mes a mes y gasto por categoría (con la diferencia vs el año anterior).
// Los totales los calcula la BD (monthly_totals y spending_by_category): las
// transferencias no cuentan como ingreso ni gasto.
import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRefData } from '@/context/RefData'
import { spendingBetween } from '@/data/budgets'
import { monthlyTotals } from '@/data/dashboard'
import { useQuery } from '@/hooks/useQuery'
import { monthLabel, monthRange, monthShort } from '@/lib/dates'
import { formatCLP, formatPct, todayISO } from '@/lib/format'
import { categoryComparison, highlights, yearTotals } from '@/lib/yearSummary'
import { CategoryIcon } from '@/components/icons'
import { Alert, Card, EmptyState, Loading, PageHeader, SectionHeader } from '@/components/ui'
import { Delta, Tile } from '@/features/dashboard/Kpis'
import { IncomeExpenseChart } from '@/features/dashboard/IncomeExpenseChart'

export default function YearPage() {
  const today = todayISO()
  const thisYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const { categoryById } = useRefData()
  // Año en curso: se compara con el mismo período del año anterior (enero hasta este mes),
  // no con el año anterior completo.
  const months = year === thisYear ? Number(today.slice(5, 7)) : 12
  const prevEnd = monthRange(`${year - 1}-${String(months).padStart(2, '0')}`).to

  const q = useQuery(async () => {
    const [totals, spending, prevSpending] = await Promise.all([
      // 24 meses: el año elegido y el anterior en una sola consulta.
      monthlyTotals(`${year}-12`, 24),
      spendingBetween(`${year}-01-01`, `${year}-12-31`),
      spendingBetween(`${year - 1}-01-01`, prevEnd),
    ])
    return { prev: totals.slice(0, months), current: totals.slice(12), spending, prevSpending }
  }, [year, months, prevEnd], ['transactions', 'categories'])

  const btn = 'pressable grid size-10 place-items-center rounded-full text-soft hover:bg-subtle hover:text-ink disabled:opacity-30'
  const selector = (
    <div className="flex items-center gap-1" role="group" aria-label="Año">
      <button type="button" className={btn} onClick={() => setYear(year - 1)} aria-label={`Año anterior: ${year - 1}`}>
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      <span className="min-w-14 text-center text-[0.9375rem] font-semibold tabular-nums" aria-live="polite">{year}</span>
      <button type="button" className={btn} onClick={() => setYear(year + 1)} disabled={year >= thisYear}
        aria-label={`Año siguiente: ${year + 1}`}>
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )

  const header = <PageHeader title="Resumen anual" subtitle={`Enero a diciembre de ${year}`} action={selector} />
  if (q.error) return <div className="flex flex-col gap-8">{header}<Alert>{q.error}</Alert></div>
  if (!q.data) return <div className="flex flex-col gap-8">{header}<Loading rows={4} /></div>

  const { current, prev, spending, prevSpending } = q.data
  const t = yearTotals(current)
  const p = yearTotals(prev)
  const prevLabel = months < 12 ? `ene–${monthShort(prevEnd.slice(0, 7))} ${year - 1}` : String(year - 1)

  if (t.activeMonths === 0) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState icon={CalendarRange} title={`Sin movimientos en ${year}`}>
          Cuando registres ingresos o gastos este año, aquí verás el resumen y la comparación con el anterior.
        </EmptyState>
      </div>
    )
  }

  const { maxExpense, bestSaving } = highlights(current)
  const rows = categoryComparison(spending, prevSpending)

  return (
    <div className={`flex flex-col gap-8 transition-opacity duration-200 ${q.loading ? 'opacity-60' : ''}`} aria-busy={q.loading}>
      {header}

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Ingresos" value={t.income} valueClass="text-pos">
          <Delta current={t.income} previous={p.income} polarity="up-good" prevLabel={prevLabel} />
        </Tile>
        <Tile label="Gastos" value={t.expense} valueClass="text-neg">
          <Delta current={t.expense} previous={p.expense} polarity="up-bad" prevLabel={prevLabel} />
        </Tile>
        <Tile label={t.savingRate != null ? `Ahorro · ${formatPct(t.savingRate)}` : 'Ahorro'} value={t.saving}
          valueClass={t.saving < 0 ? 'text-neg' : ''}>
          <Delta current={t.saving} previous={p.saving} polarity="up-good" prevLabel={prevLabel} absolute />
        </Tile>
        <Tile label="Gasto promedio al mes" value={t.avgExpense}>
          <p className="text-xs text-muted">{t.activeMonths} {t.activeMonths === 1 ? 'mes' : 'meses'} con movimientos</p>
        </Tile>
      </div>

      {(maxExpense || bestSaving) && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {maxExpense && (
            <li className="card p-4 text-sm">
              <p className="label-caps">Mes con más gasto</p>
              <p className="mt-1"><strong>{monthLabel(maxExpense.month)}</strong> · {formatCLP(maxExpense.expense)}</p>
            </li>
          )}
          {bestSaving && (
            <li className="card p-4 text-sm">
              <p className="label-caps">Mes con más ahorro</p>
              <p className="mt-1">
                <strong>{monthLabel(bestSaving.month)}</strong> · {formatCLP(bestSaving.income - bestSaving.expense)}
              </p>
            </li>
          )}
        </ul>
      )}

      <Card>
        <SectionHeader title={`Ingresos y gastos · ${year}`} />
        <IncomeExpenseChart data={current} />
      </Card>

      <section aria-labelledby="anual-categorias">
        <SectionHeader id="anual-categorias" title="Gasto por categoría" />
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No hubo gastos en {year}.</p>
        ) : (
          <Card pad="none">
            <table className="w-full text-sm">
              <caption className="sr-only">Gasto por categoría en {year} y diferencia con {prevLabel}</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Categoría</th>
                  <th className="px-2 py-2.5 text-right font-medium">{year}</th>
                  <th className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">%</th>
                  <th className="px-4 py-2.5 text-right font-medium">vs {prevLabel}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = r.categoryId ? categoryById.get(r.categoryId) : undefined
                  const Arrow = r.diff > 0 ? ArrowUpRight : ArrowDownRight
                  return (
                    <tr key={r.categoryId || 'none'} className="border-b border-line last:border-0">
                      <td className="w-full max-w-0 px-4 py-2.5">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <CategoryIcon name={c?.icon} color={c?.color} size="sm" />
                          <span className="truncate font-medium">{c?.name ?? 'Sin categoría'}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{formatCLP(r.amount)}</td>
                      <td className="hidden px-2 py-2.5 text-right whitespace-nowrap text-muted tabular-nums sm:table-cell">{formatPct(r.share)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                        {r.previous === 0 && r.amount > 0 ? (
                          <span className="text-xs text-muted">Nueva</span>
                        ) : r.diff === 0 ? (
                          <span className="text-xs text-muted">Igual</span>
                        ) : (
                          // Gastar más es malo (rojo); gastar menos, bueno (verde). Siempre con flecha y signo.
                          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${r.diff > 0 ? 'text-neg' : 'text-pos'}`}>
                            <Arrow size={13} strokeWidth={2.25} aria-hidden />
                            <span className="sr-only">{r.diff > 0 ? 'Gastaste más: ' : 'Gastaste menos: '}</span>
                            {r.diff > 0 ? '+' : '−'}{formatCLP(Math.abs(r.diff))}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  )
}
