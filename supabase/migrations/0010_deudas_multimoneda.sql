-- =====================================================================
-- 0010_deudas_multimoneda.sql — Deudas en UF o dólares y patrimonio al valor de cada mes
-- Ejecutar DESPUÉS de 0009_multimoneda.sql.
--
-- * Los préstamos (p. ej. un crédito hipotecario en UF) y los "me deben" también pueden
--   ser en UF o USD. Las inversiones siguen en pesos.
-- * Valor de la cuota y monto original con decimales (en UF: 15,25).
-- * create_tracked_account() acepta el monto en la moneda de la deuda (p_native) para el
--   movimiento inicial (el préstamo que llegó a tu cuenta, o lo que prestaste).
-- * Patrimonio: las cuentas en UF/USD valen su saldo en esa moneda × el valor de fin de
--   cada mes (guardado en exchange_rates; la app lo trae antes de consultar).
-- =====================================================================

alter table public.accounts drop constraint accounts_currency_types;
alter table public.accounts
  add constraint accounts_currency_types check (currency = 'CLP' or type <> 'investment');

alter table public.accounts
  alter column loan_amount      type numeric(18, 4),
  alter column loan_installment type numeric(18, 4);

-- Misma función que en 0006 con un parámetro más: se reemplaza (no se agrega otra versión).
drop function public.create_tracked_account(jsonb, uuid, bigint, date, bigint);

create function public.create_tracked_account(
  p_account      jsonb,
  p_cash_account uuid    default null,
  p_cash_amount  bigint  default null,
  p_date         date    default null,
  p_value        bigint  default null,
  -- Deuda en UF/USD: cuánto es el movimiento inicial en esa moneda (p_cash_amount va en pesos).
  p_native       numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a        public.accounts;
  v_id     uuid;
  v_cur    text;
  v_date   date := coalesce(p_date, (now() at time zone 'America/Santiago')::date);
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  a := jsonb_populate_record(null::public.accounts, p_account);
  if a.type is null or a.type not in ('loan', 'receivable', 'investment') then
    raise exception 'Solo se pueden crear deudas, préstamos que te deben o inversiones' using errcode = '22023';
  end if;
  v_cur := coalesce(a.currency, 'CLP');

  insert into public.accounts
    (name, type, initial_balance, payment_day, counterparty, loan_amount, loan_installment,
     loan_installments_count, interest_rate, color, institution, investment_kind, currency, initial_balance_native)
  values
    (btrim(a.name), a.type, coalesce(a.initial_balance, 0), a.payment_day, nullif(btrim(a.counterparty), ''),
     a.loan_amount, a.loan_installment, a.loan_installments_count, a.interest_rate,
     coalesce(a.color, '#6b6b6b'), a.institution, a.investment_kind, v_cur,
     case when v_cur <> 'CLP' then coalesce(a.initial_balance_native, 0) end)
  returning id into v_id;

  if p_cash_account is not null then
    if p_cash_amount is null or p_cash_amount <= 0 then
      raise exception 'Ingresa un monto mayor a $0' using errcode = '23514';
    end if;
    -- Préstamo: sale de la deuda hacia tu cuenta. Me deben / inversión: sale de tu cuenta.
    -- En una deuda en UF/USD su lado lleva el monto en esa moneda (el trigger de 0009 lo exige).
    insert into public.transactions (type, amount, amount_native, to_amount_native, date, account_id, to_account_id, note)
    values (
      'transfer', p_cash_amount,
      case when a.type = 'loan' and v_cur <> 'CLP' then p_native end,
      case when a.type <> 'loan' and v_cur <> 'CLP' then p_native end,
      v_date,
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

revoke all on function public.create_tracked_account(jsonb, uuid, bigint, date, bigint, numeric) from public, anon;
grant execute on function public.create_tracked_account(jsonb, uuid, bigint, date, bigint, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- Patrimonio: igual que en 0006, pero las cuentas en UF/USD se valoran a fin de cada mes.
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
    select t.account_id, t.to_account_id, t.type, t.amount, t.amount_native, t.to_amount_native, t.created_at,
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
    select a.id, a.type, a.initial_balance, a.currency, a.initial_balance_native,
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
    select m.month, a.type, a.currency, a.initial_balance_native, m.month_end, a.id,
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
  -- Cuentas en UF/USD: su saldo en esa moneda a fin de mes × el valor de ese día (el último
  -- guardado hasta esa fecha). Sin ningún valor guardado, la suma en pesos de sus movimientos.
  native as (
    select r.month, r.id,
           r.initial_balance_native + coalesce((
             select sum(case
                          when x.account_id = r.id and x.type = 'income' then x.amount_native
                          when x.account_id = r.id then -x.amount_native
                          else x.to_amount_native
                        end)
             from tx x
             where r.id in (x.account_id, x.to_account_id) and x.effective_date <= r.month_end
           ), 0) as balance_native,
           (select e.clp from public.exchange_rates e
            where e.user_id = (select auth.uid()) and e.currency = r.currency and e.date <= r.month_end
            order by e.date desc limit 1) as rate
    from raw r
    where r.currency <> 'CLP'
  ),
  bal as (
    select r.month, r.type,
           case
             when r.type = 'investment' then greatest(r.balance, 0)
             when n.rate is not null then round(n.balance_native * n.rate)
             else r.balance
           end as balance
    from raw r
    left join native n on n.month = r.month and n.id = r.id
  )
  select m.month,
         coalesce(sum(b.balance) filter (where b.type in ('cash', 'bank', 'savings', 'receivable', 'investment')), 0)::bigint,
         coalesce(-sum(b.balance) filter (where b.type in ('credit_card', 'loan')), 0)::bigint
  from months m
  left join bal b on b.month = m.month
  group by m.month
  order by m.month;
$$;

revoke all on function public.net_worth_by_month(date, date) from public, anon;
grant execute on function public.net_worth_by_month(date, date) to authenticated;
