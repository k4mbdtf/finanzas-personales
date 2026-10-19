-- =====================================================================
-- 0001_schema.sql — Esquema base, RLS, triggers y funciones
-- Ejecutar completo en: Supabase > SQL Editor (o `supabase db push`).
--
-- Principios:
--  * Todas las tablas de negocio tienen user_id (default auth.uid()).
--  * RLS activado con políticas SELECT/INSERT/UPDATE/DELETE solo donde
--    user_id = auth.uid().
--  * Las claves foráneas son COMPUESTAS (id, user_id): la base de datos
--    rechaza referenciar una cuenta/categoría de otro usuario, incluso
--    si el atacante conoce el UUID.
--  * Montos en CLP como bigint (enteros, sin decimales).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: configuración por usuario (1 fila por usuario)
-- ---------------------------------------------------------------------
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency     text not null default 'CLP',
  timezone     text not null default 'America/Santiago',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- accounts: efectivo, banco, ahorro, tarjeta de crédito
-- ---------------------------------------------------------------------
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  type            text not null check (type in ('cash', 'bank', 'savings', 'credit_card')),
  initial_balance bigint not null default 0,
  -- Solo tarjetas de crédito:
  credit_limit    bigint check (credit_limit is null or credit_limit >= 0),
  closing_day     smallint check (closing_day is null or closing_day between 1 and 31),
  payment_day     smallint check (payment_day is null or payment_day between 1 and 31),
  color           text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Necesario para las FK compuestas (id, user_id) desde otras tablas.
  unique (id, user_id),
  -- Los datos de tarjeta solo tienen sentido en tarjetas.
  constraint accounts_card_fields check (
    type = 'credit_card'
    or (credit_limit is null and closing_day is null and payment_day is null)
  )
);
create index accounts_user_idx on public.accounts (user_id);
create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- categories: predefinidas (se crean al registrarse) + personalizadas
-- ---------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  kind       text not null check (kind in ('income', 'expense')),
  color      text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon       text not null default 'tag',          -- nombre de ícono (lucide/emoji)
  archived   boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind, name)
);
create index categories_user_idx on public.categories (user_id);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- transactions: ingreso, gasto y transferencia
--  * Transferencia: account_id = origen, to_account_id = destino, sin
--    categoría. Los reportes de ingresos/gastos filtran type IN
--    ('income','expense'), por lo que la transferencia no cuenta.
-- ---------------------------------------------------------------------
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  type          text not null check (type in ('income', 'expense', 'transfer')),
  amount        bigint not null check (amount > 0),
  date          date not null default (now() at time zone 'America/Santiago')::date,
  account_id    uuid not null,
  to_account_id uuid,
  category_id   uuid,
  note          text check (note is null or char_length(note) <= 500),
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- FKs compuestas: la cuenta/categoría DEBE ser del mismo user_id.
  constraint transactions_account_fk
    foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete restrict,
  constraint transactions_to_account_fk
    foreign key (to_account_id, user_id)
    references public.accounts (id, user_id) on delete restrict,
  -- Si se borra la categoría, la transacción queda "sin categoría"
  -- (set null solo de category_id; user_id es NOT NULL y no se toca).
  constraint transactions_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id),

  constraint transactions_shape check (
    (type = 'transfer'
       and to_account_id is not null
       and to_account_id <> account_id
       and category_id is null)
    or
    (type in ('income', 'expense') and to_account_id is null)
  )
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_account_idx  on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id)
  where to_account_id is not null;
create index transactions_category_idx on public.transactions (category_id)
  where category_id is not null;
create index transactions_tags_idx on public.transactions using gin (tags);
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- La categoría debe coincidir con el tipo (gasto -> categoría de gasto).
create or replace function public.check_transaction_category_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat_kind text;
begin
  if new.category_id is not null then
    select kind into cat_kind from public.categories
      where id = new.category_id and user_id = new.user_id;
    if cat_kind is distinct from new.type then
      raise exception 'La categoría (%) no corresponde al tipo de transacción (%)',
        cat_kind, new.type using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger transactions_category_kind
  before insert or update of category_id, type on public.transactions
  for each row execute function public.check_transaction_category_kind();

-- ---------------------------------------------------------------------
-- budgets: presupuesto mensual por categoría de gasto
-- ---------------------------------------------------------------------
create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  category_id uuid not null,
  month       date not null check (month = date_trunc('month', month)::date),
  amount      bigint not null check (amount > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, category_id, month),
  constraint budgets_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade
);
create index budgets_user_month_idx on public.budgets (user_id, month);
create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Vista de saldos por cuenta (security_invoker => respeta RLS del usuario)
--   saldo = inicial + ingresos - gastos + transferencias recibidas
--           - transferencias enviadas
-- ---------------------------------------------------------------------
create view public.account_balances
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
    end), 0) as balance
from public.accounts a
left join public.transactions t
  on a.id in (t.account_id, t.to_account_id) and t.user_id = a.user_id
group by a.id, a.user_id, a.initial_balance;

-- ---------------------------------------------------------------------
-- Alta de usuario: perfil + categorías por defecto
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(split_part(coalesce(new.email, ''), '@', 1), ''));

  insert into public.categories (user_id, name, kind, color, icon, sort_order)
  values
    -- Gastos
    (new.id, 'Alimentación',   'expense', '#ef4444', 'utensils',      1),
    (new.id, 'Transporte',     'expense', '#f97316', 'bus',           2),
    (new.id, 'Vivienda',       'expense', '#8b5cf6', 'home',          3),
    (new.id, 'Servicios',      'expense', '#06b6d4', 'zap',           4),
    (new.id, 'Salud',          'expense', '#ec4899', 'heart-pulse',   5),
    (new.id, 'Ocio',           'expense', '#eab308', 'gamepad-2',     6),
    (new.id, 'Educación',      'expense', '#3b82f6', 'graduation-cap',7),
    (new.id, 'Suscripciones',  'expense', '#a855f7', 'repeat',        8),
    (new.id, 'Ropa',           'expense', '#14b8a6', 'shirt',         9),
    (new.id, 'Mascotas',       'expense', '#84cc16', 'paw-print',    10),
    (new.id, 'Otros gastos',   'expense', '#64748b', 'tag',          11),
    -- Ingresos
    (new.id, 'Sueldo',         'income',  '#16a34a', 'briefcase',     1),
    (new.id, 'Honorarios',     'income',  '#22c55e', 'receipt',       2),
    (new.id, 'Inversiones',    'income',  '#10b981', 'trending-up',   3),
    (new.id, 'Otros ingresos', 'income',  '#64748b', 'tag',           4);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Eliminar mi cuenta y todos mis datos.
-- Borra auth.users del usuario autenticado; el ON DELETE CASCADE de
-- todas las tablas elimina el resto. Solo puede borrarse a sí mismo.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- (select auth.uid()) se evalúa una vez por consulta (mejor rendimiento).
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;

-- Se genera la misma política de 4 operaciones para cada tabla con user_id.
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets'] loop
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- profiles: el perfil lo crea el trigger; el usuario solo lo lee y edita.
-- (Su borrado ocurre por cascada al eliminar la cuenta.)
create policy "profiles_select" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "profiles_update" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Privilegios: nada para anon; lo mínimo para authenticated.
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.accounts, public.categories,
              public.transactions, public.budgets, public.account_balances
  from anon, public;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete
  on public.accounts, public.categories, public.transactions, public.budgets
  to authenticated;
grant select on public.account_balances to authenticated;

-- Funciones: solo delete_my_account es invocable desde el cliente.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
