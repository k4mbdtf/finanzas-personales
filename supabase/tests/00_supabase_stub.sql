-- =====================================================================
-- Imitación mínima de Supabase para probar las migraciones en un
-- PostgreSQL local (scripts/test-sql.sh). NO se ejecuta en Supabase.
--   * roles anon / authenticated / service_role
--   * auth.users y auth.uid() (lee el "sub" del JWT simulado)
--   * privilegios por defecto como en Supabase (todo para anon/authenticated
--     en tablas y funciones nuevas: por eso las migraciones deben revocar)
--   * helpers de prueba en el esquema "test"
-- =====================================================================
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Helpers de prueba
-- ---------------------------------------------------------------------
create schema test;
grant usage on schema test to anon, authenticated;

-- Simula el JWT de un usuario (o ninguno con null).
create function test.login(p_uid uuid) returns void
language sql
as $$
  select set_config('request.jwt.claims',
                    case when p_uid is null then '' else json_build_object('sub', p_uid)::text end,
                    false);
$$;

-- Lee un id guardado con set_config('test.<nombre>', ...).
create function test.id(p_name text) returns uuid
language sql stable
as $$ select current_setting('test.' || p_name)::uuid $$;

create function test.ok(p_cond boolean, p_name text) returns void
language plpgsql
as $$
begin
  if p_cond is distinct from true then
    raise exception 'FALLÓ: %', p_name;
  end if;
  raise notice '  ✔ %', p_name;
end;
$$;

-- La sentencia DEBE fallar (se ejecuta con el rol actual).
create function test.fails(p_sql text, p_name text) returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice '  ✔ % — %', p_name, sqlerrm;
    return;
  end;
  raise exception 'FALLÓ (no dio error): %', p_name;
end;
$$;

grant execute on all functions in schema test to anon, authenticated;
