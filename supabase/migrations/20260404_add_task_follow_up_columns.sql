alter table public.tasks
add column if not exists is_followed_up boolean not null default false,
add column if not exists followed_up_at timestamptz null,
add column if not exists followed_up_by_employee_id uuid null references public.employees(id);
