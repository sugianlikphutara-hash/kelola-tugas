insert into public.fin_rak_budget_items (
  id,
  rak_version_id,
  rak_sub_activity_id,
  budget_account_id,
  item_change_status_id,
  annual_amount,
  jan_amount,
  feb_amount,
  mar_amount,
  apr_amount,
  may_amount,
  jun_amount,
  jul_amount,
  aug_amount,
  sep_amount,
  oct_amount,
  nov_amount,
  dec_amount
)
values (
  '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  12000000,
  1000000, 1000000, 1000000, 1000000,
  1000000, 1000000, 1000000, 1000000,
  1000000, 1000000, 1000000, 1000000
)
on conflict (id) do nothing;