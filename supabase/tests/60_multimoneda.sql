-- =====================================================================
-- Pruebas de la migración 0009 (cuentas en UF o dólares).
-- Usuaria nueva: Eva. Bruno sigue de los datos anteriores.
-- =====================================================================

insert into auth.users (email) values ('eva@test');

do $$
begin
  perform set_config('test.eva', (select id::text from auth.users where email = 'eva@test'), false);
  perform set_config('test.bruno', (select id::text from auth.users where email = 'bruno@test'), false);
  perform set_config('test.e_cat', (select id::text from public.categories
                                    where user_id = test.id('eva') and name = 'Transporte'), false);
end $$;

-- ---------------------------------------------------------------------
\echo '== 0. Datos existentes: todo queda en pesos'
do $$
begin
  perform test.ok((select bool_and(currency = 'CLP' and initial_balance_native is null) from public.accounts),
                  'Las cuentas existentes quedan en CLP');
  perform test.ok((select bool_and(balance_native is null) from public.account_balances),
                  'Sin saldo en otra moneda para cuentas en pesos');
  perform test.ok((select bool_and(not multi_currency) from public.profiles), 'La opción multimoneda parte apagada');
end $$;

-- ---------------------------------------------------------------------
\echo '== 1. Cuentas en dólares (como Eva)'
select test.login(test.id('eva')) is null as _ \gset
set role authenticated;
do $$
declare usd uuid; clp uuid;
begin
  update public.profiles set multi_currency = true;
  perform test.ok((select multi_currency from public.profiles), 'Eva activa la multimoneda');

  insert into public.accounts (name, type, currency, initial_balance, initial_balance_native)
  values ('Cuenta USD', 'bank', 'USD', 950000, 1000) returning id into usd;
  insert into public.accounts (name, type, initial_balance) values ('Cuenta RUT', 'bank', 200000) returning id into clp;
  perform set_config('test.usd', usd::text, false);
  perform set_config('test.clp', clp::text, false);
  perform test.ok((select balance = 950000 and balance_native = 1000 from public.account_balances where account_id = usd),
                  'Saldo inicial: 1.000 USD (≈ $950.000)');

  perform test.fails($q$insert into public.accounts (name, type, currency, initial_balance) values ('x', 'bank', 'USD', 1)$q$,
                     'Una cuenta en USD necesita su saldo en USD');
  perform test.fails($q$insert into public.accounts (name, type, initial_balance, initial_balance_native) values ('x', 'bank', 1, 1)$q$,
                     'Una cuenta en pesos no lleva saldo en otra moneda');
  perform test.fails($q$insert into public.accounts (name, type, currency, initial_balance, initial_balance_native) values ('x', 'loan', 'UF', -1, -1)$q$,
                     'Por ahora las deudas e inversiones son en pesos');
  perform test.fails($q$insert into public.accounts (name, type, currency, initial_balance, initial_balance_native) values ('x', 'bank', 'EUR', 1, 1)$q$,
                     'Solo CLP, UF y USD');
  perform test.fails(format($q$update public.accounts set currency = 'UF' where id = %L$q$, usd),
                     'La moneda no se puede cambiar después');
end $$;

-- ---------------------------------------------------------------------
\echo '== 2. Movimientos en la cuenta en dólares'
do $$
begin
  perform test.fails(format($q$insert into public.transactions (type, amount, account_id, category_id) values ('expense', 19000, %L, %L)$q$,
                            test.id('usd'), test.id('e_cat')), 'Un gasto en la cuenta USD necesita el monto en USD');
  perform test.fails(format($q$insert into public.transactions (type, amount, amount_native, account_id, category_id) values ('expense', 19000, 20, %L, %L)$q$,
                            test.id('clp'), test.id('e_cat')), 'Un gasto en pesos no lleva monto en otra moneda');

  insert into public.transactions (type, amount, amount_native, date, account_id, category_id)
  values ('expense', 19000, 20.5, '2026-10-10', test.id('usd'), test.id('e_cat'));
  perform test.ok((select balance = 931000 and balance_native = 979.5 from public.account_balances where account_id = test.id('usd')),
                  'Gasto de 20,5 USD: quedan 979,5 USD');
  perform test.ok((select total = 19000 from public.spending_by_category('2026-10-01', '2026-10-31') where category_id = test.id('e_cat')),
                  'El gasto cuenta en pesos del día en los reportes');
  perform test.ok((select expense = 19000 from public.monthly_totals('2026-10-01', '2026-10-31')),
                  'Y en los totales del mes');
