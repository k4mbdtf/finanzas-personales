-- =====================================================================
-- 0007_reglas.sql — Reglas de categorización
-- Ejecutar DESPUÉS de 0006_deudas_inversiones.sql. Solo agrega una tabla.
--
-- Una regla dice "si la descripción contiene <texto>, usa <categoría>". Se aplica
-- en el navegador al importar cartolas (antes que la sugerencia por movimientos
-- anteriores) y a pedido sobre los movimientos sin categoría. La comparación
-- ignora mayúsculas, tildes y signos (src/lib/rules.ts). La regla vale para gastos
-- o ingresos según el tipo de su categoría.
-- =====================================================================

create table public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  pattern     text not null check (pattern = btrim(pattern) and char_length(pattern) between 2 and 60),
  category_id uuid not null,
  created_at  timestamptz not null default now(),
  -- Al eliminar la categoría, sus reglas se van con ella.
  constraint category_rules_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade
);
-- Un mismo texto no puede llevar a dos categorías (sin importar mayúsculas).
create unique index category_rules_user_pattern_idx on public.category_rules (user_id, lower(pattern));

alter table public.category_rules enable row level security;

create policy "category_rules_select" on public.category_rules for select to authenticated
  using (user_id = (select auth.uid()));
create policy "category_rules_insert" on public.category_rules for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "category_rules_update" on public.category_rules for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "category_rules_delete" on public.category_rules for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.category_rules from anon, public;
grant select, insert, update, delete on public.category_rules to authenticated;
