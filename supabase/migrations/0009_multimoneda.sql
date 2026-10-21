-- =====================================================================
-- 0009_multimoneda.sql — Cuentas en UF o dólares (opcional)
-- Ejecutar DESPUÉS de 0008_dividir.sql. Solo agrega columnas, una tabla, un
-- trigger y una columna al final de la vista account_balances.
--
-- Diseño: `amount` (y `initial_balance`) SIGUEN EN PESOS. En una cuenta en UF o
-- USD, `amount` es el equivalente en CLP al valor del día del movimiento, así que
-- todos los reportes (ingresos/gastos, presupuestos, categorías, resumen anual)
-- funcionan sin cambios y quedan en pesos de ese día. Además se guarda el monto en
-- la moneda de la cuenta (`amount_native`, `to_amount_native`), con el que se
-- calcula el saldo real de la cuenta en su moneda (`balance_native`).
--
--   Movimiento                       amount (CLP)        amount_native   to_amount_native
--   Gasto de 20 USD (cuenta USD)     19.000 (el día)     20              —
--   USD → CLP (vendo 100 USD)        lo que llegó en $   100             —
--   CLP → USD (compro 100 USD)       lo que salió en $   —               100
--   USD → UF                         equivalente en $    lo que salió    lo que llegó
--
-- En esta etapa la moneda extranjera es para cuentas de dinero (efectivo, banco,
-- ahorro y tarjeta). Recurrentes, compras en cuotas e importación de cartolas
-- siguen solo en cuentas en pesos.
-- =====================================================================

-- La opción se activa en Ajustes (apagada por defecto: la app se ve igual que antes).
alter table public.profiles add column multi_currency boolean not null default false;

alter table public.accounts
  add column currency text not null default 'CLP' check (currency in ('CLP', 'UF', 'USD')),
  add column initial_balance_native numeric(18, 4);
alter table public.accounts
  add constraint accounts_native_initial check ((currency = 'CLP') = (initial_balance_native is null)),
  add constraint accounts_currency_types check (currency = 'CLP' or type in ('cash', 'bank', 'savings', 'credit_card'));

alter table public.transactions
  add column amount_native    numeric(18, 4) check (amount_native is null or amount_native > 0),
  add column to_amount_native numeric(18, 4) check (to_amount_native is null or to_amount_native > 0);

-- ---------------------------------------------------------------------
-- La moneda de una cuenta no cambia después de crearla (sus montos están en ella).
-- ---------------------------------------------------------------------
create or replace function public.lock_account_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency then
    raise exception 'La moneda de una cuenta no se puede cambiar: crea una cuenta nueva en la otra moneda'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger accounts_lock_currency
  before update of currency on public.accounts
  for each row execute function public.lock_account_currency();

-- ---------------------------------------------------------------------
-- Montos en moneda extranjera: obligatorios si la cuenta (de origen o de destino)
-- no es en pesos, y prohibidos si lo es.
-- ---------------------------------------------------------------------
create or replace function public.check_native_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from text;
  v_to   text;
begin
  select currency into v_from from public.accounts where id = new.account_id and user_id = new.user_id;
  if new.to_account_id is not null then
    select currency into v_to from public.accounts where id = new.to_account_id and user_id = new.user_id;
  end if;

  if coalesce(v_from, 'CLP') <> 'CLP' and new.amount_native is null then
    if new.installment_plan_id is not null or new.import_batch_id is not null or new.recurring_rule_id is not null then
      raise exception 'Las compras en cuotas, las cartolas importadas y los recurrentes solo se registran en cuentas en pesos'
        using errcode = '23514';
    end if;
    raise exception 'Falta el monto en % de la cuenta', v_from using errcode = '23514';
  end if;
  if coalesce(v_from, 'CLP') = 'CLP' and new.amount_native is not null then
    raise exception 'Una cuenta en pesos no lleva monto en otra moneda' using errcode = '23514';
  end if;
  if new.type = 'transfer' and coalesce(v_to, 'CLP') <> 'CLP' and new.to_amount_native is null then
    raise exception 'Falta cuánto llegó en % a la cuenta de destino', v_to using errcode = '23514';
  end if;
  if (new.type <> 'transfer' or coalesce(v_to, 'CLP') = 'CLP') and new.to_amount_native is not null then
    raise exception 'Solo una transferencia a una cuenta en otra moneda lleva monto de llegada' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_native_amounts
  before insert or update of type, account_id, to_account_id, amount_native, to_amount_native on public.transactions
  for each row execute function public.check_native_amounts();

-- Recurrentes solo en cuentas en pesos (generan movimientos sin monto en otra moneda).
create or replace function public.check_rule_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.accounts
             where id in (new.account_id, new.to_account_id) and user_id = new.user_id and currency <> 'CLP') then
    raise exception 'Los movimientos recurrentes solo se registran en cuentas en pesos' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger recurring_rules_currency
  before insert or update of account_id, to_account_id on public.recurring_rules
  for each row execute function public.check_rule_currency();

-- ---------------------------------------------------------------------
-- Valores de la UF y del dólar (en pesos) por fecha. La app los trae de
-- mindicador.cl (o el usuario los ingresa) y los guarda aquí para reusarlos.
-- ---------------------------------------------------------------------
create table public.exchange_rates (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  currency   text not null check (currency in ('UF', 'USD')),
  date       date not null,
  clp        numeric(14, 4) not null check (clp > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, currency, date)
);

alter table public.exchange_rates enable row level security;
create policy "exchange_rates_select" on public.exchange_rates for select to authenticated
  using (user_id = (select auth.uid()));
create policy "exchange_rates_insert" on public.exchange_rates for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "exchange_rates_update" on public.exchange_rates for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exchange_rates_delete" on public.exchange_rates for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.exchange_rates from anon, public;
grant select, insert, update, delete on public.exchange_rates to authenticated;

-- ---------------------------------------------------------------------
-- Saldo en la moneda de la cuenta (null en cuentas en pesos). Columna nueva al
-- final: las columnas anteriores de la vista no cambian.
-- ---------------------------------------------------------------------
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.initial_balance
  + coalesce(sum(case
      when t.account_id = a.id and t.type = 'income'   then  t.amount
      when t.account_id = a.id and t.type = 'expense'  then -t.amount
      when t.account_id = a.id and t.type = 'transfer' then -t.amount
      when t.to_account_id = a.id                      then  t.amount
    end), 0) as balance,
  coalesce(sum(case
      when t.account_id = a.id and t.type = 'income' then t.amount
      when t.to_account_id = a.id                    then t.amount
    end), 0) as inflow,
  coalesce(sum(case
      when t.account_id = a.id and t.type in ('expense', 'transfer') then t.amount
    end), 0) as outflow,
  case when a.currency <> 'CLP' then
    a.initial_balance_native
    + coalesce(sum(case
        when t.account_id = a.id and t.type = 'income' then  t.amount_native
        when t.account_id = a.id                       then -t.amount_native
        when t.to_account_id = a.id                    then  t.to_amount_native
      end), 0)
  end as balance_native
from public.accounts a
left join public.transactions t
  on a.id in (t.account_id, t.to_account_id) and t.user_id = a.user_id
group by a.id, a.user_id, a.initial_balance, a.currency, a.initial_balance_native;

revoke all on function public.lock_account_currency() from public, anon, authenticated;
revoke all on function public.check_native_amounts() from public, anon, authenticated;
revoke all on function public.check_rule_currency() from public, anon, authenticated;
