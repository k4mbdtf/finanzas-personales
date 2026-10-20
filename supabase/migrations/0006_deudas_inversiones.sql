-- =====================================================================
-- 0006_deudas_inversiones.sql — Deudas separadas de las cuentas, bancos e
-- inversiones
--   1. Cuentas: banco o institución (logo y color) y tipo "investment"
--   2. Saldos con lo que entra y sale de cada cuenta (account_balances)
--   3. Deudas e inversiones solo se mueven desde o hacia una cuenta propia
--      (pagos, cobros, aportes y rescates), nunca con ingresos o gastos
--   4. Valor de las inversiones en el tiempo (investment_valuations) y su
--      estado actual (vista investment_status)
--   5. Crear una deuda o inversión junto con su movimiento inicial (atómico)
--   6. Metas y patrimonio usan el valor de mercado de las inversiones
-- Ejecutar DESPUÉS de 0005_etapa2.sql. Es aditiva: no borra ni modifica datos.
-- Las deudas siguen siendo filas de "accounts" (loan / receivable): así los
-- saldos, el patrimonio y las transferencias existentes cuadran sin migrar
-- nada; la app las muestra solo en "Deudas" y no como cuentas para gastar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cuentas
--    institution:     id del banco o plataforma (p. ej. "bancoestado"), para
--                     mostrar su logo y color. Opcional.
--    investment_kind: tipo de inversión (fondo, acciones, depósito...).
-- ---------------------------------------------------------------------
alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('cash', 'bank', 'savings', 'credit_card', 'loan', 'receivable', 'investment'));

alter table public.accounts
  add column institution text
    check (institution is null or institution ~ '^[a-z0-9-]{1,40}$'),
  add column investment_kind text
    check (investment_kind is null
           or investment_kind in ('fund', 'stocks', 'deposit', 'crypto', 'retirement', 'other'));

alter table public.accounts drop constraint accounts_type_fields;
alter table public.accounts add constraint accounts_type_fields check (
  (type = 'credit_card' or (credit_limit is null and closing_day is null))
  and (type in ('credit_card', 'loan') or payment_day is null)
  and (type = 'loan' or (loan_amount is null and loan_installment is null
                         and loan_installments_count is null and interest_rate is null))
  and (type in ('loan', 'receivable', 'investment') or counterparty is null)
  and (type = 'investment' or investment_kind is null)
  -- En una inversión el saldo inicial es lo aportado antes de usar la app.
  and (type <> 'investment' or initial_balance >= 0)
);

-- Una deuda o inversión no se convierte en cuenta de dinero (ni al revés):
-- sus movimientos dejarían de tener sentido.
create or replace function public.lock_tracked_account_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type is distinct from old.type
     and (old.type in ('loan', 'receivable', 'investment') or new.type in ('loan', 'receivable', 'investment')) then
    raise exception 'Una deuda o inversión no se puede convertir en otro tipo de cuenta'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger accounts_lock_tracked_type
  before update of type on public.accounts
  for each row execute function public.lock_tracked_account_type();

-- ---------------------------------------------------------------------
-- 2. Saldos con entradas y salidas
--    inflow:  ingresos + transferencias recibidas
--    outflow: gastos + transferencias enviadas
--    Sirven para el avance de las deudas (lo pagado) y lo aportado o
--    rescatado en inversiones. Las 3 primeras columnas no cambian
--    (create or replace view solo permite agregar columnas al final).
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
    end), 0) as outflow
from public.accounts a
left join public.transactions t
  on a.id in (t.account_id, t.to_account_id) and t.user_id = a.user_id
group by a.id, a.user_id, a.initial_balance;

-- ---------------------------------------------------------------------
-- 3. Deudas e inversiones no tienen ingresos ni gastos propios: se mueven
--    con transferencias desde o hacia una cuenta de dinero (efectivo, banco,
--    ahorro o tarjeta). Una transferencia entre dos de ellas tampoco se
--    permite (se hace en dos pasos, pasando por una cuenta).
--    Los movimientos que genera una regla recurrente no se revisan aquí: la
--    regla se valida al crearla o editarla. Así una regla antigua no detiene
--    materialize_recurring (que genera todas las reglas en una transacción).
-- ---------------------------------------------------------------------
create or replace function public.check_tracked_accounts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from text;
  v_to   text;
