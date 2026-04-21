-- Backfill relasi hirarki akun belanja berdasarkan pola code.
-- Migration ini hanya melengkapi parent_id pada fin_budget_accounts
-- agar struktur level 1-5 benar-benar membentuk pohon parent-child.

begin;

with account_parent_map as (
  select
    child.id as child_id,
    parent.id as parent_id
  from public.fin_budget_accounts child
  join public.fin_budget_accounts parent
    on parent.code = regexp_replace(child.code, '\.[^\.]+$', '')
  where child.code like '%.%'
)
update public.fin_budget_accounts child
set parent_id = map.parent_id,
    updated_at = now()
from account_parent_map map
where child.id = map.child_id
  and child.parent_id is distinct from map.parent_id;

commit;
