-- =====================================================================
-- 0005_etapa2.sql — Etapa 2
--   1. Deudas: cuentas de tipo "loan" (préstamo/deuda) y "receivable" (me deben)
--   2. Metas de ahorro (goals + goal_contributions + vista goal_progress)
--   3. Transacciones recurrentes (recurring_rules + materialize_recurring)
--   4. Compras en cuotas (installment_plans + create_installment_plan)
--   5. Importación de cartolas con detección de duplicados (import_batches +
--      import_transactions)
--   6. Patrimonio neto en el tiempo (net_worth_by_month)
-- Ejecutar DESPUÉS de 0004_keepalive.sql. Es aditiva: no borra datos.
-- Mismo patrón que 0001: user_id default auth.uid(), RLS de 4 políticas,
-- FKs compuestas (id, user_id) para impedir referencias a datos ajenos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Deudas como cuentas
--    loan:       préstamo o deuda (saldo negativo = lo que debes)
--    receivable: dinero que te deben (saldo positivo)
--    Los pagos/cobros son transferencias: no cuentan como gasto/ingreso.
-- ---------------------------------------------------------------------
alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('cash', 'bank', 'savings', 'credit_card', 'loan', 'receivable'));

alter table public.accounts
  add column counterparty text
    check (counterparty is null or char_length(counterparty) <= 80),
  add column loan_amount bigint
    check (loan_amount is null or loan_amount > 0),
  add column loan_installment bigint
    check (loan_installment is null or loan_installment > 0),
  add column loan_installments_count smallint
    check (loan_installments_count is null or loan_installments_count between 1 and 600),
  add column interest_rate numeric(6, 3)
    check (interest_rate is null or interest_rate between 0 and 999);

-- Cada campo solo tiene sentido en su tipo de cuenta.
alter table public.accounts drop constraint accounts_card_fields;
alter table public.accounts add constraint accounts_type_fields check (
  (type = 'credit_card' or (credit_limit is null and closing_day is null))
  and (type in ('credit_card', 'loan') or payment_day is null)
  and (type = 'loan' or (loan_amount is null and loan_installment is null
                         and loan_installments_count is null and interest_rate is null))
  and (type in ('loan', 'receivable') or counterparty is null)
);

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- n-ésima ocurrencia (desde 0) de una frecuencia. Se calcula siempre desde la
-- fecha de inicio para no "derivar": 31-ene mensual => 28-feb, 31-mar, 30-abr...
create or replace function public.recurring_occurrence(
  p_start date, p_frequency text, p_interval integer, p_n integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'weekly'  then p_start + (p_n * p_interval * 7)
    when 'monthly' then (p_start + make_interval(months => p_n * p_interval))::date
    when 'yearly'  then (p_start + make_interval(years => p_n * p_interval))::date
  end;
$$;

-- La categoría (si hay) debe ser de gasto. Para tablas sin columna "type".
create or replace function public.require_expense_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories
    where id = new.category_id and user_id = new.user_id and kind = 'expense'
  ) then
    raise exception 'La categoría debe ser de gasto' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Metas de ahorro
--    Avance = saldo de la cuenta vinculada, o la suma de los abonos manuales.
-- ---------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  target_amount bigint not null check (target_amount > 0),
  target_date   date,
  account_id    uuid,
  color         text not null default '#0f766e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon          text not null default 'piggy-bank',
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  constraint goals_account_fk
    foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete set null (account_id)
);
create index goals_user_idx on public.goals (user_id);
create index goals_account_idx on public.goals (account_id) where account_id is not null;
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

create table public.goal_contributions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  goal_id    uuid not null,
  amount     bigint not null check (amount <> 0), -- negativo = retiro
  date       date not null default (now() at time zone 'America/Santiago')::date,
  note       text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint goal_contributions_goal_fk
    foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index goal_contributions_user_idx on public.goal_contributions (user_id);

create view public.goal_progress
with (security_invoker = true) as
select
  g.id as goal_id,
  g.user_id,
  (case
     when g.account_id is not null then coalesce(ab.balance, 0)
     else coalesce((select sum(c.amount) from public.goal_contributions c where c.goal_id = g.id), 0)
   end)::bigint as saved
from public.goals g
left join public.account_balances ab on ab.account_id = g.account_id;

