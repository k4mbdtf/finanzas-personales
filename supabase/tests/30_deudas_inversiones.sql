-- =====================================================================
-- Pruebas de la migración 0006 (deudas separadas, bancos e inversiones).
-- Igual que 20_etapa2.sql: cada bloque corre con el rol y "JWT" del usuario.
-- =====================================================================

do $$
begin
  perform set_config('test.carla',  (select id::text from auth.users where email = 'carla@test'), false);
  perform set_config('test.bruno',  (select id::text from auth.users where email = 'bruno@test'), false);
  perform set_config('test.c_bank', (select id::text from public.accounts where name = 'Cuenta Carla'), false);
  perform set_config('test.c_loan', (select id::text from public.accounts where name = 'Crédito Carla'), false);
  perform set_config('test.c_recv', (select id::text from public.accounts where name = 'Diego me debe'), false);
  perform set_config('test.b_bank', (select id::text from public.accounts where name = 'Cuenta Bruno'), false);
  perform set_config('test.c_cat',  (select c.id::text from public.categories c join auth.users u on u.id = c.user_id
                                     where u.email = 'carla@test' and c.name = 'Otros gastos'), false);
  perform set_config('test.c_rule', (select r.id::text from public.recurring_rules r join auth.users u on u.id = r.user_id
                                     where u.email = 'carla@test'), false);
end $$;

\echo '== 0. Datos existentes tras la migración 0006'
do $$
begin
  perform test.ok((select count(*) from public.accounts where user_id = test.id('carla')) = 3,
                  'Las 3 cuentas de Carla (banco, deuda y me deben) siguen ahí');
  perform test.ok((select institution is null and investment_kind is null from public.accounts where id = test.id('c_loan')),
                  'Las columnas nuevas quedan en null');
  perform test.ok((select balance = -557000 and inflow = 50000 and outflow = 7000
                   from public.account_balances where account_id = test.id('c_loan')),
                  'Deuda: saldo -557.000, pagado 50.000 y cargado 7.000');
  perform test.ok((select balance = 450000 and inflow = 0 and outflow = 50000
                   from public.account_balances where account_id = test.id('c_bank')),
                  'Banco: saldo 450.000 (salió el pago)');
end $$;

-- ---------------------------------------------------------------------
\echo '== 1. Una regla antigua con gastos en la deuda no frena las recurrentes (como Carla)'
select test.login(test.id('carla')) is null as _ \gset
set role authenticated;
do $$
declare n int;
begin
  n := public.materialize_recurring('2026-03-15');
  perform test.ok(n = 3, 'materialize_recurring genera sus 3 meses sin error');
  update public.recurring_rules set active = false where id = test.id('c_rule');
  perform test.ok((select not active from public.recurring_rules where id = test.id('c_rule')),
                  'La regla antigua se puede pausar');
  perform test.fails(format($q$update public.recurring_rules set account_id = %L where id = %L$q$,
                            test.id('c_loan'), test.id('c_rule')),
                     'Guardarla otra vez con la deuda como cuenta se rechaza');
  update public.recurring_rules set account_id = test.id('c_bank') where id = test.id('c_rule');
  perform test.ok((select account_id = test.id('c_bank') from public.recurring_rules where id = test.id('c_rule')),
                  'Se corrige eligiendo una cuenta de dinero');
end $$;

