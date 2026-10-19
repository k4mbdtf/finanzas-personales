import { useState } from 'react'
import { useMonth } from '@/context/Month'
import { useRefData } from '@/context/RefData'
import { listTags, listTransactions, type TxFilters } from '@/data/transactions'
import { useDebounced, useQuery } from '@/hooks/useQuery'
import { monthLabel, monthRange } from '@/lib/dates'
import { Alert, Button, EmptyState, Field, Select, Spinner } from '@/components/ui'
import type { TxType } from '@/types'
import { TransactionList } from './TransactionList'
import { useTransactionDrawer } from './TransactionDrawer'

const PAGE = 50

type Extra = { type: TxType | ''; accountId: string; categoryId: string; tag: string; text: string }
const EMPTY: Extra = { type: '', accountId: '', categoryId: '', tag: '', text: '' }

export default function TransactionsPage() {
  const { month } = useMonth()
  const { accounts, categories } = useRefData()
  const { openNew, openEdit } = useTransactionDrawer()

  const [f, setF] = useState<Extra>(EMPTY)
  const [customRange, setCustomRange] = useState(false)
  const [range, setRange] = useState(() => monthRange(month))
  const [limit, setLimit] = useState(PAGE)
  const [showFilters, setShowFilters] = useState(false)
  const text = useDebounced(f.text)

  const period = customRange ? range : monthRange(month)
  const filters: TxFilters = { ...f, text, ...period }
  const activeCount = Object.entries(f).filter(([, v]) => v).length + (customRange ? 1 : 0)

  const q = useQuery(
    () => listTransactions(filters, limit),
    [JSON.stringify(filters), limit],
    ['transactions'],
  )
  const tags = useQuery(listTags, [], ['transactions'])

  const set = <K extends keyof Extra>(k: K, v: Extra[K]) => { setF((s) => ({ ...s, [k]: v })); setLimit(PAGE) }
  const clear = () => { setF(EMPTY); setCustomRange(false); setLimit(PAGE) }

  const rows = q.data?.rows ?? []
  const total = q.data?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Movimientos</h1>
        <Button variant="secondary" aria-expanded={showFilters} aria-controls="filtros"
          onClick={() => setShowFilters((v) => !v)}>
          ⚲ Filtros{activeCount > 0 && ` (${activeCount})`}
        </Button>
      </div>

      <Field label="Buscar en notas" type="search" placeholder="Ej: supermercado"
        value={f.text} onChange={(e) => set('text', e.target.value)} />

      {showFilters && (
        <div id="filtros" className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
          <Select label="Tipo" value={f.type} onChange={(e) => set('type', e.target.value as TxType | '')}>
            <option value="">Todos</option>
            <option value="expense">Gastos</option>
            <option value="income">Ingresos</option>
            <option value="transfer">Transferencias</option>
          </Select>
          <Select label="Cuenta" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>
            <option value="">Todas</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (archivada)' : ''}</option>)}
          </Select>
          <Select label="Categoría" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Todas</option>
            <option value="none">Sin categoría</option>
            <optgroup label="Gastos">
              {categories.filter((c) => c.kind === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
            <optgroup label="Ingresos">
              {categories.filter((c) => c.kind === 'income').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          </Select>
          <Select label="Etiqueta" value={f.tag} onChange={(e) => set('tag', e.target.value)}>
            <option value="">Todas</option>
            {(tags.data ?? []).map((t) => <option key={t} value={t}>#{t}</option>)}
          </Select>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4" checked={customRange}
              onChange={(e) => { setCustomRange(e.target.checked); setRange(monthRange(month)); setLimit(PAGE) }} />
            Usar un rango de fechas en vez del mes seleccionado
          </label>
          {customRange && (
            <>
              <Field label="Desde" type="date" value={range.from} max={range.to}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
              <Field label="Hasta" type="date" value={range.to} min={range.from}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
            </>
          )}
          {activeCount > 0 && <Button variant="secondary" className="sm:col-span-2" onClick={clear}>Limpiar filtros</Button>}
        </div>
      )}

      <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
        {customRange ? `${range.from} a ${range.to}` : monthLabel(month)} · {total} movimiento{total === 1 ? '' : 's'}
      </p>

      {q.error && <Alert>{q.error}</Alert>}

      {q.loading && !q.data ? (
        <Spinner label="Cargando movimientos…" />
      ) : rows.length === 0 ? (
        activeCount > 0 || f.text ? (
          <EmptyState icon="🔍" title="Sin resultados" action={<Button variant="secondary" onClick={clear}>Limpiar filtros</Button>}>
            No hay movimientos que coincidan con estos filtros.
          </EmptyState>
        ) : (
          <EmptyState icon="📋" title={`Sin movimientos en ${monthLabel(month)}`}
            action={<Button onClick={() => openNew()}>+ Nueva transacción</Button>}>
            Registra tus gastos, ingresos y transferencias entre cuentas. Toma menos de 10 segundos.
          </EmptyState>
        )
      ) : (
        <>
          <TransactionList rows={rows} onSelect={openEdit} />
          {rows.length < total && (
            <Button variant="secondary" loading={q.loading} onClick={() => setLimit((l) => l + PAGE)}>
              Cargar más ({total - rows.length} restantes)
            </Button>
          )}
        </>
      )}
    </div>
  )
}