begin
  if tg_table_name = 'transactions' and to_jsonb(new) ->> 'recurring_rule_id' is not null then
    return new;
  end if;

  select type into v_from from public.accounts where id = new.account_id and user_id = new.user_id;
  if new.to_account_id is not null then
    select type into v_to from public.accounts where id = new.to_account_id and user_id = new.user_id;
  end if;

  if new.type in ('income', 'expense') and v_from in ('loan', 'receivable', 'investment') then
    raise exception 'Las deudas e inversiones no tienen ingresos ni gastos: registra un pago, cobro, aporte o rescate desde una de tus cuentas'
      using errcode = '23514';
  end if;
  if new.type = 'transfer'
     and v_from in ('loan', 'receivable', 'investment')
     and v_to in ('loan', 'receivable', 'investment') then
    raise exception 'El dinero de una deuda o inversión se mueve desde o hacia una de tus cuentas'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_tracked_accounts
  before insert or update of type, account_id, to_account_id on public.transactions
  for each row execute function public.check_tracked_accounts();
create trigger recurring_rules_tracked_accounts
  before insert or update of type, account_id, to_account_id on public.recurring_rules
  for each row execute function public.check_tracked_accounts();

-- ---------------------------------------------------------------------
-- 4. Inversiones: valor en el tiempo
--    Una valorización es el valor total de la inversión en una fecha (lo que
--    muestra la app del banco o la corredora). Entre valorizaciones el valor
--    se estima como la última valorización + aportes − rescates posteriores.
--    "Posterior" = fecha mayor, o la misma fecha pero registrado después.
-- ---------------------------------------------------------------------
create table public.investment_valuations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  account_id uuid not null,
  date       date not null default (now() at time zone 'America/Santiago')::date,
  value      bigint not null check (value >= 0),
  note       text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint investment_valuations_account_fk
    foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete cascade
);
create index investment_valuations_account_idx
  on public.investment_valuations (account_id, date desc, created_at desc);
create index investment_valuations_user_idx on public.investment_valuations (user_id);

create or replace function public.require_investment_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.accounts
    where id = new.account_id and user_id = new.user_id and type = 'investment'
  ) then
    raise exception 'El valor solo se registra en una inversión' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger investment_valuations_account_type
  before insert or update of account_id on public.investment_valuations
  for each row execute function public.require_investment_account();

-- Estado de cada inversión:
--   contributed:   aportado (saldo inicial + aportes)
--   withdrawn:     rescatado
--   valued_at / last_value: última valorización (null si no hay)
--   current_value: valor actual estimado (nunca negativo)
create view public.investment_status
with (security_invoker = true) as
with flows as (
  select a.id as account_id, t.date, t.created_at,
         case
           when t.to_account_id = a.id or (t.account_id = a.id and t.type = 'income') then t.amount
           else -t.amount
         end as delta
  from public.accounts a
  join public.transactions t
    on a.id in (t.account_id, t.to_account_id) and t.user_id = a.user_id
  where a.type = 'investment'
),
last_val as (
  select distinct on (v.account_id) v.account_id, v.date, v.value, v.created_at
  from public.investment_valuations v
  order by v.account_id, v.date desc, v.created_at desc
)
select
  a.id as account_id,
  a.user_id,
  (a.initial_balance + coalesce(sum(f.delta) filter (where f.delta > 0), 0))::bigint as contributed,
  coalesce(-sum(f.delta) filter (where f.delta < 0), 0)::bigint as withdrawn,
  lv.date as valued_at,
  lv.value as last_value,
  greatest(0, case
    when lv.account_id is null then a.initial_balance + coalesce(sum(f.delta), 0)
    else lv.value + coalesce(sum(f.delta) filter (
           where f.date > lv.date or (f.date = lv.date and f.created_at > lv.created_at)), 0)
  end)::bigint as current_value
