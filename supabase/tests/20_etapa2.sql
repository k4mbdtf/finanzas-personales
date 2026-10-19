-- =====================================================================
-- Pruebas de la migración 0005 (Etapa 2) en PostgreSQL local.
-- Cada bloque se ejecuta con el rol y "JWT" de un usuario, igual que la API.
-- Una prueba fallida corta la ejecución (ON_ERROR_STOP) con "FALLÓ: ...".
-- =====================================================================

-- IDs de referencia (como postgres)
do $$
begin
  perform set_config('test.ana',        (select id::text from auth.users where email = 'ana@test'), false);
  perform set_config('test.bruno',      (select id::text from auth.users where email = 'bruno@test'), false);
  perform set_config('test.ana_bank',   (select id::text from public.accounts where name = 'RUT'), false);
  perform set_config('test.ana_card',   (select id::text from public.accounts where name = 'Visa'), false);
  perform set_config('test.bruno_bank', (select id::text from public.accounts where name = 'Cuenta Bruno'), false);
  perform set_config('test.ana_exp_cat', (select c.id::text from public.categories c join auth.users u on u.id = c.user_id
                                          where u.email = 'ana@test' and c.name = 'Vivienda'), false);
  perform set_config('test.ana_inc_cat', (select c.id::text from public.categories c join auth.users u on u.id = c.user_id
                                          where u.email = 'ana@test' and c.name = 'Sueldo'), false);
  perform set_config('test.bruno_exp_cat', (select c.id::text from public.categories c join auth.users u on u.id = c.user_id
                                          where u.email = 'bruno@test' and c.name = 'Vivienda'), false);
end $$;

\echo '== 0. Datos existentes tras la migración'
do $$
begin
  perform test.ok((select count(*) from public.accounts) = 3, 'Las 3 cuentas existentes siguen ahí');
  perform test.ok((select credit_limit from public.accounts where name = 'Visa') = 500000,
                  'La tarjeta existente conserva su cupo');
  perform test.ok((select count(*) from public.transactions) = 1, 'La transacción existente sigue ahí');
  perform test.ok((select recurring_rule_id is null and import_hash is null from public.transactions),
                  'Las columnas nuevas quedan en null en filas antiguas');
end $$;

\echo '== 1. Fecha de ocurrencias (sin deriva de fin de mes)'
do $$
begin
  perform test.ok(public.recurring_occurrence('2026-01-31', 'monthly', 1, 1) = '2026-02-28', 'mensual 31-ene +1 = 28-feb');
  perform test.ok(public.recurring_occurrence('2026-01-31', 'monthly', 1, 2) = '2026-03-31', 'mensual 31-ene +2 = 31-mar (no 28)');
  perform test.ok(public.recurring_occurrence('2026-01-31', 'monthly', 1, 3) = '2026-04-30', 'mensual 31-ene +3 = 30-abr');
  perform test.ok(public.recurring_occurrence('2026-03-02', 'weekly', 2, 2) = '2026-03-30', 'cada 2 semanas');
  perform test.ok(public.recurring_occurrence('2024-02-29', 'yearly', 1, 1) = '2025-02-28', 'anual 29-feb +1 = 28-feb');
  perform test.ok(public.recurring_occurrence('2024-02-29', 'yearly', 1, 4) = '2028-02-29', 'anual 29-feb +4 = 29-feb');
end $$;

-- ---------------------------------------------------------------------
\echo '== 2. Préstamos y "me deben" (como Ana)'
reset role; select test.login(test.id('ana')) is null as _ \gset
set role authenticated;
do $$
declare v uuid;
begin
  insert into public.accounts (name, type, initial_balance, loan_amount, loan_installment,
                               loan_installments_count, interest_rate, payment_day, counterparty)
  values ('Crédito consumo', 'loan', -800000, 1000000, 50000, 24, 18.5, 10, 'Banco X')
  returning id into v;
  perform set_config('test.ana_loan', v::text, false);
  perform test.ok(true, 'Se crea un préstamo con monto, cuota, plazo, tasa y día de pago');

  insert into public.accounts (name, type, initial_balance, counterparty)
  values ('Juan me debe', 'receivable', 30000, 'Juan') returning id into v;
  perform set_config('test.ana_recv', v::text, false);
  perform test.ok(true, 'Se crea una cuenta "me deben"');

  perform test.fails($q$insert into public.accounts (name, type, loan_amount) values ('x', 'bank', 100)$q$,
                     'Datos de préstamo en una cuenta bancaria se rechazan');
  perform test.fails($q$insert into public.accounts (name, type, counterparty) values ('x', 'cash', 'Pedro')$q$,
                     'Acreedor en una cuenta de efectivo se rechaza');
  perform test.fails($q$insert into public.accounts (name, type, credit_limit) values ('x', 'loan', 100)$q$,
                     'Cupo en un préstamo se rechaza');
  perform test.fails($q$insert into public.accounts (name, type, payment_day) values ('x', 'savings', 5)$q$,
                     'Día de pago en una cuenta de ahorro se rechaza');
  perform test.fails($q$insert into public.accounts (name, type) values ('x', 'otro')$q$,
                     'Tipo de cuenta desconocido se rechaza');
