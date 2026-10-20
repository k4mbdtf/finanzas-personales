-- =====================================================================
-- 0008_dividir.sql — Dividir un movimiento en varias categorías
-- Ejecutar DESPUÉS de 0007_reglas.sql. Solo agrega una columna y una función.
--
-- Un gasto (o ingreso) dividido son varias transacciones normales —una por
-- categoría— con la misma fecha, cuenta, nota y etiquetas, unidas por
-- split_group. Así los saldos, presupuestos, reportes y exportaciones funcionan
-- sin cambios: cada parte cuenta en su categoría.
--
-- save_split() guarda el grupo completo de forma atómica. Si se divide un
-- movimiento existente (el "ancla"), ese mismo registro pasa a ser la primera
-- parte: conserva su id, su lote de importación y su regla recurrente, así una
-- cartola importada de nuevo no lo duplica.
-- =====================================================================

alter table public.transactions add column split_group uuid;
create index transactions_split_group_idx on public.transactions (user_id, split_group)
  where split_group is not null;

-- p_anchor: movimiento que se divide (o cualquier parte del grupo que se edita); null = nuevo.
-- p_parts:  [{ "category_id": uuid, "amount": int }, ...] (1 a 20). Con una sola parte el
--           movimiento deja de estar dividido.
-- Devuelve el split_group (null si quedó sin dividir).
create or replace function public.save_split(
  p_anchor uuid, p_type text, p_date date, p_account_id uuid, p_note text, p_tags text[], p_parts jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_count  integer;
  v_group  uuid;
  v_anchor public.transactions;
  v_first  record;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if p_type not in ('income', 'expense') then
    raise exception 'Solo se pueden dividir gastos o ingresos' using errcode = '22023';
  end if;
  if p_parts is null or jsonb_typeof(p_parts) <> 'array' then
    raise exception 'Formato de partes inválido' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_parts);
  if v_count < 1 or v_count > 20 then
    raise exception 'Se puede dividir en 1 a 20 partes' using errcode = '22023';
  end if;

  select r.category_id, r.amount into v_first
  from rows from (jsonb_to_recordset(p_parts) as (category_id uuid, amount bigint)) with ordinality as r(category_id, amount, n)
  where r.n = 1;

  if p_anchor is not null then
    -- RLS: solo se encuentra si es del usuario.
    select * into v_anchor from public.transactions where id = p_anchor;
    if not found then
      raise exception 'Movimiento no encontrado' using errcode = '23503';
    end if;
    if v_anchor.installment_plan_id is not null then
      raise exception 'Las cuotas de una compra en cuotas no se pueden dividir' using errcode = '22023';
    end if;
    v_group := coalesce(v_anchor.split_group, gen_random_uuid());
    -- Las demás partes del grupo se reemplazan por las nuevas.
    delete from public.transactions where split_group = v_group and id <> p_anchor;
    update public.transactions
       set type = p_type, date = p_date, account_id = p_account_id, to_account_id = null,
           category_id = v_first.category_id, amount = v_first.amount,
           note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), tags = coalesce(p_tags, '{}'),
           split_group = case when v_count > 1 then v_group end
     where id = p_anchor;
  else
    v_group := gen_random_uuid();
    insert into public.transactions (type, amount, date, account_id, category_id, note, tags, split_group)
    values (p_type, v_first.amount, p_date, p_account_id, v_first.category_id,
            nullif(left(btrim(coalesce(p_note, '')), 500), ''), coalesce(p_tags, '{}'),
            case when v_count > 1 then v_group end);
  end if;

  if v_count > 1 then
    insert into public.transactions (type, amount, date, account_id, category_id, note, tags, split_group)
    select p_type, r.amount, p_date, p_account_id, r.category_id,
           nullif(left(btrim(coalesce(p_note, '')), 500), ''), coalesce(p_tags, '{}'), v_group
    from rows from (jsonb_to_recordset(p_parts) as (category_id uuid, amount bigint)) with ordinality as r(category_id, amount, n)
    where r.n > 1;
    return v_group;
  end if;
  return null;
end;
$$;

revoke all on function public.save_split(uuid, text, date, uuid, text, text[], jsonb) from public, anon;
grant execute on function public.save_split(uuid, text, date, uuid, text, text[], jsonb) to authenticated;