from public.accounts a
left join flows f on f.account_id = a.id
left join last_val lv on lv.account_id = a.id
where a.type = 'investment'
group by a.id, a.user_id, a.initial_balance, lv.account_id, lv.date, lv.value, lv.created_at;

-- ---------------------------------------------------------------------
-- 5. Crear una deuda, un "me deben" o una inversión con su movimiento
--    inicial, todo o nada.
--   p_account: campos de la cuenta; type = loan | receivable | investment
--   p_cash_account + p_cash_amount (opcional): mueve dinero en p_date
--     loan       -> el préstamo llegó a esa cuenta  (deuda -> cuenta)
--     receivable -> prestaste desde esa cuenta      (cuenta -> me deben)
--     investment -> aportaste desde esa cuenta      (cuenta -> inversión)
--   p_value (opcional, solo inversiones): valor actual en p_date. Incluye el
--     aporte inicial (se registran en la misma transacción).
-- ---------------------------------------------------------------------
create or replace function public.create_tracked_account(
  p_account      jsonb,
  p_cash_account uuid   default null,
  p_cash_amount  bigint default null,
  p_date         date   default null,
  p_value        bigint default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a      public.accounts;
  v_id   uuid;
  v_date date := coalesce(p_date, (now() at time zone 'America/Santiago')::date);
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  a := jsonb_populate_record(null::public.accounts, p_account);
  if a.type is null or a.type not in ('loan', 'receivable', 'investment') then
    raise exception 'Solo se pueden crear deudas, préstamos que te deben o inversiones' using errcode = '22023';
  end if;

  insert into public.accounts
    (name, type, initial_balance, payment_day, counterparty, loan_amount, loan_installment,
     loan_installments_count, interest_rate, color, institution, investment_kind)
  values
    (btrim(a.name), a.type, coalesce(a.initial_balance, 0), a.payment_day, nullif(btrim(a.counterparty), ''),
     a.loan_amount, a.loan_installment, a.loan_installments_count, a.interest_rate,
     coalesce(a.color, '#6b6b6b'), a.institution, a.investment_kind)
  returning id into v_id;

  if p_cash_account is not null then
    if p_cash_amount is null or p_cash_amount <= 0 then
      raise exception 'Ingresa un monto mayor a $0' using errcode = '23514';
    end if;
    insert into public.transactions (type, amount, date, account_id, to_account_id, note)
    values (
      'transfer', p_cash_amount, v_date,
      case when a.type = 'loan' then v_id else p_cash_account end,
      case when a.type = 'loan' then p_cash_account else v_id end,
      case a.type
        when 'loan' then 'Préstamo recibido: '
        when 'receivable' then 'Préstamo: '
        else 'Aporte: '
      end || btrim(a.name)
    );
  end if;

  if p_value is not null then
    if a.type <> 'investment' then
      raise exception 'El valor actual es solo para inversiones' using errcode = '22023';
    end if;
    insert into public.investment_valuations (account_id, date, value) values (v_id, v_date, p_value);
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6a. Metas: si están vinculadas a una inversión, el avance es su valor.
--     (Mismas columnas que en 0005.)
-- ---------------------------------------------------------------------
create or replace view public.goal_progress
with (security_invoker = true) as
select
  g.id as goal_id,
  g.user_id,
  (case
     when g.account_id is not null then coalesce(ist.current_value, ab.balance, 0)
     else coalesce((select sum(c.amount) from public.goal_contributions c where c.goal_id = g.id), 0)
   end)::bigint as saved
from public.goals g
left join public.account_balances ab on ab.account_id = g.account_id
left join public.investment_status ist on ist.account_id = g.account_id;

-- ---------------------------------------------------------------------
-- 6b. Patrimonio neto a fin de cada mes.
--   activos = efectivo + banco + ahorro + me deben + inversiones
--   deudas  = tarjetas + préstamos (como número positivo)
--   Las inversiones valen su última valorización hasta ese mes más los
--   aportes y rescates posteriores; sin valorización, lo aportado neto.
--   Una cuenta cuenta desde su creación, su primer movimiento o su primera
--   valorización (lo que sea antes). Las cuotas cuentan desde la compra.
-- ---------------------------------------------------------------------
create or replace function public.net_worth_by_month(p_from date, p_to date)
returns table (month date, assets bigint, liabilities bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select d::date as month,
           (d + interval '1 month' - interval '1 day')::date as month_end
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') as d
  ),
  tx as (
    select t.account_id, t.to_account_id, t.type, t.amount, t.created_at,
           coalesce(p.first_date, t.date) as effective_date
    from public.transactions t
    left join public.installment_plans p on p.id = t.installment_plan_id
    where t.user_id = (select auth.uid())
  ),
  vals as (
    select v.account_id, v.date, v.value, v.created_at
    from public.investment_valuations v
    where v.user_id = (select auth.uid())
  ),
  acc as (
    select a.id, a.type, a.initial_balance,
           least(
             (a.created_at at time zone 'America/Santiago')::date,
             coalesce((select min(x.effective_date) from tx x where a.id in (x.account_id, x.to_account_id)),
                      (a.created_at at time zone 'America/Santiago')::date),
             coalesce((select min(v.date) from vals v where v.account_id = a.id),
                      (a.created_at at time zone 'America/Santiago')::date)
           ) as since
    from public.accounts a
    where a.user_id = (select auth.uid())
  ),
  raw as (
    select m.month, a.type,
           coalesce(lv.value, a.initial_balance) + coalesce((
             select sum(case
                          when x.account_id = a.id and x.type = 'income' then x.amount
                          when x.account_id = a.id then -x.amount
                          else x.amount
                        end)
             from tx x
             where a.id in (x.account_id, x.to_account_id)
               and x.effective_date <= m.month_end
               and (lv.date is null
                    or x.effective_date > lv.date
                    or (x.effective_date = lv.date and x.created_at > lv.created_at))
           ), 0) as balance
    from months m
    join acc a on a.since <= m.month_end
    left join lateral (
      select v.date, v.value, v.created_at
      from vals v
      where a.type = 'investment' and v.account_id = a.id and v.date <= m.month_end
      order by v.date desc, v.created_at desc
      limit 1
    ) lv on true
  ),
  bal as (
    select r.month, r.type,
           case when r.type = 'investment' then greatest(r.balance, 0) else r.balance end as balance
    from raw r
  )
  select m.month,
         coalesce(sum(b.balance) filter (where b.type in ('cash', 'bank', 'savings', 'receivable', 'investment')), 0)::bigint,
         coalesce(-sum(b.balance) filter (where b.type in ('credit_card', 'loan')), 0)::bigint
  from months m
  left join bal b on b.month = m.month
  group by m.month
  order by m.month;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security (mismas 4 políticas que en 0001)
-- ---------------------------------------------------------------------
alter table public.investment_valuations enable row level security;

create policy "investment_valuations_select" on public.investment_valuations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "investment_valuations_insert" on public.investment_valuations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "investment_valuations_update" on public.investment_valuations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "investment_valuations_delete" on public.investment_valuations for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Privilegios: nada para anon; lo mínimo para authenticated.
-- (Las vistas reemplazadas conservan sus permisos; se reafirman igual.)
-- ---------------------------------------------------------------------
revoke all on public.investment_valuations, public.investment_status,
              public.account_balances, public.goal_progress
  from anon, public;

grant select, insert, update, delete on public.investment_valuations to authenticated;
grant select on public.investment_status, public.account_balances, public.goal_progress to authenticated;

revoke all on function public.create_tracked_account(jsonb, uuid, bigint, date, bigint) from public, anon;
grant execute on function public.create_tracked_account(jsonb, uuid, bigint, date, bigint) to authenticated;

revoke all on function public.net_worth_by_month(date, date) from public, anon;
grant execute on function public.net_worth_by_month(date, date) to authenticated;

-- Funciones de trigger: no se invocan directamente desde la API.
revoke all on function public.lock_tracked_account_type() from public, anon, authenticated;
revoke all on function public.check_tracked_accounts() from public, anon, authenticated;
revoke all on function public.require_investment_account() from public, anon, authenticated;