-- ---------------------------------------------------------------------
\echo '== 2. Deudas e inversiones solo se mueven desde o hacia una cuenta'
do $$
declare v uuid;
begin
  insert into public.accounts (name, type, initial_balance, investment_kind, counterparty, institution)
  values ('Fondo Carla', 'investment', 100000, 'fund', 'Fintual', 'fintual')
  returning id into v;
  perform set_config('test.c_inv', v::text, false);
  perform test.ok(true, 'Se crea una inversión con tipo, plataforma e institución');

  perform test.fails(format($q$insert into public.transactions (type, amount, account_id, category_id)
                               values ('expense', 1000, %L, %L)$q$, test.id('c_loan'), test.id('c_cat')),
                     'Un gasto en una deuda se rechaza');
  perform test.fails(format($q$insert into public.transactions (type, amount, account_id, category_id)
                               values ('expense', 1000, %L, %L)$q$, v, test.id('c_cat')),
                     'Un gasto en una inversión se rechaza');
  perform test.fails(format($q$insert into public.transactions (type, amount, account_id, to_account_id)
                               values ('transfer', 1000, %L, %L)$q$, v, test.id('c_loan')),
                     'Una transferencia de una inversión a una deuda se rechaza');
  perform test.fails(format($q$insert into public.recurring_rules (type, amount, account_id, category_id, frequency, start_date)
                               values ('expense', 1, %L, %L, 'monthly', '2026-01-01')$q$, test.id('c_recv'), test.id('c_cat')),
                     'Una regla con un gasto en "me deben" se rechaza');

  insert into public.transactions (type, amount, date, account_id, to_account_id)
  values ('transfer', 50000, '2026-04-05', test.id('c_bank'), test.id('c_loan'));
  insert into public.recurring_rules (type, amount, account_id, to_account_id, frequency, start_date)
  values ('transfer', 20000, test.id('c_bank'), v, 'monthly', '2026-06-01');
  perform test.ok(true, 'Pagar una deuda y aportar todos los meses a una inversión sí se puede');

  perform test.fails(format($q$update public.accounts set type = 'bank' where id = %L$q$, test.id('c_loan')),
                     'Una deuda no se convierte en cuenta bancaria');
  perform test.fails(format($q$update public.accounts set type = 'investment' where id = %L$q$, test.id('c_bank')),
                     'Una cuenta bancaria no se convierte en inversión');
  perform test.fails($q$insert into public.accounts (name, type, investment_kind) values ('x', 'bank', 'fund')$q$,
                     'Tipo de inversión en una cuenta bancaria se rechaza');
  perform test.fails($q$insert into public.accounts (name, type, initial_balance) values ('x', 'investment', -1)$q$,
                     'Inversión con aporte inicial negativo se rechaza');
  perform test.fails($q$insert into public.accounts (name, type, institution) values ('x', 'bank', 'Banco Estado!')$q$,
                     'Institución con formato inválido se rechaza');
  insert into public.accounts (name, type, institution) values ('CuentaRUT', 'bank', 'bancoestado');
  perform test.ok(true, 'Cuenta bancaria con institución (logo y color del banco)');
end $$;

-- ---------------------------------------------------------------------
\echo '== 3. Valor de las inversiones'
do $$
declare s record; n int;
begin
  select * into s from public.investment_status where account_id = test.id('c_inv');
  perform test.ok(s.contributed = 100000 and s.withdrawn = 0 and s.valued_at is null and s.current_value = 100000,
                  'Sin valorizaciones vale lo aportado (100.000)');

  insert into public.investment_valuations (account_id, date, value, created_at)
  values (test.id('c_inv'), '2026-05-31', 112000, '2026-05-31 20:00-04');
  select * into s from public.investment_status where account_id = test.id('c_inv');
  perform test.ok(s.current_value = 112000 and s.last_value = 112000 and s.valued_at = '2026-05-31',
                  'Con una valorización vale 112.000');

  -- Mismo día: registrado después de la valorización (se suma) y antes (ya estaba incluido).
  insert into public.transactions (type, amount, date, account_id, to_account_id, created_at)
  values ('transfer', 30000, '2026-05-31', test.id('c_bank'), test.id('c_inv'), '2026-05-31 21:00-04'),
         ('transfer', 5000, '2026-05-31', test.id('c_bank'), test.id('c_inv'), '2026-05-31 19:00-04');
  insert into public.transactions (type, amount, date, account_id, to_account_id)
  values ('transfer', 10000, '2026-06-10', test.id('c_inv'), test.id('c_bank'));
  select * into s from public.investment_status where account_id = test.id('c_inv');
  perform test.ok(s.contributed = 135000, 'Aportado = 100.000 + 30.000 + 5.000');
  perform test.ok(s.withdrawn = 10000, 'Rescatado = 10.000');
  perform test.ok(s.current_value = 132000,
                  'Valor = valorización + aportes posteriores − rescates (112.000 + 30.000 − 10.000)');

  n := public.materialize_recurring('2026-07-15');
  perform test.ok(n = 2, 'El aporte mensual recurrente genera junio y julio (la regla antigua sigue pausada)');
  select * into s from public.investment_status where account_id = test.id('c_inv');
  perform test.ok(s.contributed = 175000 and s.current_value = 172000,
                  'Los aportes recurrentes suben lo aportado (175.000) y el valor (172.000)');

  perform test.fails(format($q$insert into public.investment_valuations (account_id, value) values (%L, 1)$q$, test.id('c_bank')),
                     'No se valoriza una cuenta bancaria');
  perform test.fails(format($q$insert into public.investment_valuations (account_id, value) values (%L, -1)$q$, test.id('c_inv')),
                     'Un valor negativo se rechaza');
