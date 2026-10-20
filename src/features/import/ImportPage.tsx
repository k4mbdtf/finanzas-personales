// Importar cartola CSV en 3 pasos:
//   1) Archivo y cuenta   2) Qué columna es qué   3) Revisar y elegir categorías
// Duplicados: cada fila tiene una huella (cuenta+fecha+monto+descripción); las ya
// importadas se omiten solas, y las que coinciden con movimientos ingresados a mano
// quedan desmarcadas como "posible duplicado".
import { useMemo, useState, type ChangeEvent } from 'react'
import { useRefData } from '@/context/RefData'
import { categoryMemory, deleteBatch, existingHashes, importRows, listBatches, manualKeys, type ImportPayloadRow } from '@/data/imports'
import { useQuery } from '@/hooks/useQuery'
import {
  decodeText, detectDelimiter, guessDateOrder, guessHeaderRow, guessMapping, normalizeForMatch, parseCSV,
  type DateOrder, type Mapping,
} from '@/lib/csv'
import {
  ArrowRight, Check, ChevronLeft, ChevronRight, FileSpreadsheet, FileUp, ListChecks, RefreshCw, TriangleAlert, Undo2, X,
} from 'lucide-react'
import { formatCLP, formatDate } from '@/lib/format'
import { useConfirm, useToast } from '@/components/Feedback'
import { IconTile } from '@/components/icons'
import { Alert, Badge, Button, Card, Checkbox, Loading, PageHeader, SectionHeader, Segmented, Select } from '@/components/ui'
import { buildRows, rowKeys, sha256, type ImportRow } from './rows'

const MAX_ROWS = 5000
const MAX_BYTES = 5 * 1024 * 1024
const PAGE = 100

type Status = 'new' | 'imported' | 'possible' | 'error'
type ReviewRow = ImportRow & {
  hash: string | null; status: Status; include: boolean; type: 'income' | 'expense'; categoryId: string | null
}

const STATUS_UI: Record<Status, { label: string; tone: 'neutral' | 'pos' | 'neg' | 'warn' }> = {
  new: { label: 'Nuevo', tone: 'pos' },
  imported: { label: 'Ya importado', tone: 'neutral' },
  possible: { label: 'Posible duplicado', tone: 'warn' },
  error: { label: 'Omitida', tone: 'neg' },
}

