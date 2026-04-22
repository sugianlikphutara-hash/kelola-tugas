begin;

-- =========================
-- DUMMY IDs (hardcoded)
-- =========================
-- Fiscal Year
-- 11111111-1111-1111-1111-111111111111
-- Sub Activity
-- 22222222-2222-2222-2222-222222222222
-- Budget Level 5
-- 33333333-3333-3333-3333-333333333333
-- Budget Account
-- 44444444-4444-4444-4444-444444444444
-- RAK Version
-- 55555555-5555-5555-5555-555555555555
-- RAK Sub Activity
-- 66666666-6666-6666-6666-666666666666
-- RAK Budget Item
-- 77777777-7777-7777-7777-777777777777
-- Realization
-- 88888888-8888-8888-8888-888888888888

-- =========================
-- 1) CORE APP MINIMAL
-- =========================

insert into public.fiscal_years (id, year, is_active)
values ('11111111-1111-1111-1111-111111111111', 2026, true)
on conflict (id) do nothing;

insert into public.sub_activities (id, code, name)
values ('22222222-2222-2222-2222-222222222222', 'SA-001', 'Sub Kegiatan Dummy')
on conflict (id) do nothing;

-- =========================
-- 2) BUDGET MASTER
-- =========================

insert into public.fin_budget_levels (id, level_number, name)
values ('33333333-3333-3333-3333-333333333333', 5, 'Level 5')
on conflict (id) do nothing;

insert into public.fin_budget_accounts (
  id,
  code,
  name,
  budget_level_id,
  is_active,
  is_leaf
)
values (
  '44444444-4444-4444-4444-444444444444',
  '5.1.02.01',
  'Belanja Barang Dummy',
  '33333333-3333-3333-3333-333333333333',
  true,
  true
)
on conflict (id) do nothing;

-- =========================
-- 3) RAK VERSION
-- =========================

insert into public.fin_rak_versions (
  id,
  fiscal_year_id,
  code,
  version_number,
  title,
  rak_date,
  status,
  is_active
)
values (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  'RAK-2026-V1',
  1,
  'RAK Dummy',
  current_date,
  'DRAFT',
  false
)
on conflict (id) do nothing;

-- =========================
-- 4) RAK SUB ACTIVITY
-- =========================

insert into public.fin_rak_sub_activities (
  id,
  rak_version_id,
  sub_activity_id
)
values (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222'
)
on conflict (id) do nothing;

-- =========================
-- 5) RAK BUDGET ITEM
-- =========================

insert into public.fin_rak_budget_items (
  id,
  rak_sub_activity_id,
  budget_account_id,
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
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  12000000,
  1000000, 1000000, 1000000, 1000000,
  1000000, 1000000, 1000000, 1000000,
  1000000, 1000000, 1000000, 1000000
)
on conflict (id) do nothing;

-- =========================
-- 6) ACTIVATE RAK
-- =========================

select public.fin_activate_rak_version('55555555-5555-5555-5555-555555555555');

-- =========================
-- 7) OPTIONAL REALIZATION
-- =========================
-- Catatan:
-- bagian ini bisa gagal jika tabel Anda mewajibkan kolom status / snapshot tertentu.
-- Kalau gagal, comment dulu bagian insert ini dan jalankan sisanya.

insert into public.fin_budget_realizations (
  id,
  fiscal_year_id,
  sub_activity_id,
  budget_account_id,
  rak_version_id_snapshot,
  realization_date,
  period_month,
  amount
)
values (
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  date '2026-01-15',
  1,
  500000
)
on conflict (id) do nothing;

commit;

-- =========================
-- 8) VERIFY
-- =========================

select * from public.fin_v_budget_balance_summary;