end $$;

-- ---------------------------------------------------------------------
\echo '== 4. Crear deudas e inversiones con su movimiento inicial'
do $$
declare v uuid; before numeric;
begin
  before := (select balance from public.account_balances where account_id = test.id('c_bank'));

  v := public.create_tracked_account(
    '{"type":"loan","name":"Crédito auto","initial_balance":-200000,"loan_installment":40000,
      "loan_installments_count":30,"counterparty":"BancoEstado","institution":"bancoestado","color":"#c8102e"}',
    test.id('c_bank'), 1000000, '2026-07-01');
  perform test.ok((select balance from public.account_balances where account_id = v) = -1200000,
                  'Préstamo nuevo: la deuda total es 1.200.000 (incluye lo recibido)');
  perform test.ok((select balance from public.account_balances where account_id = test.id('c_bank')) = before + 1000000,
                  'El dinero recibido entra a la cuenta');
  perform test.ok((select count(*) from public.transactions
                   where account_id = v and to_account_id = test.id('c_bank') and type = 'transfer') = 1,
                  'Se registra como transferencia deuda → cuenta (no es un ingreso)');

  v := public.create_tracked_account('{"type":"receivable","name":"Préstamo a Eva","counterparty":" Eva "}',
                                     test.id('c_bank'), 25000, '2026-07-02');
  perform test.ok((select balance from public.account_balances where account_id = v) = 25000, 'Eva debe 25.000');
  perform test.ok((select counterparty from public.accounts where id = v) = 'Eva', 'Se limpian los espacios');
  perform test.ok((select balance from public.account_balances where account_id = test.id('c_bank')) = before + 975000,
                  'Lo prestado a Eva sale de la cuenta');

  v := public.create_tracked_account('{"type":"investment","name":"DAP","investment_kind":"deposit"}',
                                     test.id('c_bank'), 300000, '2026-07-03', 300000);
  perform set_config('test.c_dap', v::text, false);
  perform test.ok((select contributed = 300000 and current_value = 300000 and valued_at = '2026-07-03'
                   from public.investment_status where account_id = v),
                  'Aporte inicial con su valor: vale 300.000 (no 600.000)');

  v := public.create_tracked_account('{"type":"investment","name":"Acciones","investment_kind":"stocks","initial_balance":80000}',
                                     null, null, '2026-07-04', 95000);
  perform test.ok((select contributed = 80000 and current_value = 95000 from public.investment_status where account_id = v),
                  'Inversión que ya existía: aportado 80.000, vale 95.000');

  perform test.fails($q$select public.create_tracked_account('{"type":"bank","name":"x"}')$q$,
                     'No sirve para crear cuentas de dinero');
  perform test.fails(format($q$select public.create_tracked_account('{"type":"receivable","name":"x"}', %L, 0)$q$, test.id('c_bank')),
                     'Un movimiento de $0 se rechaza');
  perform test.fails(format($q$select public.create_tracked_account('{"type":"receivable","name":"x"}', %L, 100)$q$, test.id('c_inv')),
                     'El dinero no puede salir de otra inversión');
  perform test.fails(format($q$select public.create_tracked_account('{"type":"receivable","name":"x"}', %L, 100)$q$, test.id('b_bank')),
                     'El dinero no puede salir de la cuenta de Bruno');
  perform test.fails($q$select public.create_tracked_account('{"type":"loan","name":"x"}', null, null, null, 100)$q$,
                     'Un valor actual en una deuda se rechaza');
  perform test.ok((select count(*) from public.accounts where name = 'x') = 0, 'Los intentos fallidos no dejaron cuentas a medias');
end $$;

