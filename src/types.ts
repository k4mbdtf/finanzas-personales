// Tipos de las tablas de Supabase (escritos a mano para no depender del CLI).
// Si cambias el esquema SQL, actualiza también este archivo.

/**
 * Cuentas de dinero: cash, bank, savings, credit_card (aparecen en Cuentas y en los formularios).
 * Seguimiento (no son para gastar; viven en sus propias secciones):
 *   loan = deuda (saldo negativo), receivable = me deben (saldo positivo),
 *   investment = inversión (saldo = lo aportado; su valor va en investment_valuations).
 */
export type AccountType = 'cash' | 'bank' | 'savings' | 'credit_card' | 'loan' | 'receivable' | 'investment'

export type InvestmentKind = 'fund' | 'stocks' | 'deposit' | 'crypto' | 'retirement' | 'other'

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  /** En tarjetas y préstamos la deuda inicial se guarda en negativo. */
  initial_balance: number
  credit_limit: number | null
  closing_day: number | null
  payment_day: number | null
  /** Deuda / me deben: banco o persona. Inversión: plataforma (Fintual, un banco...). */
  counterparty: string | null
  /** Solo préstamos: monto original, cuota mensual, n° de cuotas y tasa anual (%). */
  loan_amount: number | null
  loan_installment: number | null
  loan_installments_count: number | null
  interest_rate: number | null
  /** Banco o plataforma (id de src/lib/institutions.ts): da el logo y el color. */
  institution: string | null
  investment_kind: InvestmentKind | null
  color: string
  archived: boolean
  created_at: string
}

/** inflow: ingresos + transferencias recibidas; outflow: gastos + transferencias enviadas. */
export type AccountWithBalance = Account & { balance: number; inflow: number; outflow: number }

export type AccountInput = Pick<
  Account,
  | 'name' | 'type' | 'initial_balance' | 'credit_limit' | 'closing_day' | 'payment_day'
  | 'counterparty' | 'loan_amount' | 'loan_installment' | 'loan_installments_count' | 'interest_rate'
  | 'institution' | 'investment_kind' | 'color' | 'archived'
>

export type CategoryKind = 'income' | 'expense'

export type Category = {
  id: string
  name: string
  kind: CategoryKind
  color: string
  icon: string
  archived: boolean
  sort_order: number
}

export type CategoryInput = Pick<Category, 'name' | 'kind' | 'color' | 'icon' | 'archived' | 'sort_order'>

export type Budget = {
  id: string
  category_id: string
  /** Primer día del mes: YYYY-MM-01 */
  month: string
  amount: number
}

export type TxType = 'income' | 'expense' | 'transfer'

export type Transaction = {
  id: string
  type: TxType
  /** Siempre positivo; el signo lo da `type`. */
  amount: number
  /** YYYY-MM-DD */
  date: string
  account_id: string
  to_account_id: string | null
  category_id: string | null
  note: string | null
  tags: string[]
  /** Origen (Etapa 2): regla recurrente, compra en cuotas o importación. */
  recurring_rule_id: string | null
  installment_plan_id: string | null
  installment_no: number | null
  import_batch_id: string | null
  created_at: string
}

/** Campos que el usuario edita en una transacción. */
export type TxInput = Pick<
  Transaction,
  'type' | 'amount' | 'date' | 'account_id' | 'to_account_id' | 'category_id' | 'note' | 'tags'
>

// ---------------------------------------------------------------------
// Etapa 2
// ---------------------------------------------------------------------

export type Goal = {
  id: string
  name: string
  target_amount: number
  target_date: string | null
  account_id: string | null
  color: string
  icon: string
  archived: boolean
  created_at: string
}

export type GoalWithProgress = Goal & { saved: number }

export type GoalInput = Pick<Goal, 'name' | 'target_amount' | 'target_date' | 'account_id' | 'color' | 'icon' | 'archived'>

export type GoalContribution = {
  id: string
  goal_id: string
  /** Negativo = retiro */
  amount: number
  date: string
  note: string | null
}

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export type RecurringRule = {
  id: string
  type: TxType
  amount: number
  account_id: string
  to_account_id: string | null
  category_id: string | null
  note: string | null
  tags: string[]
  frequency: Frequency
  interval_count: number
  start_date: string
  end_date: string | null
  occurrence_count: number
  /** Calculada por la BD. */
  next_date: string
  active: boolean
}

export type RecurringInput = Pick<
  RecurringRule,
  | 'type' | 'amount' | 'account_id' | 'to_account_id' | 'category_id' | 'note' | 'tags'
  | 'frequency' | 'interval_count' | 'start_date' | 'end_date' | 'active'
> & { occurrence_count?: number }

export type InstallmentPlan = {
  id: string
  description: string
  account_id: string
  category_id: string | null
  total_amount: number
  installments_count: number
  installment_amount: number
  first_date: string
  created_at: string
}

export type ImportBatch = {
  id: string
  account_id: string
  filename: string | null
  row_count: number
  created_at: string
}

// ---------------------------------------------------------------------
// Inversiones (migración 0006)
// ---------------------------------------------------------------------

/** Valor total de una inversión en una fecha (lo que muestra su app). */
export type InvestmentValuation = {
  id: string
  account_id: string
  date: string
  value: number
  note: string | null
  created_at: string
}

/** Vista investment_status. */
export type InvestmentStatus = {
  account_id: string
  /** Saldo inicial + aportes. */
  contributed: number
  withdrawn: number
  valued_at: string | null
  last_value: number | null
  /** Última valorización + aportes − rescates posteriores (o lo aportado neto si no hay). */
  current_value: number
}