end $$;

-- ---------------------------------------------------------------------
\echo '== 3. Transferencias entre monedas'
do $$
begin
  -- Vende 100 USD: llegan $95.000 a la cuenta en pesos.
  insert into public.transactions (type, amount, amount_native, account_id, to_account_id)
  values ('transfer', 95000, 100, test.id('usd'), test.id('clp'));
  perform test.ok((select balance_native = 879.5 from public.account_balances where account_id = test.id('usd')), 'Salen 100 USD');
  perform test.ok((select balance = 295000 from public.account_balances where account_id = test.id('clp')), 'Llegan $95.000');

  perform test.fails(format($q$insert into public.transactions (type, amount, account_id, to_account_id) values ('transfer', 48000, %L, %L)$q$,
                            test.id('clp'), test.id('usd')), 'Hacia la cuenta USD hay que decir cuántos USD llegaron');
  insert into public.transactions (type, amount, to_amount_native, account_id, to_account_id)
  values ('transfer', 48000, 50, test.id('clp'), test.id('usd'));
  perform test.ok((select balance_native = 929.5 from public.account_balances where account_id = test.id('usd')), 'Compra 50 USD');
  perform test.ok((select balance = 247000 from public.account_balances where account_id = test.id('clp')), 'Salen $48.000');
  perform test.fails(format($q$insert into public.transactions (type, amount, to_amount_native, account_id, category_id) values ('expense', 1000, 1, %L, %L)$q$,
                            test.id('clp'), test.id('e_cat')), 'Un gasto no lleva monto de llegada');
end $$;

-- ---------------------------------------------------------------------
\echo '== 4. Recurrentes, cuotas e importación siguen solo en pesos'
do $$
begin
  perform test.fails(format($q$insert into public.recurring_rules (type, amount, account_id, category_id, frequency, start_date) values ('expense', 1000, %L, %L, 'monthly', '2026-10-01')$q$,
                            test.id('usd'), test.id('e_cat')), 'Un recurrente en la cuenta USD se rechaza');
  insert into public.accounts (name, type, currency, initial_balance, initial_balance_native, credit_limit)
  values ('Tarjeta USD', 'credit_card', 'USD', 0, 0, 2000);
  perform test.fails(format($q$select public.create_installment_plan('Viaje', %L, %L, 300000, 3, '2026-10-01')$q$,
                            (select id from public.accounts where name = 'Tarjeta USD'), test.id('e_cat')),
                     'Una compra en cuotas en la tarjeta USD se rechaza');
  perform test.fails(format($q$select public.import_transactions(%L, 'c.csv', '[{"type":"expense","amount":1000,"date":"2026-10-01","import_hash":"h1"}]')$q$,
                            test.id('usd')), 'Importar una cartola a la cuenta USD se rechaza');
end $$;

-- ---------------------------------------------------------------------
\echo '== 5. Valores de la UF y el dólar'
do $$
begin
  insert into public.exchange_rates (currency, date, clp) values ('USD', '2026-10-10', 950.12), ('UF', '2026-10-10', 39500.5);
  perform test.ok((select count(*) from public.exchange_rates) = 2, 'Eva guarda valores');
  perform test.fails($q$insert into public.exchange_rates (currency, date, clp) values ('USD', '2026-10-10', 1)$q$,
                     'Un valor por moneda y día');
  perform test.fails($q$insert into public.exchange_rates (currency, date, clp) values ('EUR', '2026-10-11', 1)$q$, 'Solo UF y USD');
end $$;

reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
begin
  perform test.ok((select count(*) from public.exchange_rates) = 0, 'Bruno no ve los valores de Eva');
  perform test.ok((select count(*) from public.account_balances where account_id = test.id('usd')) = 0,
                  'Bruno no ve el saldo de la cuenta USD de Eva');
  perform test.fails(format($q$insert into public.transactions (type, amount, account_id, to_account_id) values ('transfer', 1, %L, %L)$q$,
                            (select id from public.accounts where user_id = test.id('bruno') limit 1), test.id('usd')),
                     'Bruno no puede transferir a la cuenta de Eva');
end $$;

reset role; select test.login(null) is null as _ \gset
set role anon;
do $$
begin
  perform test.fails('select * from public.exchange_rates', 'anon no lee exchange_rates');
end $$;

reset role;
\echo ''
\echo '✅ Todas las pruebas SQL de 0009 pasaron'
