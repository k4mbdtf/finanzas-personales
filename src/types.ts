// Tipos de las tablas de Supabase (escritos a mano para no depender del CLI).
// Si cambias el esquema SQL, actualiza también este archivo.

export type AccountType = 'cash' | 'bank' | 'savings' | 'credit_card'

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  /** En tarjetas de crédito la deuda inicial se guarda en negativo. */
  initial_balance: number
  credit_limit: number | null
  closing_day: number | null
  payment_day: number | null
  color: string
  archived: boolean
  created_at: string
}

export type AccountWithBalance = Account & { balance: number }

export type AccountInput = Pick<
  Account,
  'name' | 'type' | 'initial_balance' | 'credit_limit' | 'closing_day' | 'payment_day' | 'color' | 'archived'
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

export type TxType ='income' | 'expense' | 'transfer'

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
  created_at: string
}

export type TxInput = Omit<Transaction, 'id' | 'created_at'>
