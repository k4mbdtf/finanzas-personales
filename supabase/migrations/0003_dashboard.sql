-- =====================================================================
-- 0003_dashboard.sql — Fase 4
-- Ejecutar DESPUÉS de 0002_categories_budgets.sql.
-- =====================================================================

-- Ingresos y gastos por mes en un rango (barras de 12 meses y KPIs).
-- Las transferencias quedan fuera: no son ingreso ni gasto.
-- security invoker => respeta RLS; además filtra por auth.uid().
-- Solo devuelve meses con movimientos; el cliente completa los vacíos con 0.
create or replace function public.monthly_totals(p_from date, p_to date)
returns table (month date, income bigint, expense bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    date_trunc('month', t.date)::date as month,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint  as income,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint as expense
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.type in ('income', 'expense')
    and t.date between p_from and p_to
  group by 1
  order by 1;
$$;

revoke all on function public.monthly_totals(date, date) from public, anon;
grant execute on function public.monthly_totals(date, date) to authenticated;
