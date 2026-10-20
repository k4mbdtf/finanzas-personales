-- =====================================================================
-- Pruebas de la migración 0007 (reglas de categorización).
-- Cada bloque corre con el rol y "JWT" del usuario, como en las anteriores.
-- =====================================================================

-- Usuaria nueva (Ana ya eliminó su cuenta en 20_etapa2.sql): el registro le crea sus categorías.
insert into auth.users (email) values ('dani@test');

do $$
begin
  perform set_config('test.dani',   (select id::text from auth.users where email = 'dani@test'), false);
  perform set_config('test.bruno', (select id::text from auth.users where email = 'bruno@test'), false);
  perform set_config('test.a_cat', (select c.id::text from public.categories c
                                    where c.user_id = test.id('dani') and c.kind = 'expense' order by c.name limit 1), false);
  perform set_config('test.b_cat', (select c.id::text from public.categories c
                                    where c.user_id = test.id('bruno') and c.kind = 'expense' order by c.name limit 1), false);
end $$;

-- ---------------------------------------------------------------------
\echo '== 1. Crear, editar y validar reglas (como Dani)'
select test.login(test.id('dani')) is null as _ \gset
set role authenticated;
do $$
declare r uuid;
begin
  insert into public.category_rules (pattern, category_id) values ('UBER', test.id('a_cat')) returning id into r;
  perform test.ok((select user_id = test.id('dani') from public.category_rules where id = r), 'La regla queda a nombre de Dani');
  perform test.fails(format($q$insert into public.category_rules (pattern, category_id) values ('uber', %L)$q$, test.id('a_cat')),
                     'No se repite el mismo texto (sin importar mayúsculas)');
  perform test.fails(format($q$insert into public.category_rules (pattern, category_id) values ('a', %L)$q$, test.id('a_cat')),
                     'Texto de al menos 2 caracteres');
  perform test.fails(format($q$insert into public.category_rules (pattern, category_id) values (' jumbo', %L)$q$, test.id('a_cat')),
                     'Sin espacios al inicio o al final');
  update public.category_rules set pattern = 'Uber Eats' where id = r;
  perform test.ok((select pattern = 'Uber Eats' from public.category_rules where id = r), 'Se puede editar');
end $$;

-- ---------------------------------------------------------------------
\echo '== 2. Aislamiento entre usuarios'
do $$
begin
  perform test.fails(format($q$insert into public.category_rules (pattern, category_id) values ('lider', %L)$q$, test.id('b_cat')),
                     'Dani no puede usar una categoría de Bruno (FK compuesta)');
  perform test.fails(format($q$insert into public.category_rules (user_id, pattern, category_id) values (%L, 'lider', %L)$q$,
                            test.id('bruno'), test.id('b_cat')),
                     'Dani no puede crear reglas a nombre de Bruno (RLS)');
end $$;

reset role; select test.login(test.id('bruno')) is null as _ \gset
set role authenticated;
do $$
declare n int;
begin
  perform test.ok((select count(*) from public.category_rules) = 0, 'Bruno no ve las reglas de Dani');
  update public.category_rules set pattern = 'hackeado';
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'Bruno no puede editar reglas de Dani');
  delete from public.category_rules;
  get diagnostics n = row_count;
  perform test.ok(n = 0, 'Bruno no puede borrar reglas de Dani');
  insert into public.category_rules (pattern, category_id) values ('uber eats', test.id('b_cat'));
  perform test.ok((select count(*) from public.category_rules) = 1, 'Bruno puede usar el mismo texto en sus propias reglas');
end $$;

-- ---------------------------------------------------------------------
\echo '== 3. Al eliminar la categoría, sus reglas se eliminan'
reset role; select test.login(test.id('dani')) is null as _ \gset
set role authenticated;
do $$
begin
  delete from public.categories where id = test.id('a_cat');
  perform test.ok((select count(*) from public.category_rules) = 0, 'La regla de Dani se fue con su categoría');
end $$;

-- ---------------------------------------------------------------------
\echo '== 4. Sin sesión (anon)'
reset role; select test.login(null) is null as _ \gset
set role anon;
do $$
begin
  perform test.fails('select * from public.category_rules', 'anon no lee category_rules');
end $$;

reset role;
\echo ''
\echo '✅ Todas las pruebas SQL de 0007 pasaron'
