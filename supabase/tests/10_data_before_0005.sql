-- Datos "de producción" creados con el esquema 0001–0004, para comprobar
-- que la migración 0005 se aplica sobre datos existentes sin romperlos.
insert into auth.users (email) values ('ana@test'), ('bruno@test');

insert into public.accounts (user_id, name, type, initial_balance)
select id, 'RUT', 'bank', 100000 from auth.users where email = 'ana@test';

insert into public.accounts (user_id, name, type, initial_balance, credit_limit, closing_day, payment_day)
select id, 'Visa', 'credit_card', 0, 500000, 20, 5 from auth.users where email = 'ana@test';

insert into public.accounts (user_id, name, type, initial_balance)
select id, 'Cuenta Bruno', 'bank', 50000 from auth.users where email = 'bruno@test';

insert into public.transactions (user_id, type, amount, date, account_id, category_id)
select u.id, 'expense', 10000, '2026-01-15', a.id, c.id
from auth.users u
join public.accounts a on a.user_id = u.id and a.name = 'RUT'
join public.categories c on c.user_id = u.id and c.name = 'Alimentación'
where u.email = 'ana@test';

insert into public.budgets (user_id, category_id, month, amount)
select u.id, c.id, '2026-01-01', 200000
from auth.users u join public.categories c on c.user_id = u.id and c.name = 'Alimentación'
where u.email = 'ana@test';