end $$;

-- ---------------------------------------------------------------------
\echo '== 3. Metas de ahorro (como Ana)'
do $$
declare g1 uuid; g2 uuid;
begin
  insert into public.goals (name, target_amount, target_date) values ('Vacaciones', 500000, '2026-12-01')
  returning id into g1;
  perform set_config('test.ana_goal', g1::text, false);
  insert into public.goal_contributions (goal_id, amount) values (g1, 100000), (g1, 50000), (g1, -20000);
  perform test.ok((select saved from public.goal_progress where goal_id = g1) = 130000,
                  'Avance de meta manual = suma de abonos y retiros (130.000)');

  insert into public.goals (name, target_amount, account_id) values ('Fondo', 1000000, test.id('ana_bank'))
  returning id into g2;
  perform test.ok((select saved from public.goal_progress where goal_id = g2) = 90000,
                  'Avance de meta vinculada = saldo de la cuenta (90.000)');

  perform test.fails(format($q$insert into public.goals (name, target_amount, account_id) values ('x', 1, %L)$q$,
                            test.id('bruno_bank')), 'No se puede vincular una meta a la cuenta de Bruno');
  perform test.fails(format($q$insert into public.goal_contributions (goal_id, amount) values (%L, 0)$q$, g1),
                     'Abono de $0 se rechaza');
end $$;

\echo '== 3b. Metas: Bruno no ve ni toca las de Ana'
reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
declare n int;
begin
  perform test.ok((select count(*) from public.goals) = 0, 'Bruno ve 0 metas');
  perform test.ok((select count(*) from public.goal_contributions) = 0, 'Bruno ve 0 abonos');
  perform test.ok((select count(*) from public.goal_progress) = 0, 'Bruno ve 0 filas en goal_progress');
  update public.goals set name = 'HACK' where id = test.id('ana_goal');
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'UPDATE de meta ajena afecta 0 filas');
  delete from public.goals where id = test.id('ana_goal');
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'DELETE de meta ajena afecta 0 filas');
  perform test.fails(format($q$insert into public.goal_contributions (goal_id, amount) values (%L, 1000)$q$,
                            test.id('ana_goal')), 'Bruno no puede abonar a la meta de Ana');
end $$;

