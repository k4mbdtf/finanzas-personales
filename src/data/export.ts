// Exportar mis datos. Todo pasa por RLS: cada usuario solo puede descargar lo suyo.
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { todayISO } from '@/lib/format'
import { TRANSFER_LABEL, transferKind } from '@/lib/accounts'
import type { Account, Category, Transaction } from '@/types'

const PAGE = 1000 // límite por respuesta de la API de Supabase

/** Lee una tabla completa en páginas de 1000 filas. */
async function fetchAll<T>(table: string, order = 'created_at'): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = unwrap<T[]>(
      await supabase.from(table).select('*').order(order).order('id').range(from, from + PAGE - 1),
    )
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

type Row = Record<string, unknown>

async function fetchEverything() {
  const [profile, accounts, categories, transactions, budgets,
    goals, goal_contributions, recurring_rules, installment_plans, import_batches, investment_valuations] = await Promise.all([
    fetchAll<Row>('profiles'),
    fetchAll<Account>('accounts'),
    fetchAll<Category>('categories'),
    fetchAll<Transaction>('transactions', 'date'),
    fetchAll<Row>('budgets', 'month'),
    fetchAll<Row>('goals'),
    fetchAll<Row>('goal_contributions', 'date'),
    fetchAll<Row>('recurring_rules'),
    fetchAll<Row>('installment_plans'),
    fetchAll<Row>('import_batches'),
    fetchAll<Row>('investment_valuations', 'date'),
  ])
  return {
    profile: profile[0] ?? null, accounts, categories, transactions, budgets,
    goals, goal_contributions, recurring_rules, installment_plans, import_batches, investment_valuations,
  }
}

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Respaldo completo en JSON (todas las tablas, con IDs). */
export async function exportJSON(): Promise<number> {
  const data = await fetchEverything()
  const payload = { app: 'Mis Finanzas', exported_at: new Date().toISOString(), currency: 'CLP', ...data }
  download(JSON.stringify(payload, null, 2), `mis-finanzas-${todayISO()}.json`, 'application/json')
  return data.transactions.length
}

/** Escapa un valor para CSV (separador ";", compatible con Excel en español). */
function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const TYPE_LABEL = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' } as const

/** Movimientos en CSV legible: nombres de cuenta y categoría en vez de IDs. */
export async function exportTransactionsCSV(): Promise<number> {
  const { accounts, categories, transactions } = await fetchEverything()
  const acc = new Map(accounts.map((a) => [a.id, a.name]))
  const accType = new Map(accounts.map((a) => [a.id, a.type]))
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const header = ['Fecha', 'Tipo', 'Monto (CLP)', 'Categoría', 'Cuenta', 'Cuenta destino', 'Nota', 'Etiquetas', 'Origen']
  const origin = (t: Transaction) =>
    t.installment_plan_id ? `Cuota ${t.installment_no ?? ''}`.trim()
      : t.recurring_rule_id ? 'Recurrente'
      : t.import_batch_id ? 'Importado' : 'Manual'
  const lines = transactions.map((t) => [
    t.date,
    // Las transferencias dicen qué son: pago de deuda, aporte a inversión...
    t.type === 'transfer'
      ? TRANSFER_LABEL[transferKind(accType.get(t.account_id), t.to_account_id ? accType.get(t.to_account_id) : undefined)]
      : TYPE_LABEL[t.type],
    // Con signo: gastos negativos; transferencias positivas (no son ingreso ni gasto).
    t.type === 'expense' ? -t.amount : t.amount,
    t.category_id ? cat.get(t.category_id) ?? '' : '',
    acc.get(t.account_id) ?? '',
    t.to_account_id ? acc.get(t.to_account_id) ?? '' : '',
    t.note ?? '',
    t.tags.join(', '),
    origin(t),
  ].map(cell).join(';'))
  // BOM para que Excel reconozca UTF-8 (tildes y ñ).
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n')
  download(csv, `movimientos-${todayISO()}.csv`, 'text/csv;charset=utf-8')
  return transactions.length
}
