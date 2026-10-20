-- =====================================================================
-- Pruebas de la migración 0008 (dividir un movimiento en varias categorías).
-- Usa a Dani (creada en 40_reglas.sql) y a Bruno.
-- =====================================================================

-- Datos de Dani: una cuenta y un gasto importado de una cartola.
insert into public.accounts (user_id, name, type, initial_balance)
select id, 'Cuenta Dani', 'bank', 300000 from auth.users where email = 'dani@test';
insert into public.transactions (user_id, type, amount, date, account_id, note, import_hash)
select u.id, 'expense', 60000, '2026-10-05', a.id, 'LIDER EXPRESS', 'hash-lider'
from auth.users u join public.accounts a on a.user_id = u.id where u.email = 'dani@test';

do $$
declare
  v_dani uuid := (select id from auth.users where email = 'dani@test');
  v_bruno uuid := (select id from auth.users where email = 'bruno@test');
  cat text;
begin
  perform set_config('test.dani', v_dani::text, false);
  perform set_config('test.bruno', v_bruno::text, false);
  perform set_config('test.d_acc', (select id::text from public.accounts where user_id = v_dani), false);
  perform set_config('test.d_imported', (select id::text from public.transactions where import_hash = 'hash-lider'), false);
  -- Tres categorías de gasto y una de ingreso de Dani (las por defecto; Alimentación la borró
  -- en 40_reglas.sql); una de gasto de Bruno.
  foreach cat in array array['Transporte', 'Salud', 'Vivienda'] loop
    perform set_config('test.d_' || lower(cat), (select id::text from public.categories
      where user_id = v_dani and kind = 'expense' and name = cat), false);
  end loop;
  perform set_config('test.d_income', (select id::text from public.categories where user_id = v_dani and kind = 'income' limit 1), false);
  perform set_config('test.b_cat', (select id::text from public.categories where user_id = v_bruno and kind = 'expense' limit 1), false);
end $$;

