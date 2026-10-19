-- =====================================================================
-- 0002_categories_budgets.sql — Fase 3
-- Ejecutar DESPUÉS de 0001_schema.sql (SQL Editor o `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Una categoría en uso no puede cambiar de tipo (gasto <-> ingreso):
--    dejaría transacciones con una categoría del tipo equivocado.
-- ---------------------------------------------------------------------
create or replace function public.prevent_category_kind_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> old.kind and (
    exists (select 1 from public.transactions where category_id = old.id)
    or exists (select 1 from public.budgets where category_id = old.id)
  ) then
    raise exception 'No se puede cambiar el tipo de una categoría con movimientos o presupuestos'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger categories_kind_locked
  before update of kind on public.categories
  for each row execute function public.prevent_category_kind_change();

-- ---------------------------------------------------------------------
-- 2. Solo se presupuestan categorías de gasto.
-- ---------------------------------------------------------------------
create or replace function public.check_budget_category_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories
    where id = new.category_id and user_id = new.user_id and kind = 'expense'
  ) then
    raise exception 'Los presupuestos solo aplican a categorías de gasto' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger budgets_category_kind
  before insert or update of category_id on public.budgets
  for each row execute function public.check_budget_category_kind();

-- ---------------------------------------------------------------------
-- 3. Gasto por categoría en un rango de fechas (presupuestos y dashboard).
--    security invoker => corre con los permisos del usuario y respeta RLS;
--    además filtra explícitamente por auth.uid().
--    Las transferencias no cuentan (solo type = 'expense').
-- ---------------------------------------------------------------------
create or replace function public.spending_by_category(p_from date, p_to date)
returns table (category_id uuid, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.amount)::bigint as total
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.type = 'expense'
    and t.date between p_from and p_to
  group by t.category_id;
$$;

revoke all on function public.spending_by_category(date, date) from public, anon;
grant execute on function public.spending_by_category(date, date) to authenticated;
