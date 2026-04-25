begin;

create table if not exists public.fin_budget_item_statuses (
  id uuid primary key default gen_random_uuid(),
  code varchar not null unique,
  name varchar null,
  color text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.fin_budget_item_statuses (code, name, color, is_active)
values
  ('DRAFT', 'Draft', '#9CA3AF', true),
  ('APPROVED', 'Approved', '#16A34A', true),
  ('REJECTED', 'Rejected', '#DC2626', true)
on conflict (code) do update
set
  name = excluded.name,
  color = excluded.color,
  is_active = excluded.is_active;

commit;
