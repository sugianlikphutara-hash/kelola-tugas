-- Baseline schema modul anggaran.
-- Tujuan:
-- 1. menghadirkan tabel inti `fin_*` yang dipakai aplikasi
-- 2. menghadirkan view `fin_v_*` yang menjadi source pembacaan UI
-- 3. menyediakan fondasi sebelum migration hardening/versioning 20260420 dijalankan
--
-- Catatan dependency:
-- - migration ini mengasumsikan tabel inti aplikasi non-budget seperti
--   `fiscal_years`, `sub_activities`, `documents`, dan `employees`
--   sudah tersedia dari migration modul utama.

begin;

create extension if not exists pgcrypto;

create table if not exists public.fin_budget_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  level_number integer not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_budget_accounts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid null references public.fin_budget_accounts (id) on update cascade on delete restrict,
  budget_level_id uuid not null references public.fin_budget_levels (id) on update cascade on delete restrict,
  code text not null unique,
  name text not null,
  full_name text null,
  is_leaf boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  source_type text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_sub_activity_rak_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_budget_item_change_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_budget_realization_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_rak_versions (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null references public.fiscal_years (id) on update cascade on delete restrict,
  code text not null unique,
  version_number integer not null,
  title text null,
  rak_date date not null,
  previous_rak_version_id uuid null references public.fin_rak_versions (id) on update cascade on delete restrict,
  status text not null default 'DRAFT',
  is_active boolean not null default false,
  notes text null,
  created_by uuid null references public.employees (id) on update cascade on delete set null,
  approved_by uuid null references public.employees (id) on update cascade on delete set null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_rak_sub_activities (
  id uuid primary key default gen_random_uuid(),
  rak_version_id uuid not null references public.fin_rak_versions (id) on update cascade on delete cascade,
  sub_activity_id uuid not null references public.sub_activities (id) on update cascade on delete restrict,
  sub_activity_status_id uuid not null references public.fin_sub_activity_rak_statuses (id) on update cascade on delete restrict,
  remarks text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_rak_budget_items (
  id uuid primary key default gen_random_uuid(),
  rak_version_id uuid not null references public.fin_rak_versions (id) on update cascade on delete cascade,
  rak_sub_activity_id uuid not null references public.fin_rak_sub_activities (id) on update cascade on delete cascade,
  budget_account_id uuid not null references public.fin_budget_accounts (id) on update cascade on delete restrict,
  item_change_status_id uuid not null references public.fin_budget_item_change_statuses (id) on update cascade on delete restrict,
  annual_amount numeric(18,2) not null default 0,
  jan_amount numeric(18,2) not null default 0,
  feb_amount numeric(18,2) not null default 0,
  mar_amount numeric(18,2) not null default 0,
  apr_amount numeric(18,2) not null default 0,
  may_amount numeric(18,2) not null default 0,
  jun_amount numeric(18,2) not null default 0,
  jul_amount numeric(18,2) not null default 0,
  aug_amount numeric(18,2) not null default 0,
  sep_amount numeric(18,2) not null default 0,
  oct_amount numeric(18,2) not null default 0,
  nov_amount numeric(18,2) not null default 0,
  dec_amount numeric(18,2) not null default 0,
  remarks text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_rak_budget_item_details (
  id uuid primary key default gen_random_uuid(),
  rak_budget_item_id uuid not null references public.fin_rak_budget_items (id) on update cascade on delete cascade,
  volume numeric(18,2) null,
  unit text null,
  unit_price numeric(18,2) null,
  specification text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_budget_realizations (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null references public.fiscal_years (id) on update cascade on delete restrict,
  sub_activity_id uuid not null references public.sub_activities (id) on update cascade on delete restrict,
  budget_account_id uuid not null references public.fin_budget_accounts (id) on update cascade on delete restrict,
  rak_version_id_snapshot uuid null references public.fin_rak_versions (id) on update cascade on delete set null,
  realization_status_id uuid not null references public.fin_budget_realization_statuses (id) on update cascade on delete restrict,
  realization_date date not null,
  period_month integer not null,
  amount numeric(18,2) not null default 0,
  description text null,
  document_id uuid null references public.documents (id) on update cascade on delete set null,
  created_by uuid null references public.employees (id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fin_budget_realizations_period_month_range_check
    check (period_month between 1 and 12)
);

create index if not exists fin_budget_accounts_parent_id_idx
  on public.fin_budget_accounts (parent_id);

create index if not exists fin_budget_accounts_budget_level_id_idx
  on public.fin_budget_accounts (budget_level_id);

create index if not exists fin_rak_versions_fiscal_year_id_idx
  on public.fin_rak_versions (fiscal_year_id);

create index if not exists fin_rak_sub_activities_rak_version_id_idx
  on public.fin_rak_sub_activities (rak_version_id);

create index if not exists fin_rak_sub_activities_sub_activity_id_idx
  on public.fin_rak_sub_activities (sub_activity_id);

create index if not exists fin_rak_budget_items_rak_sub_activity_id_idx
  on public.fin_rak_budget_items (rak_sub_activity_id);

create index if not exists fin_rak_budget_items_rak_version_id_idx
  on public.fin_rak_budget_items (rak_version_id);

create index if not exists fin_rak_budget_items_budget_account_id_idx
  on public.fin_rak_budget_items (budget_account_id);

create index if not exists fin_budget_realizations_fiscal_year_id_idx
  on public.fin_budget_realizations (fiscal_year_id);

create index if not exists fin_budget_realizations_sub_activity_id_idx
  on public.fin_budget_realizations (sub_activity_id);

create index if not exists fin_budget_realizations_budget_account_id_idx
  on public.fin_budget_realizations (budget_account_id);

create index if not exists fin_budget_realizations_rak_version_snapshot_idx
  on public.fin_budget_realizations (rak_version_id_snapshot);

create or replace view public.fin_v_rak_sub_activity_summary as
select
  rv.id as rak_version_id,
  rv.fiscal_year_id,
  rv.code as rak_code,
  rv.rak_date,
  rsa.id as rak_sub_activity_id,
  sa.id as sub_activity_id,
  sa.code as sub_activity_code,
  sa.name as sub_activity_name,
  sr.code as sub_activity_status_code,
  sr.name as sub_activity_status_name,
  coalesce(sum(rbi.annual_amount), 0)::numeric(18,2) as annual_amount,
  coalesce(sum(rbi.jan_amount), 0)::numeric(18,2) as jan_amount,
  coalesce(sum(rbi.feb_amount), 0)::numeric(18,2) as feb_amount,
  coalesce(sum(rbi.mar_amount), 0)::numeric(18,2) as mar_amount,
  coalesce(sum(rbi.apr_amount), 0)::numeric(18,2) as apr_amount,
  coalesce(sum(rbi.may_amount), 0)::numeric(18,2) as may_amount,
  coalesce(sum(rbi.jun_amount), 0)::numeric(18,2) as jun_amount,
  coalesce(sum(rbi.jul_amount), 0)::numeric(18,2) as jul_amount,
  coalesce(sum(rbi.aug_amount), 0)::numeric(18,2) as aug_amount,
  coalesce(sum(rbi.sep_amount), 0)::numeric(18,2) as sep_amount,
  coalesce(sum(rbi.oct_amount), 0)::numeric(18,2) as oct_amount,
  coalesce(sum(rbi.nov_amount), 0)::numeric(18,2) as nov_amount,
  coalesce(sum(rbi.dec_amount), 0)::numeric(18,2) as dec_amount,
  (
    coalesce(sum(rbi.jan_amount), 0) +
    coalesce(sum(rbi.feb_amount), 0) +
    coalesce(sum(rbi.mar_amount), 0)
  )::numeric(18,2) as q1_amount,
  (
    coalesce(sum(rbi.apr_amount), 0) +
    coalesce(sum(rbi.may_amount), 0) +
    coalesce(sum(rbi.jun_amount), 0)
  )::numeric(18,2) as q2_amount,
  (
    coalesce(sum(rbi.jul_amount), 0) +
    coalesce(sum(rbi.aug_amount), 0) +
    coalesce(sum(rbi.sep_amount), 0)
  )::numeric(18,2) as q3_amount,
  (
    coalesce(sum(rbi.oct_amount), 0) +
    coalesce(sum(rbi.nov_amount), 0) +
    coalesce(sum(rbi.dec_amount), 0)
  )::numeric(18,2) as q4_amount,
  (
    coalesce(sum(rbi.jan_amount), 0) +
    coalesce(sum(rbi.feb_amount), 0) +
    coalesce(sum(rbi.mar_amount), 0) +
    coalesce(sum(rbi.apr_amount), 0) +
    coalesce(sum(rbi.may_amount), 0) +
    coalesce(sum(rbi.jun_amount), 0)
  )::numeric(18,2) as s1_amount,
  (
    coalesce(sum(rbi.jul_amount), 0) +
    coalesce(sum(rbi.aug_amount), 0) +
    coalesce(sum(rbi.sep_amount), 0) +
    coalesce(sum(rbi.oct_amount), 0) +
    coalesce(sum(rbi.nov_amount), 0) +
    coalesce(sum(rbi.dec_amount), 0)
  )::numeric(18,2) as s2_amount
from public.fin_rak_sub_activities rsa
join public.fin_rak_versions rv on rv.id = rsa.rak_version_id
join public.sub_activities sa on sa.id = rsa.sub_activity_id
join public.fin_sub_activity_rak_statuses sr on sr.id = rsa.sub_activity_status_id
left join public.fin_rak_budget_items rbi on rbi.rak_sub_activity_id = rsa.id
group by
  rv.id,
  rv.fiscal_year_id,
  rv.code,
  rv.rak_date,
  rsa.id,
  sa.id,
  sa.code,
  sa.name,
  sr.code,
  sr.name;

create or replace view public.fin_v_rak_budget_item_summary as
select
  rv.id as rak_version_id,
  rv.fiscal_year_id,
  rv.code as rak_code,
  rsa.id as rak_sub_activity_id,
  sa.id as sub_activity_id,
  sa.code as sub_activity_code,
  sa.name as sub_activity_name,
  ba.id as budget_account_id,
  ba.code as budget_account_code,
  ba.name as budget_account_name,
  ics.code as item_change_status_code,
  ics.name as item_change_status_name,
  rbi.annual_amount,
  rbi.jan_amount,
  rbi.feb_amount,
  rbi.mar_amount,
  rbi.apr_amount,
  rbi.may_amount,
  rbi.jun_amount,
  rbi.jul_amount,
  rbi.aug_amount,
  rbi.sep_amount,
  rbi.oct_amount,
  rbi.nov_amount,
  rbi.dec_amount,
  (
    coalesce(rbi.jan_amount, 0) +
    coalesce(rbi.feb_amount, 0) +
    coalesce(rbi.mar_amount, 0)
  )::numeric(18,2) as q1_amount,
  (
    coalesce(rbi.apr_amount, 0) +
    coalesce(rbi.may_amount, 0) +
    coalesce(rbi.jun_amount, 0)
  )::numeric(18,2) as q2_amount,
  (
    coalesce(rbi.jul_amount, 0) +
    coalesce(rbi.aug_amount, 0) +
    coalesce(rbi.sep_amount, 0)
  )::numeric(18,2) as q3_amount,
  (
    coalesce(rbi.oct_amount, 0) +
    coalesce(rbi.nov_amount, 0) +
    coalesce(rbi.dec_amount, 0)
  )::numeric(18,2) as q4_amount,
  (
    coalesce(rbi.jan_amount, 0) +
    coalesce(rbi.feb_amount, 0) +
    coalesce(rbi.mar_amount, 0) +
    coalesce(rbi.apr_amount, 0) +
    coalesce(rbi.may_amount, 0) +
    coalesce(rbi.jun_amount, 0)
  )::numeric(18,2) as s1_amount,
  (
    coalesce(rbi.jul_amount, 0) +
    coalesce(rbi.aug_amount, 0) +
    coalesce(rbi.sep_amount, 0) +
    coalesce(rbi.oct_amount, 0) +
    coalesce(rbi.nov_amount, 0) +
    coalesce(rbi.dec_amount, 0)
  )::numeric(18,2) as s2_amount,
  rbi.remarks
from public.fin_rak_budget_items rbi
join public.fin_rak_sub_activities rsa on rsa.id = rbi.rak_sub_activity_id
join public.fin_rak_versions rv on rv.id = rbi.rak_version_id
join public.sub_activities sa on sa.id = rsa.sub_activity_id
join public.fin_budget_accounts ba on ba.id = rbi.budget_account_id
join public.fin_budget_item_change_statuses ics on ics.id = rbi.item_change_status_id;

create or replace view public.fin_v_budget_realization_summary as
select
  br.fiscal_year_id,
  br.sub_activity_id,
  sa.code as sub_activity_code,
  sa.name as sub_activity_name,
  ba.id as budget_account_id,
  ba.code as budget_account_code,
  ba.name as budget_account_name,
  coalesce(sum(br.amount), 0)::numeric(18,2) as annual_realization,
  coalesce(sum(case when br.period_month = 1 then br.amount else 0 end), 0)::numeric(18,2) as jan_amount,
  coalesce(sum(case when br.period_month = 2 then br.amount else 0 end), 0)::numeric(18,2) as feb_amount,
  coalesce(sum(case when br.period_month = 3 then br.amount else 0 end), 0)::numeric(18,2) as mar_amount,
  coalesce(sum(case when br.period_month = 4 then br.amount else 0 end), 0)::numeric(18,2) as apr_amount,
  coalesce(sum(case when br.period_month = 5 then br.amount else 0 end), 0)::numeric(18,2) as may_amount,
  coalesce(sum(case when br.period_month = 6 then br.amount else 0 end), 0)::numeric(18,2) as jun_amount,
  coalesce(sum(case when br.period_month = 7 then br.amount else 0 end), 0)::numeric(18,2) as jul_amount,
  coalesce(sum(case when br.period_month = 8 then br.amount else 0 end), 0)::numeric(18,2) as aug_amount,
  coalesce(sum(case when br.period_month = 9 then br.amount else 0 end), 0)::numeric(18,2) as sep_amount,
  coalesce(sum(case when br.period_month = 10 then br.amount else 0 end), 0)::numeric(18,2) as oct_amount,
  coalesce(sum(case when br.period_month = 11 then br.amount else 0 end), 0)::numeric(18,2) as nov_amount,
  coalesce(sum(case when br.period_month = 12 then br.amount else 0 end), 0)::numeric(18,2) as dec_amount,
  (
    coalesce(sum(case when br.period_month = 1 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 2 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 3 then br.amount else 0 end), 0)
  )::numeric(18,2) as q1_amount,
  (
    coalesce(sum(case when br.period_month = 4 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 5 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 6 then br.amount else 0 end), 0)
  )::numeric(18,2) as q2_amount,
  (
    coalesce(sum(case when br.period_month = 7 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 8 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 9 then br.amount else 0 end), 0)
  )::numeric(18,2) as q3_amount,
  (
    coalesce(sum(case when br.period_month = 10 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 11 then br.amount else 0 end), 0) +
    coalesce(sum(case when br.period_month = 12 then br.amount else 0 end), 0)
  )::numeric(18,2) as q4_amount,
  (
    coalesce(sum(case when br.period_month between 1 and 6 then br.amount else 0 end), 0)
  )::numeric(18,2) as s1_amount,
  (
    coalesce(sum(case when br.period_month between 7 and 12 then br.amount else 0 end), 0)
  )::numeric(18,2) as s2_amount
from public.fin_budget_realizations br
join public.sub_activities sa on sa.id = br.sub_activity_id
join public.fin_budget_accounts ba on ba.id = br.budget_account_id
group by
  br.fiscal_year_id,
  br.sub_activity_id,
  sa.code,
  sa.name,
  ba.id,
  ba.code,
  ba.name;

create or replace view public.fin_v_budget_balance_summary as
with versioned_realizations as (
  select
    br.fiscal_year_id,
    br.rak_version_id_snapshot as rak_version_id,
    br.sub_activity_id,
    br.budget_account_id,
    coalesce(sum(br.amount), 0)::numeric(18,2) as annual_realization,
    coalesce(sum(case when br.period_month = 1 then br.amount else 0 end), 0)::numeric(18,2) as jan_realization,
    coalesce(sum(case when br.period_month = 2 then br.amount else 0 end), 0)::numeric(18,2) as feb_realization,
    coalesce(sum(case when br.period_month = 3 then br.amount else 0 end), 0)::numeric(18,2) as mar_realization,
    coalesce(sum(case when br.period_month = 4 then br.amount else 0 end), 0)::numeric(18,2) as apr_realization,
    coalesce(sum(case when br.period_month = 5 then br.amount else 0 end), 0)::numeric(18,2) as may_realization,
    coalesce(sum(case when br.period_month = 6 then br.amount else 0 end), 0)::numeric(18,2) as jun_realization,
    coalesce(sum(case when br.period_month = 7 then br.amount else 0 end), 0)::numeric(18,2) as jul_realization,
    coalesce(sum(case when br.period_month = 8 then br.amount else 0 end), 0)::numeric(18,2) as aug_realization,
    coalesce(sum(case when br.period_month = 9 then br.amount else 0 end), 0)::numeric(18,2) as sep_realization,
    coalesce(sum(case when br.period_month = 10 then br.amount else 0 end), 0)::numeric(18,2) as oct_realization,
    coalesce(sum(case when br.period_month = 11 then br.amount else 0 end), 0)::numeric(18,2) as nov_realization,
    coalesce(sum(case when br.period_month = 12 then br.amount else 0 end), 0)::numeric(18,2) as dec_realization
  from public.fin_budget_realizations br
  where br.rak_version_id_snapshot is not null
  group by
    br.fiscal_year_id,
    br.rak_version_id_snapshot,
    br.sub_activity_id,
    br.budget_account_id
)
select
  bis.fiscal_year_id,
  bis.rak_version_id,
  bis.rak_code,
  bis.sub_activity_id,
  bis.sub_activity_code,
  bis.sub_activity_name,
  bis.budget_account_id,
  bis.budget_account_code,
  bis.budget_account_name,
  bis.annual_amount::numeric(18,2) as annual_plan,
  coalesce(vr.annual_realization, 0)::numeric(18,2) as annual_realization,
  (bis.annual_amount - coalesce(vr.annual_realization, 0))::numeric(18,2) as annual_balance,
  (
    case
      when bis.annual_amount <= 0 and coalesce(vr.annual_realization, 0) > 0 then 100
      when bis.annual_amount <= 0 then 0
      else (coalesce(vr.annual_realization, 0) / nullif(bis.annual_amount, 0)) * 100
    end
  )::numeric(18,2) as absorption_percent,
  bis.jan_amount::numeric(18,2) as jan_plan,
  coalesce(vr.jan_realization, 0)::numeric(18,2) as jan_realization,
  (bis.jan_amount - coalesce(vr.jan_realization, 0))::numeric(18,2) as jan_balance,
  bis.feb_amount::numeric(18,2) as feb_plan,
  coalesce(vr.feb_realization, 0)::numeric(18,2) as feb_realization,
  (bis.feb_amount - coalesce(vr.feb_realization, 0))::numeric(18,2) as feb_balance,
  bis.mar_amount::numeric(18,2) as mar_plan,
  coalesce(vr.mar_realization, 0)::numeric(18,2) as mar_realization,
  (bis.mar_amount - coalesce(vr.mar_realization, 0))::numeric(18,2) as mar_balance,
  bis.apr_amount::numeric(18,2) as apr_plan,
  coalesce(vr.apr_realization, 0)::numeric(18,2) as apr_realization,
  (bis.apr_amount - coalesce(vr.apr_realization, 0))::numeric(18,2) as apr_balance,
  bis.may_amount::numeric(18,2) as may_plan,
  coalesce(vr.may_realization, 0)::numeric(18,2) as may_realization,
  (bis.may_amount - coalesce(vr.may_realization, 0))::numeric(18,2) as may_balance,
  bis.jun_amount::numeric(18,2) as jun_plan,
  coalesce(vr.jun_realization, 0)::numeric(18,2) as jun_realization,
  (bis.jun_amount - coalesce(vr.jun_realization, 0))::numeric(18,2) as jun_balance,
  bis.jul_amount::numeric(18,2) as jul_plan,
  coalesce(vr.jul_realization, 0)::numeric(18,2) as jul_realization,
  (bis.jul_amount - coalesce(vr.jul_realization, 0))::numeric(18,2) as jul_balance,
  bis.aug_amount::numeric(18,2) as aug_plan,
  coalesce(vr.aug_realization, 0)::numeric(18,2) as aug_realization,
  (bis.aug_amount - coalesce(vr.aug_realization, 0))::numeric(18,2) as aug_balance,
  bis.sep_amount::numeric(18,2) as sep_plan,
  coalesce(vr.sep_realization, 0)::numeric(18,2) as sep_realization,
  (bis.sep_amount - coalesce(vr.sep_realization, 0))::numeric(18,2) as sep_balance,
  bis.oct_amount::numeric(18,2) as oct_plan,
  coalesce(vr.oct_realization, 0)::numeric(18,2) as oct_realization,
  (bis.oct_amount - coalesce(vr.oct_realization, 0))::numeric(18,2) as oct_balance,
  bis.nov_amount::numeric(18,2) as nov_plan,
  coalesce(vr.nov_realization, 0)::numeric(18,2) as nov_realization,
  (bis.nov_amount - coalesce(vr.nov_realization, 0))::numeric(18,2) as nov_balance,
  bis.dec_amount::numeric(18,2) as dec_plan,
  coalesce(vr.dec_realization, 0)::numeric(18,2) as dec_realization,
  (bis.dec_amount - coalesce(vr.dec_realization, 0))::numeric(18,2) as dec_balance,
  case
    when bis.annual_amount > 0 and coalesce(vr.annual_realization, 0) = 0 then 'NO_REALIZATION'
    when coalesce(vr.annual_realization, 0) > bis.annual_amount then 'OVERSPEND'
    when coalesce(vr.annual_realization, 0) < bis.annual_amount then 'UNDERSPEND'
    else 'ON_TRACK'
  end as balance_status
from public.fin_v_rak_budget_item_summary bis
left join versioned_realizations vr
  on vr.rak_version_id = bis.rak_version_id
 and vr.fiscal_year_id = bis.fiscal_year_id
 and vr.sub_activity_id = bis.sub_activity_id
 and vr.budget_account_id = bis.budget_account_id;

create or replace view public.fin_v_budget_balance_unpivot as
select
  v.fiscal_year_id,
  v.rak_version_id,
  v.rak_code,
  v.sub_activity_id,
  v.sub_activity_code,
  v.sub_activity_name,
  v.budget_account_id,
  v.budget_account_code,
  v.budget_account_name,
  x.month,
  x.period_month,
  x.plan,
  x.realization,
  x.balance
from public.fin_v_budget_balance_summary v
cross join lateral (
  values
    ('JAN', 1, v.jan_plan, v.jan_realization, v.jan_balance),
    ('FEB', 2, v.feb_plan, v.feb_realization, v.feb_balance),
    ('MAR', 3, v.mar_plan, v.mar_realization, v.mar_balance),
    ('APR', 4, v.apr_plan, v.apr_realization, v.apr_balance),
    ('MAY', 5, v.may_plan, v.may_realization, v.may_balance),
    ('JUN', 6, v.jun_plan, v.jun_realization, v.jun_balance),
    ('JUL', 7, v.jul_plan, v.jul_realization, v.jul_balance),
    ('AUG', 8, v.aug_plan, v.aug_realization, v.aug_balance),
    ('SEP', 9, v.sep_plan, v.sep_realization, v.sep_balance),
    ('OCT', 10, v.oct_plan, v.oct_realization, v.oct_balance),
    ('NOV', 11, v.nov_plan, v.nov_realization, v.nov_balance),
    ('DEC', 12, v.dec_plan, v.dec_realization, v.dec_balance)
) as x(month, period_month, plan, realization, balance);

create or replace view public.fin_v_tracking_budget_warnings as
select
  b.fiscal_year_id,
  b.rak_version_id,
  b.rak_code,
  b.sub_activity_id,
  b.sub_activity_code,
  b.sub_activity_name,
  b.budget_account_id,
  b.budget_account_code,
  b.budget_account_name,
  b.annual_plan,
  b.annual_realization,
  b.annual_balance,
  b.absorption_percent,
  case
    when b.annual_plan > 0 and b.annual_realization = 0 then 'NO_REALIZATION'
    when b.annual_balance < 0 then 'OVERSPEND'
    else null
  end as warning_type
from public.fin_v_budget_balance_summary b
where
  (b.annual_plan > 0 and b.annual_realization = 0)
  or b.annual_balance < 0;

create or replace view public.fin_v_tracking_budget_progress as
select
  b.fiscal_year_id,
  b.rak_version_id,
  b.rak_code,
  b.sub_activity_id,
  b.sub_activity_code,
  b.sub_activity_name,
  b.budget_account_id,
  b.budget_account_code,
  b.budget_account_name,
  b.annual_plan,
  b.annual_realization,
  b.absorption_percent::numeric(18,2) as progress_percent,
  case
    when b.absorption_percent <= 0 then 'NOT_STARTED'
    when b.absorption_percent >= 100 then 'HIGH'
    else 'ON_TRACK'
  end as progress_status
from public.fin_v_budget_balance_summary b;

create or replace view public.fin_v_tracking_budget_deviations as
select
  b.fiscal_year_id,
  b.rak_version_id,
  b.rak_code,
  b.sub_activity_id,
  b.sub_activity_code,
  b.sub_activity_name,
  b.budget_account_id,
  b.budget_account_code,
  b.budget_account_name,
  b.annual_plan,
  b.annual_realization,
  b.annual_balance,
  case
    when b.annual_plan <= 0 and b.annual_realization > 0 then 100
    when b.annual_plan <= 0 then 0
    else (abs(b.annual_balance) / nullif(b.annual_plan, 0)) * 100
  end::numeric(18,2) as annual_deviation_percent,
  b.balance_status,
  b.jan_balance::numeric(18,2) as jan_deviation,
  b.feb_balance::numeric(18,2) as feb_deviation,
  b.mar_balance::numeric(18,2) as mar_deviation,
  b.apr_balance::numeric(18,2) as apr_deviation,
  b.may_balance::numeric(18,2) as may_deviation,
  b.jun_balance::numeric(18,2) as jun_deviation,
  b.jul_balance::numeric(18,2) as jul_deviation,
  b.aug_balance::numeric(18,2) as aug_deviation,
  b.sep_balance::numeric(18,2) as sep_deviation,
  b.oct_balance::numeric(18,2) as oct_deviation,
  b.nov_balance::numeric(18,2) as nov_deviation,
  b.dec_balance::numeric(18,2) as dec_deviation
from public.fin_v_budget_balance_summary b;

create or replace view public.fin_v_tracking_rak_changes as
with version_pairs as (
  select
    rv.id as new_rak_version_id,
    rv.code as new_rak_code,
    rv.previous_rak_version_id as old_rak_version_id,
    prv.code as old_rak_code
  from public.fin_rak_versions rv
  left join public.fin_rak_versions prv on prv.id = rv.previous_rak_version_id
),
new_items as (
  select
    vp.new_rak_version_id,
    vp.new_rak_code,
    vp.old_rak_version_id,
    vp.old_rak_code,
    bis.sub_activity_id,
    bis.sub_activity_code,
    bis.sub_activity_name,
    bis.budget_account_id,
    bis.budget_account_code,
    bis.budget_account_name,
    bis.annual_amount as new_annual_amount,
    bis.item_change_status_code
  from version_pairs vp
  join public.fin_v_rak_budget_item_summary bis
    on bis.rak_version_id = vp.new_rak_version_id
),
old_items as (
  select
    vp.new_rak_version_id,
    vp.new_rak_code,
    vp.old_rak_version_id,
    vp.old_rak_code,
    bis.sub_activity_id,
    bis.sub_activity_code,
    bis.sub_activity_name,
    bis.budget_account_id,
    bis.budget_account_code,
    bis.budget_account_name,
    bis.annual_amount as old_annual_amount
  from version_pairs vp
  join public.fin_v_rak_budget_item_summary bis
    on bis.rak_version_id = vp.old_rak_version_id
)
select
  coalesce(n.new_rak_version_id, o.new_rak_version_id) as new_rak_version_id,
  coalesce(n.new_rak_code, o.new_rak_code) as new_rak_code,
  coalesce(n.old_rak_version_id, o.old_rak_version_id) as old_rak_version_id,
  coalesce(n.old_rak_code, o.old_rak_code) as old_rak_code,
  coalesce(n.sub_activity_id, o.sub_activity_id) as sub_activity_id,
  coalesce(n.sub_activity_code, o.sub_activity_code) as sub_activity_code,
  coalesce(n.sub_activity_name, o.sub_activity_name) as sub_activity_name,
  coalesce(n.budget_account_id, o.budget_account_id) as budget_account_id,
  coalesce(n.budget_account_code, o.budget_account_code) as budget_account_code,
  coalesce(n.budget_account_name, o.budget_account_name) as budget_account_name,
  coalesce(o.old_annual_amount, 0)::numeric(18,2) as old_annual_amount,
  coalesce(n.new_annual_amount, 0)::numeric(18,2) as new_annual_amount,
  (coalesce(n.new_annual_amount, 0) - coalesce(o.old_annual_amount, 0))::numeric(18,2) as difference_amount,
  case
    when coalesce(o.old_annual_amount, 0) = 0 then null
    else (
      (coalesce(n.new_annual_amount, 0) - coalesce(o.old_annual_amount, 0))
      / nullif(o.old_annual_amount, 0)
    ) * 100
  end::numeric(18,2) as difference_percent,
  case
    when o.budget_account_id is null then 'BARU'
    when n.budget_account_id is null then 'DIHAPUS'
    else coalesce(n.item_change_status_code, 'TETAP')
  end as change_status_code
from new_items n
full join old_items o
  on n.new_rak_version_id = o.new_rak_version_id
 and n.sub_activity_id = o.sub_activity_id
 and n.budget_account_id = o.budget_account_id;

commit;
