-- =====================================================================
-- 0004_keepalive.sql — Fase 5
-- Consulta liviana que usa el workflow .github/workflows/keepalive.yml
-- (cada 3 días) para evitar la pausa por inactividad del plan gratuito.
-- No lee ninguna tabla ni devuelve datos: solo 'ok'. Es la ÚNICA función
-- que puede llamar el rol anon.
-- =====================================================================
create or replace function public.keepalive()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select 'ok'::text;
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