-- ---------------------------------------------------------------------
\echo '== 4. Recurrentes (como Ana)'
reset role; select test.login(test.id('ana')) is null as _ \gset
set role authenticated;
do $$
declare r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; n int;
begin
  insert into public.recurring_rules (type, amount, account_id, category_id, note, tags, frequency, start_date)
  values ('expense', 300000, test.id('ana_bank'), test.id('ana_exp_cat'), 'Arriendo', '{casa}', 'monthly', '2026-01-31')
  returning id into r1;
  perform set_config('test.ana_rule', r1::text, false);
  perform test.ok((select next_date from public.recurring_rules where id = r1) = '2026-01-31',
                  'next_date se calcula solo al crear');

  n := public.materialize_recurring('2026-05-15');
  perform test.ok(n = 4, 'Mensual desde 31-ene hasta 15-may genera 4 movimientos');
  perform test.ok(array(select date from public.transactions where recurring_rule_id = r1 order by date)
                  = array['2026-01-31','2026-02-28','2026-03-31','2026-04-30']::date[],
                  'Fechas 31-ene, 28-feb, 31-mar, 30-abr');
  perform test.ok((select next_date = '2026-05-31' and occurrence_count = 4 from public.recurring_rules where id = r1),
                  'La regla queda con próxima fecha 31-may');
  perform test.ok((select bool_and(note = 'Arriendo' and tags = '{casa}' and category_id = test.id('ana_exp_cat'))
                   from public.transactions where recurring_rule_id = r1),
                  'Los movimientos copian nota, etiquetas y categoría');
  perform test.ok(public.materialize_recurring('2026-05-15') = 0, 'Ejecutar de nuevo no duplica (0 nuevos)');

  insert into public.recurring_rules (type, amount, account_id, category_id, frequency, interval_count, start_date)
  values ('expense', 5000, test.id('ana_bank'), test.id('ana_exp_cat'), 'weekly', 2, '2026-03-02') returning id into r2;
  perform public.materialize_recurring('2026-03-31');
  perform test.ok((select count(*) from public.transactions where recurring_rule_id = r2) = 3,
                  'Cada 2 semanas en marzo genera 3 (2, 16 y 30)');

  insert into public.recurring_rules (type, amount, account_id, category_id, frequency, start_date)
  values ('expense', 90000, test.id('ana_bank'), test.id('ana_exp_cat'), 'yearly', '2024-02-29') returning id into r3;
  perform public.materialize_recurring('2026-03-01');
  perform test.ok(array(select date from public.transactions where recurring_rule_id = r3 order by date)
                  = array['2024-02-29','2025-02-28','2026-02-28']::date[], 'Anual desde 29-feb-2024');

  insert into public.recurring_rules (type, amount, account_id, category_id, frequency, start_date, end_date)
  values ('income', 20000, test.id('ana_bank'), test.id('ana_inc_cat'), 'monthly', '2026-01-10', '2026-03-10')
  returning id into r4;
  perform public.materialize_recurring('2026-06-01');
  perform test.ok((select count(*) from public.transactions where recurring_rule_id = r4) = 3,
                  'Con fecha de término genera solo hasta esa fecha (3)');
  perform test.ok((select not active from public.recurring_rules where id = r4), 'Al terminar, la regla queda inactiva');

  insert into public.recurring_rules (type, amount, account_id, to_account_id, frequency, start_date)
  values ('transfer', 50000, test.id('ana_bank'), test.id('ana_loan'), 'monthly', '2026-01-10') returning id into r5;
  perform public.materialize_recurring('2026-02-15');
  perform test.ok((select count(*) from public.transactions where recurring_rule_id = r5 and type = 'transfer'
                   and to_account_id = test.id('ana_loan')) = 2, 'Una transferencia recurrente (pago de préstamo)');

  update public.recurring_rules set active = false where id = r1;
  perform public.materialize_recurring('2026-12-31');
  perform test.ok((select count(*) from public.transactions where recurring_rule_id = r1) = 5,
                  'Una regla pausada no genera más (se mantiene en 5)');

  perform test.fails(format($q$insert into public.recurring_rules (type, amount, account_id, category_id, frequency, start_date)
                               values ('expense', 1, %L, %L, 'monthly', '2026-01-01')$q$, test.id('ana_bank'), test.id('ana_inc_cat')),
                     'Categoría de ingreso en una regla de gasto se rechaza');
  perform test.fails(format($q$insert into public.recurring_rules (type, amount, account_id, category_id, frequency, start_date)
                               values ('expense', 1, %L, %L, 'monthly', '2026-01-01')$q$, test.id('bruno_bank'), test.id('ana_exp_cat')),
                     'Regla sobre la cuenta de Bruno se rechaza');
  perform test.fails(format($q$insert into public.recurring_rules (type, amount, account_id, to_account_id, frequency, start_date)
                               values ('transfer', 1, %L, %L, 'monthly', '2026-01-01')$q$, test.id('ana_bank'), test.id('bruno_bank')),
                     'Transferencia recurrente hacia la cuenta de Bruno se rechaza');
  perform test.fails(format($q$insert into public.recurring_rules (type, amount, account_id, category_id, frequency, start_date, end_date)
                               values ('expense', 1, %L, %L, 'monthly', '2026-05-01', '2026-01-01')$q$, test.id('ana_bank'), test.id('ana_exp_cat')),
                     'Fecha de término anterior al inicio se rechaza');
end $$;

