insert into public.fin_budget_accounts (
  id,
  budget_level_id,
  code,
  name,
  is_leaf,
  is_active
)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  '5.1.02.01',
  'Belanja Barang Dummy',
  true,
  true
)
on conflict (id) do update
set
  budget_level_id = excluded.budget_level_id,
  is_leaf = true,
  is_active = true;