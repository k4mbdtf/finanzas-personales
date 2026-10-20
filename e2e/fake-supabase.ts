// Supabase simulado en memoria para las pruebas de punta a punta.
// Intercepta (page.route) las llamadas a Auth y a la API REST (PostgREST) y
// responde como lo haría Supabase, con lo justo para los flujos que se prueban:
// filtros eq/neq/gte/lte/is/cs/ilike/or, order, limit, count, insert, update,
// delete, la vista account_balances y las RPC del resumen. Así las pruebas no
// necesitan un proyecto real ni credenciales, y corren igual en el CI.
import type { Page, Route } from '@playwright/test'

export const SUPABASE_URL = 'https://e2e-test.supabase.co'
export const ANON_KEY = 'e2e-anon-key'
const STORAGE_KEY = 'sb-e2e-test-auth-token'

type Row = Record<string, unknown>

export const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'ana@example.com',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
export const PASSWORD = 'Secreta123'

const CATEGORIES: Row[] = [
  { name: 'Comida', kind: 'expense', color: '#e8590c', icon: 'utensils', sort_order: 1 },
  { name: 'Transporte', kind: 'expense', color: '#1971c2', icon: 'bus', sort_order: 2 },
  { name: 'Sueldo', kind: 'income', color: '#2f9e44', icon: 'briefcase', sort_order: 1 },
].map((c, i) => ({ id: uuid(100 + i), user_id: USER.id, archived: false, ...c }))

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function account(name: string, initial_balance: number, extra: Row = {}): Row {
  return {
    user_id: USER.id, name, type: 'bank', initial_balance, credit_limit: null, closing_day: null,
    payment_day: null, counterparty: null, loan_amount: null, loan_installment: null,
    loan_installments_count: null, interest_rate: null, institution: null, investment_kind: null,
    color: '#1971c2', archived: false, ...extra,
  }
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {
    profiles: [], accounts: [], categories: structuredClone(CATEGORIES), transactions: [], budgets: [],
  }
  /** Peticiones REST recibidas (método + ruta con query), para revisar qué consultó la app. */
  requests: { method: string; path: string; params: URLSearchParams }[] = []
  private nextId = 1000
  private token = 'token-de-ana'

  constructor(seed: { accounts?: Row[] } = {}) {
    for (const a of seed.accounts ?? []) this.insert('accounts', a)
  }

  get categories() { return this.tables.categories }

  /** Intercepta Supabase en la página. Con `signedIn` la sesión ya está guardada (como al volver a abrir la app). */
  async install(page: Page, { signedIn = false } = {}) {
    if (signedIn) {
      await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(this.session())])
    }
    await page.route(`${SUPABASE_URL}/**`, (route) => this.handle(route))
  }

  private session() {
    return {
      access_token: this.token, refresh_token: `refresh-${this.token}`, token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER,
    }
  }

  private insert(table: string, row: Row): Row {
    const full = { id: uuid(this.nextId++), user_id: USER.id, created_at: new Date().toISOString(), ...row }
    if (table === 'transactions') {
      Object.assign(full, { to_account_id: null, category_id: null, note: null, tags: [], recurring_rule_id: null,
        installment_plan_id: null, installment_no: null, import_batch_id: null, ...row })
    }
    ;(this.tables[table] ??= []).push(full)
    return full
  }

  private async handle(route: Route) {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname

    if (path.startsWith('/auth/v1/')) return this.auth(route, path.slice('/auth/v1/'.length))
    if (!path.startsWith('/rest/v1/')) return route.fulfill({ status: 404, json: {} })

    // Igual que con RLS: sin el token de la sesión no se ve nada.
    if (req.headers()['apikey'] !== ANON_KEY || req.headers()['authorization'] !== `Bearer ${this.token}`) {
      return route.fulfill({ status: 401, json: { code: 'PGRST301', message: 'JWT inválido o ausente' } })
    }
    const name = path.slice('/rest/v1/'.length)
    this.requests.push({ method: req.method(), path: `${path}${url.search}`, params: url.searchParams })

    if (name.startsWith('rpc/')) return route.fulfill({ json: this.rpc(name.slice(4), req.postDataJSON() ?? {}) })

    const prefer = req.headers()['prefer'] ?? ''
    const returnRows = prefer.includes('return=representation')
    switch (req.method()) {
      case 'GET':
      case 'HEAD': {
        const all = this.query(name, url.searchParams)
        const limit = Number(url.searchParams.get('limit') ?? all.length)
        const rows = all.slice(0, limit)
        // Como Supabase: el total va en Content-Range, expuesto a JS por CORS.
        const headers = {
          'content-range': `${rows.length ? `0-${rows.length - 1}` : '*'}/${all.length}`,
          'access-control-expose-headers': 'Content-Range',
        }
        return route.fulfill({ json: rows, headers })
      }
      case 'POST': {
        const body = req.postDataJSON()
        const created = (Array.isArray(body) ? body : [body]).map((r: Row) => this.insert(name, r))
        return returnRows ? route.fulfill({ status: 201, json: created }) : route.fulfill({ status: 201, body: '' })
      }
      case 'PATCH': {
        const changed = this.query(name, url.searchParams)
        changed.forEach((r) => Object.assign(r, req.postDataJSON()))
        return returnRows ? route.fulfill({ json: changed }) : route.fulfill({ status: 204, body: '' })
      }
      case 'DELETE': {
        const gone = new Set(this.query(name, url.searchParams))
        this.tables[name] = (this.tables[name] ?? []).filter((r) => !gone.has(r))
        return returnRows ? route.fulfill({ json: [...gone] }) : route.fulfill({ status: 204, body: '' })
      }
    }
    return route.fulfill({ status: 405, json: {} })
  }

  private auth(route: Route, endpoint: string) {
    const req = route.request()
    if (endpoint === 'token') {
      const body = req.postDataJSON() ?? {}
      if (body.email === USER.email && body.password === PASSWORD) return route.fulfill({ json: this.session() })
      return route.fulfill({
        status: 400,
        json: { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
      })
    }
    if (endpoint === 'user') return route.fulfill({ json: USER })
    if (endpoint === 'logout') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 404, json: {} })
  }

  /** Filas de una tabla (o de la vista account_balances) que cumplen los filtros de la URL. */
  private query(name: string, params: URLSearchParams): Row[] {
    let rows = name === 'account_balances' ? this.balances() : (this.tables[name] ?? [])
    for (const [col, expr] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(col)) continue
      if (col === 'or') {
        const parts = expr.replace(/^\(|\)$/g, '').split(',')
        rows = rows.filter((r) => parts.some((p) => {
          const [c, ...rest] = p.split('.')
          return matches(r[c], rest.join('.'))
        }))
      } else {
        rows = rows.filter((r) => matches(r[col], expr))
      }
    }
    const order = params.get('order')
    if (order) {
      const keys = order.split(',').map((o) => o.split('.') as [string, string])
      rows = [...rows].sort((a, b) => {
        for (const [k, dir] of keys) {
          const cmp = String(a[k] ?? '').localeCompare(String(b[k] ?? ''))
          if (cmp) return dir === 'desc' ? -cmp : cmp
        }
        return 0
      })
    }
    return rows
  }

  private balances(): Row[] {
    return this.tables.accounts.map((a) => {
      let inflow = 0
      let outflow = 0
      for (const t of this.tables.transactions) {
        const amount = Number(t.amount)
        if (t.account_id === a.id) {
          if (t.type === 'income') inflow += amount
          else outflow += amount
        }
        if (t.type === 'transfer' && t.to_account_id === a.id) inflow += amount
      }
      return { account_id: a.id, balance: Number(a.initial_balance) + inflow - outflow, inflow, outflow }
    })
  }

  private rpc(fn: string, args: Row): unknown {
    const inRange = (t: Row) => String(t.date) >= String(args.p_from) && String(t.date) <= String(args.p_to)
    const txs = this.tables.transactions
    switch (fn) {
      case 'materialize_recurring':
        return 0
      case 'monthly_totals': {
        const byMonth = new Map<string, { month: string; income: number; expense: number }>()
        for (const t of txs.filter((t) => inRange(t) && t.type !== 'transfer')) {
          const month = `${String(t.date).slice(0, 7)}-01`
          const m = byMonth.get(month) ?? { month, income: 0, expense: 0 }
          m[t.type as 'income' | 'expense'] += Number(t.amount)
          byMonth.set(month, m)
        }
        return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
      }
      case 'spending_by_category': {
        const totals = new Map<string | null, number>()
        for (const t of txs.filter((t) => inRange(t) && t.type === 'expense')) {
          const id = (t.category_id as string | null) ?? null
          totals.set(id, (totals.get(id) ?? 0) + Number(t.amount))
        }
        return [...totals].map(([category_id, total]) => ({ category_id, total }))
      }
      default:
        return []
    }
  }
}

/** Evalúa un filtro de PostgREST ("eq.x", "gte.2026-10-01", "is.null", "cs.{a}", "ilike.%x%") sobre un valor. */
function matches(value: unknown, expr: string): boolean {
  const dot = expr.indexOf('.')
  const op = expr.slice(0, dot)
  const arg = expr.slice(dot + 1)
  const v = value == null ? null : String(value)
  switch (op) {
    case 'eq': return v === arg
    case 'neq': return Array.isArray(value) ? `{${value.join(',')}}` !== arg : v !== arg
    case 'gte': return v != null && v >= arg
    case 'lte': return v != null && v <= arg
    case 'is': return arg === 'null' ? value == null : String(value) === arg
    case 'cs': return Array.isArray(value) && arg.replace(/^\{|\}$/g, '').split(',').every((x) => value.includes(x))
    case 'ilike': {
      const re = new RegExp(`^${arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i')
      return v != null && re.test(v)
    }
    default: throw new Error(`Filtro no soportado en el Supabase simulado: ${op}`)
  }
}
