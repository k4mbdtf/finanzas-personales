import { useState } from 'react'
import { ListOrdered, Plus, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { useMonth } from '@/context/Month'
import { useRefData } from '@/context/RefData'
import { listTags, listTransactions, type TxFilters } from '@/data/transactions'
import { useDebounced, useQuery } from '@/hooks/useQuery'
import { monthLabel, monthRange } from '@/lib/dates'
import { Alert, Button, Checkbox, EmptyState, Field, Loading, PageHeader, Select } from '@/components/ui'
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
  // Filtros del panel (sin contar el texto de búsqueda, que está a la vista).
  const panelCount = Object.entries(f).filter(([k, v]) => k !== 'text' && v).length + (customRange ? 1 : 0)
  const anyFilter = panelCount > 0 || !!f.text

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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Movimientos"
        subtitle={<span aria-live="polite">{customRange ? `${range.from} a ${range.to}` : monthLabel(month)} · {total} movimiento{total === 1 ? '' : 's'}</span>}
        action={
          <Button variant="secondary" icon={SlidersHorizontal} aria-expanded={showFilters} aria-controls="filtros"
            onClick={() => setShowFilters((v) => !v)}>
            Filtros{panelCount > 0 && ` · ${panelCount}`}
          </Button>
        }
      />

      {/* Búsqueda con ícono, al estilo de iOS */}
      <div className="relative">
        <label htmlFor="buscar" className="sr-only">Buscar en notas</label>
        <Search size={18} strokeWidth={2} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input id="buscar" type="search" placeholder="Buscar en notas" value={f.text} onChange={(e) => set('text', e.target.value)}
          className="min-h-11 w-full rounded-sm border border-line bg-surface pr-10 pl-10 text-base text-ink shadow-[var(--shadow-card)]
            placeholder:text-muted/70 transition-[border-color,box-shadow] duration-200 focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10
            [&::-webkit-search-cancel-button]:hidden" />
        {f.text && (
          <button type="button" onClick={() => set('text', '')} aria-label="Borrar búsqueda"
            className="pressable animate-fade absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-subtle text-muted hover:text-ink">
            <X size={14} strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>

      {showFilters && (
        <div id="filtros" className="card animate-enter grid gap-4 p-5 sm:grid-cols-2">
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

          <div className="sm:col-span-2">
            <Checkbox label="Usar un rango de fechas en vez del mes seleccionado" checked={customRange}
              onChange={(v) => { setCustomRange(v); setRange(monthRange(month)); setLimit(PAGE) }} />
          </div>
          {customRange && (
            <>
              <Field label="Desde" type="date" value={range.from} max={range.to}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
              <Field label="Hasta" type="date" value={range.to} min={range.from}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
            </>
          )}
          {anyFilter && <Button variant="ghost" icon={X} className="sm:col-span-2" onClick={clear}>Limpiar filtros</Button>}
        </div>
      )}

      {q.error && <Alert>{q.error}</Alert>}

      {q.loading && !q.data ? (
        <Loading label="Cargando movimientos…" rows={5} />
      ) : rows.length === 0 ? (
        anyFilter ? (
          <EmptyState icon={SearchX} title="Sin resultados" action={<Button variant="secondary" icon={X} onClick={clear}>Limpiar filtros</Button>}>
            No hay movimientos que coincidan con estos filtros.
          </EmptyState>
        ) : (
          <EmptyState icon={ListOrdered} title={`Sin movimientos en ${monthLabel(month)}`}
            action={<Button icon={Plus} onClick={() => openNew()}>Nueva transacción</Button>}>
            Registra tus gastos, ingresos y transferencias entre cuentas. Toma menos de 10 segundos.
          </EmptyState>
        )
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity duration-200 ${q.loading ? 'opacity-60' : ''}`}>
          <TransactionList rows={rows} onSelect={openEdit} />
          {rows.length < total && (
            <Button variant="secondary" loading={q.loading} onClick={() => setLimit((l) => l + PAGE)}>
              Cargar más ({total - rows.length} restantes)
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