\echo '== 4b. Recurrentes: Bruno no ve ni genera las de Ana'
reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
declare n int;
begin
  perform test.ok((select count(*) from public.recurring_rules) = 0, 'Bruno ve 0 reglas');
  perform test.ok(public.materialize_recurring('2030-01-01') = 0, 'materialize_recurring de Bruno no crea nada');
  update public.recurring_rules set amount = 1 where id = test.id('ana_rule');
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'UPDATE de regla ajena afecta 0 filas');
end $$;
reset role;
do $$
begin
  perform test.ok((select count(*) from public.transactions t join public.recurring_rules r on r.id = t.recurring_rule_id
                   where r.user_id <> t.user_id) = 0, 'Ningún movimiento recurrente quedó en otro usuario');
  perform test.ok((select count(*) from public.transactions where recurring_rule_id = test.id('ana_rule')) = 5,
                  'Las reglas de Ana no se generaron por la llamada de Bruno');
end $$;

-- ---------------------------------------------------------------------
\echo '== 5. Compras en cuotas (como Ana)'
select test.login(test.id('ana')) is null as _ \gset
set role authenticated;
do $$
declare p1 uuid; p2 uuid;
begin
  perform test.fails(format($q$select public.create_installment_plan('TV', %L, null, 100000, 3, '2026-01-31')$q$, test.id('ana_bank')),
                     'Cuotas en una cuenta que no es tarjeta se rechazan');
  perform test.fails(format($q$select public.create_installment_plan('TV', %L, null, 100000, 3, '2026-01-31')$q$, test.id('bruno_bank')),
                     'Cuotas en una cuenta de Bruno se rechazan');
  perform test.fails(format($q$select public.create_installment_plan('TV', %L, null, 100000, 1, '2026-01-31')$q$, test.id('ana_card')),
                     '1 cuota se rechaza (mínimo 2)');
  perform test.fails(format($q$select public.create_installment_plan('TV', %L, null, 2, 3, '2026-01-31')$q$, test.id('ana_card')),
                     'Monto menor que el número de cuotas se rechaza');
  perform test.fails(format($q$select public.create_installment_plan('TV', %L, %L, 100000, 3, '2026-01-31')$q$, test.id('ana_card'), test.id('ana_inc_cat')),
                     'Categoría de ingreso se rechaza');

  p1 := public.create_installment_plan('TV', test.id('ana_card'), test.id('ana_exp_cat'), 100000, 3, '2026-01-31');
  perform set_config('test.ana_plan', p1::text, false);
  perform test.ok(array(select amount from public.transactions where installment_plan_id = p1 order by installment_no)
                  = array[33333, 33333, 33334]::bigint[], '100.000 en 3 cuotas: 33.333 + 33.333 + 33.334');
  perform test.ok(array(select date from public.transactions where installment_plan_id = p1 order by installment_no)
                  = array['2026-01-31','2026-02-28','2026-03-31']::date[], 'Una cuota por mes desde la primera fecha');
  perform test.ok((select note from public.transactions where installment_plan_id = p1 and installment_no = 2) = 'TV (cuota 2/3)',
                  'Cada cuota lleva su número en la nota');
  perform test.ok((select bool_and(type = 'expense' and category_id = test.id('ana_exp_cat'))
                   from public.transactions where installment_plan_id = p1), 'Las cuotas son gastos con la categoría elegida');
  perform test.ok((select balance from public.account_balances where account_id = test.id('ana_card')) = -100000,
                  'El cupo usado de la tarjeta refleja el total (-100.000)');

  p2 := public.create_installment_plan('Celular', test.id('ana_card'), null, null, 3, '2026-02-05', 40000);
  perform test.ok((select total_amount from public.installment_plans where id = p2) = 120000,
                  'Con interés: 3 cuotas de 40.000 = 120.000');

  perform test.fails(format($q$update public.installment_plans set total_amount = 1 where id = %L$q$, p1),
                     'No se puede cambiar el monto de una compra ya creada');
  update public.installment_plans set description = 'Televisor' where id = p1;
  perform test.ok((select note from public.transactions where installment_plan_id = p1 and installment_no = 3) = 'Televisor (cuota 3/3)',
                  'Cambiar la descripción actualiza todas las cuotas');

  delete from public.installment_plans where id = p2;
  perform test.ok((select count(*) from public.transactions where installment_plan_id = p2) = 0,
                  'Eliminar la compra elimina sus cuotas');
end $$;

