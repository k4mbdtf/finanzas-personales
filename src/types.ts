// Tipos de las tablas de Supabase (escritos a mano para no depender del CLI).
// Si cambias el esquema SQL, actualiza también este archivo.

/** loan = préstamo/deuda (saldo negativo); receivable = me deben (saldo positivo). */
export type AccountType = 'cash' | 'bank' | 'savings' | 'credit_card' | 'loan' | 'receivable'

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
  /** Préstamo / me deben: banco o persona. */
  counterparty: string | null
  /** Solo préstamos: monto original, cuota mensual, n° de cuotas y tasa anual (%). */
  loan_amount: number | null
  loan_installment: number | null
  loan_installments_count: number | null
  interest_rate: number | null
  color: string
  archived: boolean
  created_at: string
}

export type AccountWithBalance = Account & { balance: number }

export type AccountInput = Pick<
  Account,
  | 'name' | 'type' | 'initial_balance' | 'credit_limit' | 'closing_day' | 'payment_day'
  | 'counterparty' | 'loan_amount' | 'loan_installment' | 'loan_installments_count' | 'interest_rate'
  | 'color' | 'archived'
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