-- ---------------------------------------------------------------------
-- 3. Transacciones recurrentes
--    Una regla genera movimientos en start_date + n * (frecuencia), hasta hoy.
--    occurrence_count = cuántas ocurrencias ya se procesaron.
--    next_date lo calcula un trigger (no lo envía el cliente).
-- ---------------------------------------------------------------------
create table public.recurring_rules (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  type             text not null check (type in ('income', 'expense', 'transfer')),
  amount           bigint not null check (amount > 0),
  account_id       uuid not null,
  to_account_id    uuid,
  category_id      uuid,
  note             text check (note is null or char_length(note) <= 500),
  tags             text[] not null default '{}',
  frequency        text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  interval_count   smallint not null default 1 check (interval_count between 1 and 12),
  start_date       date not null,
  end_date         date,
  occurrence_count integer not null default 0 check (occurrence_count >= 0),
  next_date        date not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  constraint recurring_account_fk
    foreign key (account_id, user_id) references public.accounts (id, user_id),
  constraint recurring_to_account_fk
    foreign key (to_account_id, user_id) references public.accounts (id, user_id),
  constraint recurring_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  constraint recurring_shape check (
    (type = 'transfer' and to_account_id is not null
       and to_account_id <> account_id and category_id is null)
    or (type in ('income', 'expense') and to_account_id is null)
  ),
  constraint recurring_dates check (end_date is null or end_date >= start_date)
);
create index recurring_rules_user_next_idx on public.recurring_rules (user_id, next_date) where active;
create index recurring_rules_account_idx on public.recurring_rules (account_id);
create index recurring_rules_to_account_idx on public.recurring_rules (to_account_id) where to_account_id is not null;
create index recurring_rules_category_idx on public.recurring_rules (category_id) where category_id is not null;
create trigger recurring_rules_updated_at before update on public.recurring_rules
  for each row execute function public.set_updated_at();

create or replace function public.set_recurring_next_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.next_date := public.recurring_occurrence(
    new.start_date, new.frequency, new.interval_count, new.occurrence_count);
  return new;
end;
$$;
create trigger recurring_rules_next_date
  before insert or update on public.recurring_rules
  for each row execute function public.set_recurring_next_date();

-- Misma validación de tipo de categoría que en transactions.
create trigger recurring_rules_category_kind
  before insert or update of category_id, type on public.recurring_rules
  for each row execute function public.check_transaction_category_kind();

-- ---------------------------------------------------------------------
-- 4. Compras en cuotas (en tarjeta de crédito)
--    Se crean todas las cuotas como transacciones con fecha de cada mes:
--    el saldo de la tarjeta refleja el cupo usado completo y cada cuota
--    cuenta como gasto en su mes (presupuestos y reportes).
-- ---------------------------------------------------------------------
create table public.installment_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  description        text not null check (char_length(btrim(description)) between 1 and 80),
  account_id         uuid not null,
  category_id        uuid,
  total_amount       bigint not null check (total_amount > 0),
  installments_count smallint not null check (installments_count between 2 and 60),
  installment_amount bigint not null check (installment_amount > 0),
  first_date         date not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id),
  constraint installment_plans_account_fk
    foreign key (account_id, user_id) references public.accounts (id, user_id),
  constraint installment_plans_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),
  constraint installment_plans_amounts check (installment_amount <= total_amount)
);
create index installment_plans_user_idx on public.installment_plans (user_id);
create index installment_plans_account_idx on public.installment_plans (account_id);
create index installment_plans_category_idx on public.installment_plans (category_id) where category_id is not null;
create trigger installment_plans_updated_at before update on public.installment_plans
  for each row execute function public.set_updated_at();
create trigger installment_plans_category_kind
  before insert or update of category_id on public.installment_plans
  for each row execute function public.require_expense_category();

-- Montos, cuotas, cuenta y fecha no se editan (dejarían las cuotas desfasadas).
create or replace function public.lock_installment_plan_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.total_amount, new.installments_count, new.installment_amount, new.account_id, new.first_date)
     is distinct from
     (old.total_amount, old.installments_count, old.installment_amount, old.account_id, old.first_date) then
    raise exception 'Para cambiar montos, cuotas, tarjeta o fecha, elimina la compra y créala de nuevo'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger installment_plans_lock
  before update on public.installment_plans
  for each row execute function public.lock_installment_plan_amounts();