/** Indicador de pasos (1 · 2 · 3) con barra que avanza. */
function Steps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Pasos">
      {labels.map((l, i) => {
        const done = i < current
        const on = i === current
        return (
          <li key={l} aria-current={on ? 'step' : undefined} className="flex flex-col gap-2">
            <span className="relative h-1 overflow-hidden rounded-full bg-subtle">
              <span className={`absolute inset-0 origin-left rounded-full bg-ink transition-transform duration-500 ease-soft ${done || on ? 'scale-x-100' : 'scale-x-0'}`} />
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium ${on ? 'text-ink' : 'text-muted'}`}>
              {done ? <Check size={13} strokeWidth={2.5} aria-hidden /> : <span className="tabular-nums">{i + 1}.</span>}
              {l}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const colLetter = (i: number) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '')

export default function ImportPage() {
  const { accounts, categories, categoryById, accountById } = useRefData()
  const confirm = useConfirm()
  const toast = useToast()
  const usable = accounts.filter((a) => !a.archived)

  const [step, setStep] = useState<'file' | 'map' | 'review'>('file')
  const [accountId, setAccountId] = useState(usable[0]?.id ?? '')
  const [fileName, setFileName] = useState('')
  const [table, setTable] = useState<string[][]>([])
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<Mapping>({ date: -1, description: -1, amount: null, debit: null, credit: null })
  const [twoCols, setTwoCols] = useState(false)
  const [invert, setInvert] = useState(false)
  const [order, setOrder] = useState<DateOrder>('dmy')
  const [review, setReview] = useState<ReviewRow[]>([])
  const [visible, setVisible] = useState(PAGE)
  const [bulkCat, setBulkCat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const batches = useQuery(listBatches, [], ['imports'])

  const headers = table[headerRow] ?? []
  const columns = headers.map((h, i) => ({ i, label: `${colLetter(i)}: ${h || '(sin título)'}` }))
  const effective: Mapping = twoCols
    ? { ...mapping, amount: null }
    : { ...mapping, debit: null, credit: null, amount: mapping.amount ?? -1 }
  const preview = useMemo(
    () => (step === 'map' ? buildRows(table.slice(0, headerRow + 7), headerRow, effective, order, invert) : []),
    [step, table, headerRow, JSON.stringify(effective), order, invert],
  )

  function reset(keepResult = false) {
    setStep('file'); setTable([]); setReview([]); setFileName(''); setError('')
    if (!keepResult) setResult('')
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(''); setResult('')
    if (file.size > MAX_BYTES) return setError('El archivo es muy grande (máximo 5 MB).')
    if (/\.xlsx?$/i.test(file.name)) {
      return setError('Ese es un archivo Excel. Ábrelo y usa "Guardar como → CSV", luego súbelo aquí.')
    }
    try {
      const text = decodeText(await file.arrayBuffer())
      const rows = parseCSV(text, detectDelimiter(text))
      if (rows.length < 2) return setError('No encontramos filas en el archivo. ¿Es un CSV?')
      const hr = guessHeaderRow(rows)
      if (rows.length - hr - 1 > MAX_ROWS) return setError(`El archivo tiene más de ${MAX_ROWS} filas. Divídelo en partes.`)
      const m = guessMapping(rows[hr])
      setTable(rows); setHeaderRow(hr); setFileName(file.name)
      setMapping(m); setTwoCols(m.debit != null && m.credit != null); setInvert(false)
      setOrder(guessDateOrder(rows.slice(hr + 1, hr + 60).map((r) => r[m.date] ?? '')))
      setStep('map')
    } catch {
      setError('No pudimos leer el archivo. Verifica que sea un CSV.')
    }
  }

  function changeHeaderRow(i: number) {
    setHeaderRow(i)
    const m = guessMapping(table[i] ?? [])
    setMapping(m); setTwoCols(m.debit != null && m.credit != null)
  }

  async function prepareReview() {
    if (mapping.date < 0) return setError('Elige la columna de la fecha.')
    if (twoCols ? (mapping.debit == null || mapping.credit == null || mapping.debit < 0 || mapping.credit < 0) : (mapping.amount == null || mapping.amount < 0)) {
      return setError(twoCols ? 'Elige las columnas de cargo y abono.' : 'Elige la columna del monto.')
    }
    setError(''); setBusy(true)
    try {
      const rows = buildRows(table, headerRow, effective, order, invert)
      const keys = rowKeys(accountId, rows)
      const hashes = await Promise.all(keys.map((k) => (k ? sha256(k) : Promise.resolve(null))))
      const valid = rows.filter((r) => !r.error)
      if (valid.length === 0) {
        setBusy(false)
        return setError('Ninguna fila tiene fecha y monto válidos. Revisa las columnas y el formato de fecha.')
      }
      const dates = valid.map((r) => r.date!).sort()
      const [existing, manual, memory] = await Promise.all([
        existingHashes(hashes.filter((h): h is string => !!h)),
        manualKeys(accountId, dates[0], dates[dates.length - 1]),
        categoryMemory(),
      ])
      setReview(rows.map((r, i) => {
        const hash = hashes[i]
        const type = (r.amount ?? 0) < 0 ? 'expense' as const : 'income' as const
        const status: Status = r.error ? 'error'
          : existing.has(hash!) ? 'imported'
          : manual.has(`${r.date}|${type}|${Math.abs(r.amount!)}`) ? 'possible'
          : 'new'
        const suggested = memory.get(`${type}|${normalizeForMatch(r.description)}`)
        const cat = suggested ? categoryById.get(suggested) : undefined
        return {
          ...r, hash, type, status, include: status === 'new',
          categoryId: cat && !cat.archived && cat.kind === type ? cat.id : null,
        }
      }))
      setVisible(PAGE)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar la revisión.')
    }
    setBusy(false)
  }

  const update = (i: number, patch: Partial<ReviewRow>) =>
    setReview((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const selectable = (r: ReviewRow) => r.status === 'new' || r.status === 'possible'
  const selected = review.filter((r) => r.include && selectable(r))
  const counts = review.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] ?? 0) + 1 }), {} as Record<Status, number>)

  function applyBulk() {
    const cat = categoryById.get(bulkCat)
    if (!cat) return
    setReview((rs) => rs.map((r) =>
      r.include && selectable(r) && r.type === cat.kind ? { ...r, categoryId: cat.id } : r))
    toast(`"${cat.name}" aplicada a las filas marcadas de ${cat.kind === 'expense' ? 'gasto' : 'ingreso'}`)
  }

  async function doImport() {
    if (selected.length === 0) return
    setBusy(true); setError('')
    const payload: ImportPayloadRow[] = selected.map((r) => ({
      type: r.type, amount: Math.abs(r.amount!), date: r.date!, category_id: r.categoryId,
      note: r.description, import_hash: r.hash!,
    }))
    try {
      const res = await importRows(accountId, fileName, payload)
      const msg = `Se importaron ${res.inserted} movimiento${res.inserted === 1 ? '' : 's'}`
        + (res.skipped ? ` (${res.skipped} ya existían)` : '') + ` en ${accountById.get(accountId)?.name ?? 'la cuenta'}.`
      toast(msg)
      setResult(msg)
      reset(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar.')
    }
    setBusy(false)
  }

  async function undo(id: string, name: string, n: number) {
    const ok = await confirm({
      title: 'Deshacer importación',
      message: <>Se eliminarán los <strong>{n} movimientos</strong> importados desde "{name}".</>,
      confirmLabel: 'Deshacer', danger: true,
    })
    if (!ok) return
    try {
      await deleteBatch(id)
      toast('Importación deshecha')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo deshacer', 'error')
    }
  }

  const colSelect = (label: string, value: number | null, onChange: (v: number) => void, optional = false) => (
    <Select label={label} value={value ?? -1} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={-1}>{optional ? '(ninguna)' : 'Elegir…'}</option>
      {columns.map((c) => <option key={c.i} value={c.i}>{c.label}</option>)}
    </Select>
  )

  if (usable.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Importar cartola" />
        <Alert kind="info">Primero crea la cuenta (banco o tarjeta) a la que corresponde la cartola, en Cuentas.</Alert>
      </div>
    )
  }

  const stepIndex = { file: 0, map: 1, review: 2 }[step]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Importar cartola" subtitle="Carga los movimientos de tu banco desde un archivo CSV." />
      <Steps current={stepIndex} labels={['Archivo', 'Columnas', 'Revisión']} />
      {result && <Alert kind="success">{result}</Alert>}
      {error && <Alert>{error}</Alert>}

      {step === 'file' && (
        <Card className="animate-enter flex flex-col gap-5">
          <h2 className="text-[1.0625rem] font-semibold tracking-tight">Elige la cuenta y el archivo</h2>
          <Select label="¿De qué cuenta es la cartola?" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <label className="pressable flex cursor-pointer flex-col items-center gap-3 rounded-lg border-[1.5px] border-dashed border-line-strong/50 bg-subtle/40 p-8 text-center transition-colors duration-200 hover:bg-subtle has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
            <span className="grid size-12 place-items-center rounded-lg bg-surface text-ink shadow-[var(--shadow-card)]" aria-hidden>
              <FileUp size={22} strokeWidth={1.75} />
            </span>
            <span className="font-semibold">Seleccionar archivo CSV</span>
            <span className="text-xs text-muted">Máximo {MAX_ROWS} filas o 5 MB</span>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} />
          </label>
          <details className="group text-sm text-soft">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight size={16} strokeWidth={2} className="transition-transform duration-300 ease-soft group-open:rotate-90" aria-hidden />
              ¿Cómo descargo mi cartola?
            </summary>
            <p className="mt-2 pl-5 leading-relaxed">
              En la web de tu banco busca <strong>Cartola</strong> o <strong>Movimientos</strong> y descárgala en formato
              CSV. Si solo ofrece Excel, ábrelo y usa <strong>Archivo → Guardar como → CSV</strong>. Puedes subir la
              misma cartola varias veces: los movimientos ya importados no se duplican.
            </p>
          </details>
        </Card>
      )}

      {step === 'map' && (
        <Card className="animate-enter flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[1.0625rem] font-semibold tracking-tight">¿Qué es cada columna?</h2>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => reset()}>Cambiar archivo</Button>
          </div>
          <p className="text-sm text-soft">
            <strong>{fileName}</strong> · {table.length - headerRow - 1} filas. Revisamos el archivo y adivinamos las columnas; corrígelas si hace falta.
          </p>
          <Select label="Fila con los títulos de las columnas" value={headerRow} onChange={(e) => changeHeaderRow(Number(e.target.value))}>
            {table.slice(0, 20).map((r, i) => (
              <option key={i} value={i}>Fila {i + 1}: {r.filter(Boolean).slice(0, 4).join(' | ').slice(0, 60)}</option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            {colSelect('Fecha', mapping.date, (v) => setMapping({ ...mapping, date: v }))}
            {colSelect('Descripción', mapping.description, (v) => setMapping({ ...mapping, description: v }), true)}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium text-soft">¿Cómo vienen los montos?</span>
            <Segmented<'one' | 'two'> label="¿Cómo vienen los montos?" value={twoCols ? 'two' : 'one'}
              onChange={(v) => setTwoCols(v === 'two')}
              options={[{ value: 'one', label: 'Una columna' }, { value: 'two', label: 'Cargos y abonos' }]} />
            <p className="text-xs text-muted">{twoCols ? 'Los cargos son gastos y los abonos, ingresos.' : 'Los números negativos son cargos (gastos).'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {twoCols ? (
              <>
                {colSelect('Cargos (gastos)', mapping.debit, (v) => setMapping({ ...mapping, debit: v }))}
                {colSelect('Abonos (ingresos)', mapping.credit, (v) => setMapping({ ...mapping, credit: v }))}
              </>
            ) : colSelect('Monto', mapping.amount, (v) => setMapping({ ...mapping, amount: v }))}
            <Select label="Formato de fecha" value={order} onChange={(e) => setOrder(e.target.value as DateOrder)}>
              <option value="dmy">Día/Mes/Año (31/12/2026)</option>
              <option value="mdy">Mes/Día/Año (12/31/2026)</option>
              <option value="ymd">Año-Mes-Día (2026-12-31)</option>
            </Select>
          </div>
          <Checkbox label="Invertir signos" checked={invert} onChange={setInvert}
            hint="Actívalo si los gastos aparecen como números positivos (común en cartolas de tarjeta)." />

          <div>
            <h3 className="label-caps mb-2">Vista previa</h3>
            <ul className="overflow-hidden rounded-sm border border-line text-sm">
              {preview.length === 0 && <li className="p-3 text-muted">Sin filas para mostrar.</li>}
              {preview.slice(0, 5).map((r) => (
                <li key={r.line} className="flex items-center gap-2 border-b border-line px-3 py-2.5 last:border-0">
                  <span className="w-24 shrink-0 tabular-nums">{r.date ? formatDate(r.date) : '—'}</span>
                  <span className="min-w-0 flex-1 truncate">{r.description || '—'}</span>
                  <span className={`shrink-0 tabular-nums ${r.error ? 'text-muted' : (r.amount ?? 0) < 0 ? 'text-neg' : 'text-pos'}`}>
                    {r.error ?? `${(r.amount ?? 0) < 0 ? '−' : '+'}${formatCLP(Math.abs(r.amount ?? 0))}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Button size="lg" onClick={prepareReview} loading={busy}>Revisar movimientos <ArrowRight size={18} strokeWidth={2} aria-hidden /></Button>
        </Card>
      )}

      {step === 'review' && (
        <Card className="animate-enter flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[1.0625rem] font-semibold tracking-tight">Revisa y elige categorías</h2>
            <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setStep('map')}>Columnas</Button>
          </div>
          <p className="text-sm text-soft">
            {counts.new ?? 0} nuevos · {counts.imported ?? 0} ya importados · {counts.possible ?? 0} posibles duplicados
            {counts.error ? ` · ${counts.error} omitidos (sin fecha o monto)` : ''}.
            Los posibles duplicados coinciden en fecha y monto con un movimiento que ingresaste a mano; quedan sin marcar.
          </p>

          <div className="flex flex-wrap items-end gap-2">
            <Button variant="secondary" size="sm" icon={ListChecks}
              onClick={() => setReview((rs) => rs.map((r) => ({ ...r, include: r.status === 'new' })))}>Marcar nuevos</Button>
            <Button variant="secondary" size="sm" icon={X}
              onClick={() => setReview((rs) => rs.map((r) => ({ ...r, include: false })))}>Desmarcar todo</Button>
            <div className="flex min-w-60 flex-1 items-end gap-2">
              <div className="flex-1">
                <Select label="Categoría para los marcados" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
                  <option value="">Elegir…</option>
                  <optgroup label="Gastos">{categories.filter((c) => c.kind === 'expense' && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                  <optgroup label="Ingresos">{categories.filter((c) => c.kind === 'income' && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </Select>
              </div>
              <Button variant="secondary" disabled={!bulkCat} onClick={applyBulk}>Aplicar</Button>
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-sm border border-line">
            {review.slice(0, visible).map((r, i) => {
              const ui = STATUS_UI[r.status]
              const can = selectable(r)
              return (
                <li key={r.line} className={`flex flex-col gap-2 p-3 transition-colors duration-200 ${can ? (r.include ? 'bg-surface' : 'bg-subtle/40') : 'opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--accent)]" checked={r.include && can} disabled={!can}
                      aria-label={`Importar fila ${r.line}: ${r.description}`} onChange={(e) => update(i, { include: e.target.checked })} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.description || '(sin descripción)'}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span>Fila {r.line} · {r.date ? formatDate(r.date) : 'fecha inválida'}</span>
                        <Badge tone={ui.tone}>{r.status === 'possible' && <TriangleAlert size={11} strokeWidth={2.5} aria-hidden />}{r.error ?? ui.label}</Badge>
                      </p>
                    </div>
                    {r.amount != null && r.amount !== 0 && (
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${r.type === 'expense' ? 'text-neg' : 'text-pos'}`}>
                        <span className="sr-only">{r.type === 'expense' ? 'Gasto' : 'Ingreso'}: </span>
                        {r.type === 'expense' ? '−' : '+'}{formatCLP(Math.abs(r.amount))}
                      </span>
                    )}
                  </div>
                  {can && (
                    <select aria-label={`Categoría de la fila ${r.line}`} value={r.categoryId ?? ''}
                      onChange={(e) => update(i, { categoryId: e.target.value || null })}
                      className="ml-8 min-h-10 rounded-sm border border-line-strong/45 bg-surface px-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10">
                      <option value="">Sin categoría</option>
                      {categories.filter((c) => c.kind === r.type && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
          {visible < review.length && (
            <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>Mostrar más ({review.length - visible})</Button>
          )}

          <Button size="lg" icon={FileUp} onClick={doImport} loading={busy} disabled={selected.length === 0}>
            Importar {selected.length} movimiento{selected.length === 1 ? '' : 's'}
          </Button>
        </Card>
      )}

      <section>
        <SectionHeader title="Importaciones recientes" />
        {batches.loading && !batches.data ? <Loading /> : !batches.data?.length ? (
          <p className="text-sm text-soft">Aún no has importado cartolas.</p>
        ) : (
          <ul className="card stagger overflow-hidden">
            {batches.data.map((b) => (
              <li key={b.id} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
                <IconTile icon={FileSpreadsheet} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.filename || 'Cartola'}</span>
                  <span className="block text-xs text-muted">
                    {accountById.get(b.account_id)?.name ?? 'Cuenta'} · {b.row_count} movimientos ·{' '}
                    {new Date(b.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </span>
                <Button variant="ghost" size="sm" icon={Undo2} onClick={() => undo(b.id, b.filename || 'Cartola', b.row_count)}>Deshacer</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
