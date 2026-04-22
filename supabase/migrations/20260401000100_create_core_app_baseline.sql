-- Baseline schema modul inti aplikasi (core app).
-- Tujuan minimal:
-- - menyediakan tabel-tabel yang direferensikan oleh migration ALTER/VIEW setelahnya
--   (mis. 20260404_add_task_follow_up_columns.sql dan vw_task_monitoring)
-- - menyediakan dependency non-budget yang diasumsikan ada oleh modul anggaran
--   (employees, fiscal_years, sub_activities, documents, dst.)
--
-- Catatan:
-- - Migration ini sengaja bersifat "minimum viable schema" agar replay dari nol tidak gagal.
-- - Jika ada drift dengan STAGING, definisi detail (constraint/index/kolom tambahan)
--   sebaiknya disinkronkan kemudian berdasarkan dump/pg_catalog dari STAGING.

begin;

create extension if not exists pgcrypto;

-- ===== Master / Referensi minimal =====

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_priorities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text null,
  parent_id uuid null,
  level text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  nick_name text null,
  nip text null,
  email text null,
  phone text null,
  address text null,
  gender text null,
  birth_place text null,
  birth_date date null,
  employment_status text null,
  start_date date null,
  end_date date null,
  photo_url text null,
  notes text null,
  unit_id uuid null references public.units (id) on update cascade on delete set null,
  position_id uuid null references public.positions (id) on update cascade on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on update cascade on delete restrict,
  role_id uuid not null references public.roles (id) on update cascade on delete restrict,
  username text not null,
  email text null,
  password_hash text null,
  status text not null default 'ACTIVE',
  failed_login_count integer not null default 0,
  is_locked boolean not null default false,
  lock_reason text null,
  last_login_at timestamptz null,
  last_login_ip text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Program / Kegiatan (pusat relasi non-budget) =====

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  code text null,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sub_activities (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid null references public.activities (id) on update cascade on delete set null,
  code text null,
  name text not null,
  description text null,
  start_date date null,
  end_date date null,
  status_id uuid null references public.master_statuses (id) on update cascade on delete set null,
  priority_id uuid null references public.master_priorities (id) on update cascade on delete set null,
  output_target numeric null,
  output_unit text null,
  output_unit_id uuid null,
  created_by uuid null references public.employees (id) on update cascade on delete set null,
  approved_by uuid null references public.employees (id) on update cascade on delete set null,
  approved_at timestamptz null,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now()
);

create table if not exists public.work_plans (
  id uuid primary key default gen_random_uuid(),
  sub_activity_id uuid null references public.sub_activities (id) on update cascade on delete set null,
  title text not null,
  description text null,
  start_date date null,
  end_date date null,
  progress_percent numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.action_plans (
  id uuid primary key default gen_random_uuid(),
  work_plan_id uuid null references public.work_plans (id) on update cascade on delete set null,
  title text not null,
  description text null,
  planned_start_date date null,
  planned_end_date date null,
  actual_start_date date null,
  actual_end_date date null,
  progress_percent numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Tasks (dipakai migration 20260404 dan view monitoring 20260409) =====

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  action_plan_id uuid not null references public.action_plans (id) on update cascade on delete restrict,
  parent_task_id uuid null references public.tasks (id) on update cascade on delete set null,
  code text null,
  title text not null,
  description text null,
  sequence_no integer not null default 0,
  start_date date null,
  due_date date null,
  actual_start_date date null,
  actual_end_date date null,
  progress_percent numeric not null default 0,
  result_summary text null,
  notes text null,
  status_id uuid null references public.master_statuses (id) on update cascade on delete set null,
  priority_id uuid null references public.master_priorities (id) on update cascade on delete set null,
  assigned_by_employee_id uuid null references public.employees (id) on update cascade on delete set null,
  approval_status text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on update cascade on delete cascade,
  employee_id uuid not null references public.employees (id) on update cascade on delete restrict,
  assignment_role text null,
  is_primary boolean not null default false,
  notes text null,
  assigned_at timestamptz null,
  accepted_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_progress_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on update cascade on delete cascade,
  notes text null,
  progress_percent numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dokumen minimal (dipakai modul anggaran & kemungkinan relasi evidence)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text null,
  description text null,
  notes text null,
  document_type_id uuid null,
  evidence_type_id uuid null,
  status_id uuid null references public.master_statuses (id) on update cascade on delete set null,
  file_name text null,
  file_extension text null,
  mime_type text null,
  file_size bigint null,
  file_url text null,
  storage_path text null,
  uploaded_at timestamptz null,
  uploaded_by_employee_id uuid null references public.employees (id) on update cascade on delete set null,
  version_no integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_documents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on update cascade on delete cascade,
  document_id uuid null references public.documents (id) on update cascade on delete set null,
  created_at timestamptz not null default now()
);

-- Tahun anggaran (dependency modul anggaran)
create table if not exists public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  name text null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

commit;