-- Cambiar descripción o categoría se propaga a todas sus cuotas.
create or replace function public.sync_installment_transactions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.transactions t
     set category_id = new.category_id,
         note = btrim(new.description) || ' (cuota ' || t.installment_no || '/' || new.installments_count || ')'
   where t.installment_plan_id = new.id
     and t.user_id = new.user_id;
  return new;
end;
$$;
create trigger installment_plans_sync
  after update of description, category_id on public.installment_plans
  for each row
  when (old.description is distinct from new.description
        or old.category_id is distinct from new.category_id)
  execute function public.sync_installment_transactions();

-- ---------------------------------------------------------------------
-- 5. Importaciones de cartolas
-- ---------------------------------------------------------------------
create table public.import_batches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  account_id uuid not null,
  filename   text check (filename is null or char_length(filename) <= 200),
  row_count  integer not null default 0 check (row_count >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint import_batches_account_fk
    foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete cascade
);
create index import_batches_user_idx on public.import_batches (user_id, created_at desc);
create index import_batches_account_idx on public.import_batches (account_id);

-- ---------------------------------------------------------------------
-- Enlaces desde transactions (todos opcionales)
--   recurring_rule_id + recurring_date: única => una regla nunca genera
--     dos veces la misma fecha (idempotente).
--   installment_plan_id + installment_no: borrar la compra borra sus cuotas.
--   import_batch_id: "deshacer importación" borra lo importado.
--   import_hash: huella de la fila de la cartola; única por usuario =>
--     reimportar el mismo archivo no duplica.
-- ---------------------------------------------------------------------
alter table public.transactions
  add column recurring_rule_id   uuid,
  add column recurring_date      date,
  add column installment_plan_id uuid,
  add column installment_no      smallint check (installment_no is null or installment_no >= 1),
  add column import_batch_id     uuid,
  add column import_hash         text check (import_hash is null or char_length(import_hash) <= 128);

alter table public.transactions
  add constraint transactions_recurring_fk
    foreign key (recurring_rule_id, user_id)
    references public.recurring_rules (id, user_id) on delete set null (recurring_rule_id),
  add constraint transactions_installment_fk
    foreign key (installment_plan_id, user_id)
    references public.installment_plans (id, user_id) on delete cascade,
  add constraint transactions_import_batch_fk
    foreign key (import_batch_id, user_id)
    references public.import_batches (id, user_id) on delete cascade,
  add constraint transactions_recurring_unique unique (recurring_rule_id, recurring_date),
  add constraint transactions_installment_unique unique (installment_plan_id, installment_no),
  add constraint transactions_import_hash_unique unique (user_id, import_hash);

create index transactions_import_batch_idx on public.transactions (import_batch_id)
  where import_batch_id is not null;

