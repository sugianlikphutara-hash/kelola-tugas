-- Tambah realisasi di bulan yang sama (JAN) hingga melebihi plan 1.000.000
insert into public.fin_budget_realizations (
  id,
  fiscal_year_id,
  sub_activity_id,
  budget_account_id,
  rak_version_id_snapshot,
  realization_status_id,
  realization_date,
  period_month,
  amount
)
values (
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  date '2026-01-20',
  1,
  700000
)
on conflict (id) do nothing;

-- Verifikasi (JAN harus overspend)
select
  jan_plan,
  jan_realization,
  jan_balance,
  annual_plan,
  annual_realization,
  annual_balance,
  balance_status
from public.fin_v_budget_balance_summary;

-- Cek warning
select * from public.fin_v_tracking_budget_warnings;