-- ---------------------------------------------------------------------
\echo '== 5. Patrimonio con el valor de las inversiones'
do $$
declare r record; v_expected numeric;
begin
  -- Abril: banco 400.000; deuda 510.000 (600.000 − 2 pagos + 7.000 + 3 × 1.000).
  -- La inversión y "me deben" aún no existían (cuentan desde su primer registro).
  select * into r from public.net_worth_by_month('2026-04-01', '2026-04-01');
  perform test.ok(r.assets = 400000 and r.liabilities = 510000, 'Abril: activos 400.000 y deudas 510.000');

  -- Mayo: la inversión vale su valorización del 31 + el aporte registrado después (142.000).
  select * into r from public.net_worth_by_month('2026-05-01', '2026-05-01');
  perform test.ok(r.assets = 365000 + 142000 and r.liabilities = 510000,
                  'Mayo: banco 365.000 + inversión 142.000 (valor de mercado)');

  select * into r from public.net_worth_by_month(current_date, current_date);
  v_expected := (select sum(b.balance) from public.account_balances b
                 join public.accounts a on a.id = b.account_id where a.type <> 'investment')
              + (select sum(current_value) from public.investment_status);
  perform test.ok(r.assets - r.liabilities = v_expected,
                  format('Este mes: patrimonio = saldos + valor de las inversiones (%s)', v_expected));
end $$;

-- ---------------------------------------------------------------------
\echo '== 6. Metas vinculadas a una inversión'
do $$
declare g uuid;
begin
  insert into public.goals (name, target_amount, account_id) values ('Pie', 1000000, test.id('c_dap')) returning id into g;
  perform test.ok((select saved from public.goal_progress where goal_id = g) = 300000,
                  'El avance de la meta es el valor de la inversión (300.000)');
  insert into public.investment_valuations (account_id, date, value) values (test.id('c_dap'), '2026-08-01', 303000);
  perform test.ok((select saved from public.goal_progress where goal_id = g) = 303000,
                  'Al actualizar el valor, la meta avanza (303.000)');
end $$;

-- ---------------------------------------------------------------------
\echo '== 7. Aislamiento: Bruno no ve ni toca lo de Carla'
reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
declare n int;
begin
  perform test.ok((select count(*) from public.investment_valuations) = 0, 'Bruno ve 0 valorizaciones');
  perform test.ok((select count(*) from public.investment_status) = 0, 'Bruno ve 0 inversiones');
  perform test.ok((select count(*) from public.account_balances) = 1, 'Bruno ve solo su cuenta en account_balances');
  perform test.fails(format($q$insert into public.investment_valuations (account_id, value) values (%L, 1)$q$, test.id('c_inv')),
                     'Bruno no puede valorizar la inversión de Carla');
  perform test.fails(format($q$select public.create_tracked_account('{"type":"receivable","name":"x"}', %L, 100)$q$, test.id('c_bank')),
                     'Bruno no puede sacar dinero de la cuenta de Carla');
  update public.investment_valuations set value = 1;
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'UPDATE de valorizaciones ajenas afecta 0 filas');
  delete from public.investment_valuations;
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'DELETE de valorizaciones ajenas afecta 0 filas');
end $$;

-- ---------------------------------------------------------------------
\echo '== 8. Sin sesión (anon)'
reset role; select test.login(null) is null as _ \gset
set role anon;
do $$
begin
  perform test.fails('select * from public.investment_valuations', 'anon no lee investment_valuations');
  perform test.fails('select * from public.investment_status', 'anon no lee investment_status');
  perform test.fails('select * from public.account_balances', 'anon no lee account_balances');
  perform test.fails($q$select public.create_tracked_account('{}')$q$, 'anon no ejecuta create_tracked_account');
end $$;

-- ---------------------------------------------------------------------
\echo '== 9. Eliminar mi cuenta borra también las valorizaciones (como Carla)'
reset role; select test.login(test.id('carla')) is null as _ \gset
set role authenticated;
select public.delete_my_account() is null as _ \gset
reset role;
do $$
declare t text; n int;
begin
  foreach t in array array['accounts', 'transactions', 'recurring_rules', 'goals', 'investment_valuations'] loop
    execute format('select count(*) from public.%I where user_id = %L', t, test.id('carla')) into n;
    perform test.ok(n = 0, format('No quedan filas de Carla en %s', t));
  end loop;
  perform test.ok((select count(*) from public.accounts where user_id = test.id('bruno')) = 1,
                  'La cuenta de Bruno sigue intacta');
end $$;

\echo ''
\echo '✅ Todas las pruebas SQL de 0006 pasaron'