-- ---------------------------------------------------------------------
-- RPC: generar movimientos recurrentes pendientes hasta hoy (Santiago).
-- Idempotente y seguro de llamar muchas veces (la app lo llama al abrir).
-- Devuelve cuántos movimientos creó.
-- ---------------------------------------------------------------------
create or replace function public.materialize_recurring(p_until date default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_until   date := coalesce(p_until, (now() at time zone 'America/Santiago')::date);
  r         record;
  v_date    date;
  v_count   integer;
  v_guard   integer;
  v_rows    integer;
  v_created integer := 0;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  for r in
    select * from public.recurring_rules
    where user_id = v_uid and active and next_date <= v_until
    order by id
    for update
  loop
    v_count := r.occurrence_count;
    v_date  := r.next_date;
    v_guard := 0;
    -- v_guard evita bucles enormes (p. ej. regla semanal con inicio hace 20 años).
    while v_date <= v_until
          and (r.end_date is null or v_date <= r.end_date)
          and v_guard < 500 loop
      insert into public.transactions
        (type, amount, date, account_id, to_account_id, category_id, note, tags,
         recurring_rule_id, recurring_date)
      values
        (r.type, r.amount, v_date, r.account_id, r.to_account_id, r.category_id, r.note, r.tags,
         r.id, v_date)
      on conflict (recurring_rule_id, recurring_date) do nothing;
      get diagnostics v_rows = row_count;
      v_created := v_created + v_rows;
      v_count := v_count + 1;
      v_guard := v_guard + 1;
      v_date := public.recurring_occurrence(r.start_date, r.frequency, r.interval_count, v_count);
    end loop;

    update public.recurring_rules
       set occurrence_count = v_count,
           active = not (r.end_date is not null and v_date > r.end_date)
     where id = r.id;
  end loop;

  return v_created;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: crear una compra en cuotas con todas sus cuotas (atómico).
-- p_installment_amount: opcional, para compras con interés (cuota fija);
-- si no se envía, se divide el total y la última cuota absorbe el redondeo.
-- ---------------------------------------------------------------------
create or replace function public.create_installment_plan(
  p_description        text,
  p_account_id         uuid,
  p_category_id        uuid,
  p_total_amount       bigint,
  p_installments_count integer,
  p_first_date         date,
  p_installment_amount bigint default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_type  text;
  v_total bigint;
  v_each  bigint;
  v_plan  uuid;
  v_desc  text := btrim(coalesce(p_description, ''));
  i       integer;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  select type into v_type from public.accounts where id = p_account_id and user_id = v_uid;
  if v_type is null then
    raise exception 'Cuenta no encontrada' using errcode = '23503';
  end if;
  if v_type <> 'credit_card' then
    raise exception 'Las compras en cuotas se registran en una tarjeta de crédito' using errcode = '23514';
  end if;
  if p_installments_count is null or p_installments_count < 2 or p_installments_count > 60 then
    raise exception 'El número de cuotas debe estar entre 2 y 60' using errcode = '23514';
  end if;
  if p_first_date is null then
    raise exception 'Falta la fecha de la primera cuota' using errcode = '23514';
  end if;

  if p_installment_amount is not null then
    v_each  := p_installment_amount;
    v_total := p_installment_amount * p_installments_count;
  else
    v_total := p_total_amount;
    v_each  := p_total_amount / p_installments_count; -- división entera
  end if;
  if v_total is null or v_each is null or v_each <= 0 then
    raise exception 'El monto debe ser mayor que el número de cuotas' using errcode = '23514';
  end if;

  insert into public.installment_plans
    (description, account_id, category_id, total_amount, installments_count, installment_amount, first_date)
  values
    (v_desc, p_account_id, p_category_id, v_total, p_installments_count, v_each, p_first_date)
  returning id into v_plan;

  for i in 1..p_installments_count loop
    insert into public.transactions
      (type, amount, date, account_id, category_id, note, installment_plan_id, installment_no)
    values (
      'expense',
      case when i = p_installments_count then v_total - v_each * (p_installments_count - 1) else v_each end,
      public.recurring_occurrence(p_first_date, 'monthly', 1, i - 1),
      p_account_id,
      p_category_id,
      v_desc || ' (cuota ' || i || '/' || p_installments_count || ')',
      v_plan,
      i
    );
  end loop;

  return v_plan;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: importar filas de una cartola (atómico). Las filas cuyo import_hash
-- ya existe se omiten. Devuelve el lote creado y cuántas se insertaron/omitieron.
-- p_rows: [{ "type": "expense"|"income", "amount": 12500, "date": "2026-10-01",
--            "category_id": null, "note": "...", "import_hash": "..." }, ...]
-- ---------------------------------------------------------------------
create or replace function public.import_transactions(
  p_account_id uuid, p_filename text, p_rows jsonb
)
returns table (batch_id uuid, inserted integer, skipped integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_total    integer;
  v_inserted integer;
  v_batch    uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Formato de filas inválido' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_rows);
  if v_total < 1 or v_total > 5000 then
    raise exception 'Se pueden importar entre 1 y 5000 filas por vez' using errcode = '22023';
  end if;
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_uid) then
    raise exception 'Cuenta no encontrada' using errcode = '23503';
  end if;

  insert into public.import_batches (account_id, filename)
  values (p_account_id, left(p_filename, 200))
  returning id into v_batch;

  insert into public.transactions
    (type, amount, date, account_id, category_id, note, import_batch_id, import_hash)
  select r.type, r.amount, r.date, p_account_id, r.category_id,
         nullif(left(btrim(coalesce(r.note, '')), 500), ''), v_batch, r.import_hash
  from jsonb_to_recordset(p_rows)
       as r(type text, amount bigint, date date, category_id uuid, note text, import_hash text)
  on conflict (user_id, import_hash) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    delete from public.import_batches where id = v_batch;
    v_batch := null;
  else
    update public.import_batches set row_count = v_inserted where id = v_batch;
  end if;

  return query select v_batch, v_inserted, v_total - v_inserted;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: patrimonio neto a fin de cada mes en un rango.
--   activos = efectivo + banco + ahorro + me deben
--   deudas  = tarjetas + préstamos (como número positivo)
-- Una cuenta cuenta desde su creación o su primer movimiento (lo que sea antes).
-- Las cuotas cuentan desde la fecha de la compra (como el cupo usado).
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
    select t.account_id, t.to_account_id, t.type, t.amount,
           coalesce(p.first_date, t.date) as effective_date
    from public.transactions t
    left join public.installment_plans p on p.id = t.installment_plan_id
    where t.user_id = (select auth.uid())
  ),
  acc as (
    select a.id, a.type, a.initial_balance,
           least(
             (a.created_at at time zone 'America/Santiago')::date,
             coalesce((select min(x.effective_date) from tx x where a.id in (x.account_id, x.to_account_id)),
                      (a.created_at at time zone 'America/Santiago')::date)
           ) as since
    from public.accounts a
    where a.user_id = (select auth.uid())
  ),
  bal as (
    select m.month, a.type,
           a.initial_balance + coalesce((
             select sum(case
                          when x.account_id = a.id and x.type = 'income' then x.amount
                          when x.account_id = a.id then -x.amount
                          else x.amount
                        end)
             from tx x
             where a.id in (x.account_id, x.to_account_id)
               and x.effective_date <= m.month_end
           ), 0) as balance
    from months m
    join acc a on a.since <= m.month_end
  )
  select m.month,
         coalesce(sum(b.balance) filter (where b.type in ('cash', 'bank', 'savings', 'receivable')), 0)::bigint,
         coalesce(-sum(b.balance) filter (where b.type in ('credit_card', 'loan')), 0)::bigint
  from months m
  left join bal b on b.month = m.month
  group by m.month
  order by m.month;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security (mismas 4 políticas que en 0001)
-- ---------------------------------------------------------------------
alter table public.goals              enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.recurring_rules    enable row level security;
alter table public.installment_plans  enable row level security;
alter table public.import_batches     enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['goals', 'goal_contributions', 'recurring_rules', 'installment_plans', 'import_batches'] loop
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Privilegios: nada para anon; lo mínimo para authenticated.
-- (Supabase da por defecto privilegios a anon en tablas nuevas: se revocan.)
-- ---------------------------------------------------------------------
revoke all on public.goals, public.goal_contributions, public.recurring_rules,
              public.installment_plans, public.import_batches, public.goal_progress
  from anon, public;

grant select, insert, update, delete
  on public.goals, public.goal_contributions, public.recurring_rules,
     public.installment_plans, public.import_batches
  to authenticated;
grant select on public.goal_progress to authenticated;

revoke all on function public.recurring_occurrence(date, text, integer, integer) from public, anon;
grant execute on function public.recurring_occurrence(date, text, integer, integer) to authenticated;

revoke all on function public.materialize_recurring(date) from public, anon;
grant execute on function public.materialize_recurring(date) to authenticated;

revoke all on function public.create_installment_plan(text, uuid, uuid, bigint, integer, date, bigint) from public, anon;
grant execute on function public.create_installment_plan(text, uuid, uuid, bigint, integer, date, bigint) to authenticated;

revoke all on function public.import_transactions(uuid, text, jsonb) from public, anon;
grant execute on function public.import_transactions(uuid, text, jsonb) to authenticated;

revoke all on function public.net_worth_by_month(date, date) from public, anon;
grant execute on function public.net_worth_by_month(date, date) to authenticated;

-- Funciones de trigger: no se invocan directamente desde la API.
revoke all on function public.require_expense_category() from public, anon, authenticated;
revoke all on function public.set_recurring_next_date() from public, anon, authenticated;
revoke all on function public.lock_installment_plan_amounts() from public, anon, authenticated;
revoke all on function public.sync_installment_transactions() from public, anon, authenticated;