-- ---------------------------------------------------------------------
\echo '== 6. Importación de cartolas (como Ana)'
do $$
declare r record; c0 int;
begin
  select * into r from public.import_transactions(test.id('ana_bank'), 'cartola.csv',
    '[{"type":"expense","amount":12500,"date":"2026-02-01","note":"JUMBO","import_hash":"h1"},
      {"type":"expense","amount":3000,"date":"2026-02-02","note":"METRO","import_hash":"h2"},
      {"type":"income","amount":800000,"date":"2026-02-03","note":"SUELDO","import_hash":"h3"}]');
  perform set_config('test.ana_batch', r.batch_id::text, false);
  perform test.ok(r.inserted = 3 and r.skipped = 0 and r.batch_id is not null, 'Primera importación: 3 nuevas');

  select * into r from public.import_transactions(test.id('ana_bank'), 'cartola.csv',
    '[{"type":"expense","amount":12500,"date":"2026-02-01","note":"JUMBO","import_hash":"h1"},
      {"type":"expense","amount":3000,"date":"2026-02-02","note":"METRO","import_hash":"h2"},
      {"type":"income","amount":800000,"date":"2026-02-03","note":"SUELDO","import_hash":"h3"}]');
  perform test.ok(r.inserted = 0 and r.skipped = 3 and r.batch_id is null,
                  'Reimportar el mismo archivo: 0 nuevas, 3 duplicadas omitidas, sin lote vacío');

  select * into r from public.import_transactions(test.id('ana_bank'), 'cartola2.csv',
    '[{"type":"expense","amount":3000,"date":"2026-02-02","note":"METRO","import_hash":"h2"},
      {"type":"expense","amount":7000,"date":"2026-02-04","note":"FARMACIA","import_hash":"h4"}]');
  perform test.ok(r.inserted = 1 and r.skipped = 1, 'Archivo con 1 nueva y 1 repetida: importa solo la nueva');

  c0 := (select count(*) from public.transactions);
  perform test.fails(format($q$select * from public.import_transactions(%L, 'x.csv',
                       '[{"type":"expense","amount":1,"date":"2026-02-01","import_hash":"z1"},
                         {"type":"transfer","amount":1,"date":"2026-02-01","import_hash":"z2"}]')$q$, test.id('ana_bank')),
                     'Una fila inválida cancela toda la importación');
  perform test.ok((select count(*) from public.transactions) = c0, 'La importación fallida no dejó filas a medias');
  perform test.fails(format($q$select * from public.import_transactions(%L, 'x.csv', '[]')$q$, test.id('ana_bank')),
                     'Importación vacía se rechaza');
  perform test.fails(format($q$select * from public.import_transactions(%L, 'x.csv',
                       '[{"type":"expense","amount":1,"date":"2026-02-01","import_hash":"z3"}]')$q$, test.id('bruno_bank')),
                     'Importar en la cuenta de Bruno se rechaza');

  delete from public.import_batches where id = test.id('ana_batch');
  perform test.ok((select count(*) from public.transactions where import_hash in ('h1','h2','h3')) = 0,
                  'Deshacer la importación borra sus movimientos');
end $$;

\echo '== 6b. Cuotas e importaciones: aislamiento con Bruno'
reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
declare r record; n int;
begin
  perform test.ok((select count(*) from public.installment_plans) = 0, 'Bruno ve 0 compras en cuotas');
  perform test.ok((select count(*) from public.import_batches) = 0, 'Bruno ve 0 importaciones');
  perform test.fails(format($q$select public.create_installment_plan('x', %L, null, 1000, 2, '2026-01-01')$q$, test.id('ana_card')),
                     'Bruno no puede crear cuotas en la tarjeta de Ana');
  perform test.fails(format($q$select * from public.import_transactions(%L, 'x.csv',
                       '[{"type":"expense","amount":1,"date":"2026-02-01","import_hash":"b1"}]')$q$, test.id('ana_bank')),
                     'Bruno no puede importar en la cuenta de Ana');
  select * into r from public.import_transactions(test.id('bruno_bank'), 'b.csv',
    '[{"type":"expense","amount":7000,"date":"2026-02-04","note":"FARMACIA","import_hash":"h4"}]');
  perform test.ok(r.inserted = 1, 'La misma huella en otro usuario no se considera duplicada');
  update public.installment_plans set description = 'HACK' where id = test.id('ana_plan');
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'UPDATE de compra ajena afecta 0 filas');
  delete from public.installment_plans where id = test.id('ana_plan');
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'DELETE de compra ajena afecta 0 filas');
  delete from public.import_batches;
  get diagnostics n = row_count;
  perform test.ok(n = 1, 'DELETE masivo de importaciones solo borra la propia (1)');
  -- Se vuelve a importar para que las pruebas siguientes partan del mismo estado.
  select * into r from public.import_transactions(test.id('bruno_bank'), 'b.csv',
    '[{"type":"expense","amount":7000,"date":"2026-02-04","note":"FARMACIA","import_hash":"h4"}]');
  perform test.ok(r.inserted = 1, 'Tras deshacer, la misma cartola se puede volver a importar');
