-- =====================================================================
-- Pruebas de la migración 0010 (deudas en UF/USD y patrimonio al valor de cada mes).
-- Sigue con Eva (60_multimoneda.sql): Cuenta RUT en pesos y Cuenta USD.
-- =====================================================================

do $$
begin
  perform set_config('test.eva', (select id::text from auth.users where email = 'eva@test'), false);
  perform set_config('test.clp', (select id::text from public.accounts where name = 'Cuenta RUT' and user_id = test.id('eva')), false);
end $$;

select test.login(test.id('eva')) is null as _ \gset
set role authenticated;

-- ---------------------------------------------------------------------
\echo '== 1. Crédito hipotecario en UF con el dinero que llegó a la cuenta'
do $$
declare v uuid;
begin
  v := public.create_tracked_account(
    '{"name": "Hipotecario", "type": "loan", "currency": "UF", "loan_installment": 15.25, "loan_installments_count": 240, "payment_day": 5}',
    test.id('clp'), 3950000, '2026-09-01', null, 100);
  perform set_config('test.uf_loan', v::text, false);
  perform test.ok((select currency = 'UF' and initial_balance_native = 0 and loan_installment = 15.25 from public.accounts where id = v),
                  'Queda en UF, con la cuota con decimales');
  perform test.ok((select balance_native = -100 and balance = -3950000 from public.account_balances where account_id = v),
                  'Debe 100 UF (= $3.950.000 ese día)');
  perform test.ok((select amount_native = 100 and to_amount_native is null from public.transactions where account_id = v),
                  'El movimiento inicial lleva los UF del lado de la deuda');
  perform test.fails($q$select public.create_tracked_account('{"name": "Inv", "type": "investment", "currency": "USD"}')$q$,
                     'Las inversiones siguen en pesos');
  perform test.fails(format($q$select public.create_tracked_account('{"name": "y", "type": "loan", "currency": "UF"}', %L, 1000)$q$, test.id('clp')),
                     'Sin el monto en UF del movimiento inicial se rechaza');
end $$;

-- ---------------------------------------------------------------------
\echo '== 2. Pagar la cuota en pesos desde la cuenta RUT'
do $$
begin
  insert into public.transactions (type, amount, to_amount_native, date, account_id, to_account_id)
  values ('transfer', 600000, 15.25, '2026-10-05', test.id('clp'), test.id('uf_loan'));
  perform test.ok((select balance_native = -84.75 from public.account_balances where account_id = test.id('uf_loan')),
                  'Quedan 84,75 UF');
end $$;

-- ---------------------------------------------------------------------
\echo '== 3. Me deben en dólares'
do $$
declare v uuid;
begin
  v := public.create_tracked_account('{"name": "Ana me debe", "type": "receivable", "currency": "USD"}',
                                     test.id('clp'), 95000, '2026-10-01', null, 100);
  perform test.ok((select balance_native = 100 and balance = 95000 from public.account_balances where account_id = v),
                  'Le presté 100 USD ($95.000)');
  perform test.ok((select to_amount_native = 100 and amount_native is null from public.transactions where to_account_id = v),
                  'Los USD van del lado de "me deben"');
end $$;

-- ---------------------------------------------------------------------
\echo '== 4. Patrimonio: cuentas en UF/USD al valor de fin de cada mes'
do $$
declare before_liab bigint; after_liab bigint;
begin
  select liabilities into before_liab from public.net_worth_by_month('2026-09-01', '2026-09-01');
  perform test.ok(before_liab = 3950000, 'Sin valor de la UF guardado para septiembre: la deuda en pesos de sus movimientos');
  insert into public.exchange_rates (currency, date, clp) values ('UF', '2026-09-30', 39600);
  select liabilities into after_liab from public.net_worth_by_month('2026-09-01', '2026-09-01');
  perform test.ok(after_liab = 3960000, 'Con la UF de fin de mes: 100 UF × $39.600');
  -- En octubre vale el último valor hasta fin de mes: la UF del 10 de octubre ($39.500,5, de 60_multimoneda.sql).
  perform test.ok((select liabilities from public.net_worth_by_month('2026-10-01', '2026-10-01')) = round(84.75 * 39500.5),
                  'Octubre usa el último valor guardado hasta fin de mes (84,75 UF × $39.500,5)');
  -- La cuenta USD (929,5 USD) y "me deben" (100 USD) con el dólar del 10 de octubre ($950,12).
  perform test.ok((select assets from public.net_worth_by_month('2026-10-01', '2026-10-01'))
                  = (select balance from public.account_balances where account_id = test.id('clp'))
                    + round(929.5 * 950.12) + round(100 * 950.12),
                  'Activos: RUT en pesos + USD (cuenta y me deben) al último valor del dólar');
end $$;

reset role;
\echo ''
\echo '✅ Todas las pruebas SQL de 0010 pasaron'
