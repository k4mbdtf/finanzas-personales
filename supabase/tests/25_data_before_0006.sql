-- Datos "de producción" creados con el esquema 0001–0005, cuando las deudas
-- aparecían como cuentas en todos los formularios. Sirven para comprobar que
-- la migración 0006 se aplica sobre ellos sin romperlos. Usuaria: Carla.
insert into auth.users (email) values ('carla@test');

insert into public.accounts (user_id, name, type, initial_balance)
select id, 'Cuenta Carla', 'bank', 500000 from auth.users where email = 'carla@test';

insert into public.accounts (user_id, name, type, initial_balance, loan_amount, loan_installment,
                             loan_installments_count, payment_day, counterparty)
select id, 'Crédito Carla', 'loan', -600000, 1000000, 50000, 24, 5, 'Banco Y'
from auth.users where email = 'carla@test';

insert into public.accounts (user_id, name, type, initial_balance, counterparty)
select id, 'Diego me debe', 'receivable', 40000, 'Diego' from auth.users where email = 'carla@test';

-- Pago del crédito con "Registrar pago" (transferencia banco -> deuda).
insert into public.transactions (user_id, type, amount, date, account_id, to_account_id)
select u.id, 'transfer', 50000, '2026-03-05', b.id, l.id
from auth.users u
join public.accounts b on b.user_id = u.id and b.name = 'Cuenta Carla'
join public.accounts l on l.user_id = u.id and l.name = 'Crédito Carla'
where u.email = 'carla@test';

-- Un gasto anotado por error EN la deuda (la 0005 lo permitía).
insert into public.transactions (user_id, type, amount, date, account_id, category_id)
select u.id, 'expense', 7000, '2026-03-06', l.id, c.id
from auth.users u
join public.accounts l on l.user_id = u.id and l.name = 'Crédito Carla'
join public.categories c on c.user_id = u.id and c.name = 'Otros gastos'
where u.email = 'carla@test';

-- Una regla recurrente antigua que anota un gasto en la deuda.
insert into public.recurring_rules (user_id, type, amount, account_id, category_id, note, frequency, start_date)
select u.id, 'expense', 1000, l.id, c.id, 'Seguro del crédito', 'monthly', '2026-01-01'
from auth.users u
join public.accounts l on l.user_id = u.id and l.name = 'Crédito Carla'
join public.categories c on c.user_id = u.id and c.name = 'Otros gastos'
where u.email = 'carla@test';
