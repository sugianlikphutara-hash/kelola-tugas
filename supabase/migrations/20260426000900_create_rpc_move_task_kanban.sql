-- Create RPC to handle Kanban task status moves (RLS-compatible)
begin;

create or replace function public.move_task_kanban(
  p_task_id uuid,
  p_status_id uuid
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_role_code text;
  v_existing_task public.tasks%rowtype;
  v_updated_task public.tasks%rowtype;
  v_is_assignee boolean := false;
  v_target_status record;
begin
  -- 1. Validate auth
  if v_auth_user_id is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  -- 2. Fetch role & employee_id from database
  select u.employee_id, upper(trim(r.code::text))
  into v_employee_id, v_role_code
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.auth_user_id = v_auth_user_id
    and upper(coalesce(u.status, '')) = 'ACTIVE'
    and coalesce(u.is_locked, false) = false
    and coalesce(r.is_active, false) = true
  limit 1;

  if v_employee_id is null then
    raise exception 'Profil pegawai user tidak ditemukan.';
  end if;

  if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG', 'STAF') then
    raise exception 'Anda tidak memiliki izin untuk memindahkan task di kanban.';
  end if;

  -- 3. Check if task exists
  select *
  into v_existing_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task tidak ditemukan.';
  end if;

  if lower(coalesce(v_existing_task.approval_status, '')) = 'rejected' then
    raise exception 'Task yang ditolak tidak dapat dipindahkan di kanban.';
  end if;

  -- 4. Validate target status
  select id, code, category, is_active
  into v_target_status
  from public.master_statuses
  where id = p_status_id
    and lower(coalesce(category, '')) = 'task'
    and coalesce(is_active, true) = true
  limit 1;

  if not found then
    raise exception 'Status tujuan task tidak valid.';
  end if;

  -- 5. STAF can only move assigned tasks
  if v_role_code = 'STAF' then
    select exists (
      select 1
      from public.task_assignments
      where task_id = p_task_id
        and employee_id = v_employee_id
    ) into v_is_assignee;

    if not v_is_assignee then
      raise exception 'STAF hanya boleh memindahkan task yang di-assign kepadanya.';
    end if;
  end if;

  -- 6. Update only Kanban status fields on tasks
  update public.tasks
  set
    status_id = p_status_id,
    updated_at = now()
  where id = p_task_id
  returning * into v_updated_task;

  return v_updated_task;
end;
$$;

grant execute on function public.move_task_kanban(uuid, uuid) to authenticated;

commit;