-- Helper: las partes como jsonb.
create function test.parts(variadic p text[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('category_id', split_part(x, ':', 1), 'amount', split_part(x, ':', 2)::bigint))
  from unnest(p) as x
$$;

-- ---------------------------------------------------------------------
\echo '== 1. Dividir un gasto nuevo en tres categorías (como Dani)'
select test.login(test.id('dani')) is null as _ \gset
set role authenticated;
do $$
declare g uuid;
begin
  perform test.ok(test.id('d_transporte') is not null and test.id('d_salud') is not null and test.id('d_vivienda') is not null,
                  'Dani tiene las categorías por defecto');
  g := public.save_split(null, 'expense', '2026-10-10', test.id('d_acc'), 'Compra en el súper', '{casa}',
                         test.parts(test.id('d_transporte') || ':30000', test.id('d_salud') || ':12000', test.id('d_vivienda') || ':8000'));
  perform set_config('test.g1', g::text, false);
  perform test.ok((select count(*) from public.transactions where split_group = g) = 3, 'Crea 3 movimientos unidos');
  perform test.ok((select bool_and(date = '2026-10-10' and account_id = test.id('d_acc') and note = 'Compra en el súper'
                                   and tags = '{casa}' and type = 'expense')
                   from public.transactions where split_group = g), 'Comparten fecha, cuenta, nota, etiquetas y tipo');
  perform test.ok((select sum(amount) from public.transactions where split_group = g) = 50000, 'Suman el total');
  perform test.ok((select total from public.spending_by_category('2026-10-01', '2026-10-31')
                   where category_id = test.id('d_salud')) = 12000, 'Cada parte cuenta en su categoría');
  perform test.ok((select balance from public.account_balances where account_id = test.id('d_acc')) = 300000 - 60000 - 50000,
                  'El saldo de la cuenta descuenta el total');
end $$;

-- ---------------------------------------------------------------------
\echo '== 2. Editar el grupo desde cualquier parte y deshacer la división'
do $$
declare g uuid := test.id('g1'); anchor uuid; g2 uuid;
begin
  select id into anchor from public.transactions where split_group = g and category_id = test.id('d_salud');
  g2 := public.save_split(anchor, 'expense', '2026-10-11', test.id('d_acc'), 'Súper', '{}',
                          test.parts(test.id('d_vivienda') || ':20000', test.id('d_transporte') || ':35000'));
  perform test.ok(g2 = g, 'Mantiene el mismo grupo');
  perform test.ok((select count(*) from public.transactions where split_group = g) = 2, 'Ahora son 2 partes');
  perform test.ok((select category_id = test.id('d_vivienda') and amount = 20000 and date = '2026-10-11'
                   from public.transactions where id = anchor), 'La parte editada conserva su id y toma la primera parte');
  g2 := public.save_split(anchor, 'expense', '2026-10-11', test.id('d_acc'), 'Súper', '{}', test.parts(test.id('d_vivienda') || ':55000'));
  perform test.ok(g2 is null, 'Con una sola parte deja de estar dividido');
  perform test.ok((select count(*) from public.transactions where split_group = g) = 0
                  and (select split_group is null and amount = 55000 from public.transactions where id = anchor),
                  'Queda un solo movimiento, sin grupo');
end $$;

-- ---------------------------------------------------------------------
\echo '== 3. Dividir un movimiento importado conserva su huella'
do $$
declare g uuid;
begin
  g := public.save_split(test.id('d_imported'), 'expense', '2026-10-05', test.id('d_acc'), 'LIDER EXPRESS', '{}',
                         test.parts(test.id('d_transporte') || ':45000', test.id('d_salud') || ':15000'));
  perform test.ok((select import_hash = 'hash-lider' and split_group = g from public.transactions where id = test.id('d_imported')),
                  'El original sigue con su import_hash (no se duplica al reimportar)');
  perform test.ok((select count(*) from public.transactions where split_group = g and import_hash is null) = 1,
                  'La parte nueva no copia la huella');
end $$;

-- ---------------------------------------------------------------------
\echo '== 4. Validaciones y atomicidad'
do $$
declare before_count int := (select count(*) from public.transactions);
begin
  perform test.fails(format($q$select public.save_split(null, 'transfer', '2026-10-10', %L, null, '{}', test.parts(%L))$q$,
                            test.id('d_acc'), test.id('d_vivienda') || ':1000'), 'Una transferencia no se divide');
  perform test.fails(format($q$select public.save_split(null, 'expense', '2026-10-10', %L, null, '{}', test.parts(%L))$q$,
                            test.id('d_acc'), test.id('d_income') || ':1000'), 'Una categoría de ingreso no sirve para un gasto');
  perform test.fails(format($q$select public.save_split(null, 'expense', '2026-10-10', %L, null, '{}', test.parts(%L))$q$,
                            test.id('d_acc'), test.id('d_vivienda') || ':0'), 'Montos mayores a 0');
  perform test.fails(format($q$select public.save_split(null, 'expense', '2026-10-10', %L, null, '{}', '[]')$q$,
                            test.id('d_acc')), 'Al menos una parte');
  perform test.fails(format($q$select public.save_split(%L, 'expense', '2026-10-05', %L, null, '{}', test.parts(%L, %L))$q$,
                            test.id('d_imported'), test.id('d_acc'), test.id('d_vivienda') || ':1000', test.id('b_cat') || ':1000'),
                     'Una parte con la categoría de Bruno se rechaza');
  perform test.ok((select count(*) from public.transactions) = before_count
                  and (select amount = 45000 from public.transactions where id = test.id('d_imported')),
                  'Si algo falla no cambia nada (atómico)');
end $$;

reset role;
insert into public.installment_plans (user_id, description, account_id, total_amount, installments_count, installment_amount, first_date)
select test.id('dani'), 'Notebook', test.id('d_acc'), 30000, 3, 10000, '2026-10-01';
insert into public.transactions (user_id, type, amount, date, account_id, installment_plan_id, installment_no)
select test.id('dani'), 'expense', 10000, '2026-10-01', test.id('d_acc'), id, 1 from public.installment_plans where description = 'Notebook';
select test.login(test.id('dani')) is null as _ \gset
set role authenticated;
do $$
begin
  perform test.fails(format($q$select public.save_split(%L, 'expense', '2026-10-01', %L, null, '{}', test.parts(%L, %L))$q$,
                            (select id from public.transactions where installment_no = 1 and user_id = test.id('dani')),
                            test.id('d_acc'), test.id('d_vivienda') || ':5000', test.id('d_salud') || ':5000'),
                     'Una cuota de una compra en cuotas no se divide');
end $$;

-- ---------------------------------------------------------------------
\echo '== 5. Aislamiento y anon'
reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
begin
  perform test.fails(format($q$select public.save_split(%L, 'expense', '2026-10-05', %L, null, '{}', test.parts(%L))$q$,
                            test.id('d_imported'), test.id('d_acc'), test.id('b_cat') || ':1000'),
                     'Bruno no puede dividir un movimiento de Dani');
end $$;
reset role;
do $$
begin
  perform test.ok((select count(*) from public.transactions where split_group is not null and user_id = test.id('dani')) = 2,
                  'El grupo de Dani sigue intacto');
end $$;
select test.login(null) is null as _ \gset
set role anon;
do $$
begin
  perform test.fails($q$select public.save_split(null, 'expense', '2026-10-10', null, null, '{}', '[]')$q$,
                     'anon no ejecuta save_split');
end $$;

reset role;
\echo ''
\echo '✅ Todas las pruebas SQL de 0008 pasaron'