end $$;
reset role;
do $$
begin
  perform test.ok((select description from public.installment_plans where id = test.id('ana_plan')) = 'Televisor',
                  'La compra de Ana quedó intacta');
end $$;

-- ---------------------------------------------------------------------
\echo '== 7. Patrimonio neto (como Ana)'
select test.login(test.id('ana')) is null as _ \gset
set role authenticated;
do $$
declare last record; v_sum bigint;
begin
  perform test.ok((select count(*) from public.net_worth_by_month('2026-01-01', '2026-12-01')) = 12,
                  'Devuelve un valor por mes (12)');
  select * into last from public.net_worth_by_month('2026-01-01', '2026-12-01') order by month desc limit 1;
  v_sum := (select sum(balance) from public.account_balances);
  perform test.ok(last.assets - last.liabilities = v_sum,
                  format('Patrimonio a fin de año = suma de saldos (%s)', v_sum));
  perform test.ok(last.liabilities > 0, 'Las deudas (tarjeta + préstamo) se informan en positivo');
end $$;

reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
begin
  perform test.ok((select assets from public.net_worth_by_month('2026-12-01', '2026-12-01')) = 50000 - 7000,
                  'El patrimonio de Bruno solo incluye sus cuentas (43.000)');
end $$;

-- ---------------------------------------------------------------------
\echo '== 8. Sin sesión (anon)'
reset role; select test.login(null) is null as _ \gset
set role anon;
do $$
begin
  perform test.fails('select * from public.goals', 'anon no lee goals');
  perform test.fails('select * from public.goal_contributions', 'anon no lee goal_contributions');
  perform test.fails('select * from public.goal_progress', 'anon no lee goal_progress');
  perform test.fails('select * from public.recurring_rules', 'anon no lee recurring_rules');
  perform test.fails('select * from public.installment_plans', 'anon no lee installment_plans');
  perform test.fails('select * from public.import_batches', 'anon no lee import_batches');
  perform test.fails('select public.materialize_recurring(null)', 'anon no ejecuta materialize_recurring');
  perform test.fails($q$select public.create_installment_plan('x', null, null, 1, 2, '2026-01-01')$q$, 'anon no ejecuta create_installment_plan');
  perform test.fails($q$select * from public.import_transactions(null, 'x', '[]')$q$, 'anon no ejecuta import_transactions');
  perform test.fails($q$select * from public.net_worth_by_month('2026-01-01', '2026-02-01')$q$, 'anon no ejecuta net_worth_by_month');
  perform test.ok(public.keepalive() = 'ok', 'anon sigue pudiendo llamar a keepalive');
end $$;

-- ---------------------------------------------------------------------
\echo '== 9. Eliminar mi cuenta con datos de la Etapa 2 (como Ana)'
reset role; select test.login(test.id('ana')) is null as _ \gset
set role authenticated;
select public.delete_my_account() is null as _ \gset
reset role;
do $$
declare t text; n int;
begin
  foreach t in array array['accounts','categories','transactions','budgets','goals','goal_contributions',
                           'recurring_rules','installment_plans','import_batches','profiles'] loop
    execute format('select count(*) from public.%I where user_id = %L', t, test.id('ana')) into n;
    perform test.ok(n = 0, format('No quedan filas de Ana en %s', t));
  end loop;
  perform test.ok((select count(*) from public.transactions where user_id = test.id('bruno')) = 1,
                  'Los datos de Bruno siguen intactos');
end $$;

\echo ''
\echo '✅ Todas las pruebas SQL de la Etapa 2 pasaron'
