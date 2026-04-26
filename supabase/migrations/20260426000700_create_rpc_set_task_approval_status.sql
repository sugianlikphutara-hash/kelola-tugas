-- Create RPC to handle Task Approval and Rejection
begin;

create or replace function public.set_task_approval_status(p_task_id uuid, p_approval_status text, p_notes text)
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
  v_normalized_status text := lower(trim(p_approval_status));
  v_existing_approval record;
  v_approval_id uuid;
begin
  -- 1. Validate auth
  if v_auth_user_id is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  -- 2. Validate input parameters
  if v_normalized_status not in ('approved', 'rejected') then
    raise exception 'Status yang diizinkan hanya approved atau rejected.';
  end if;

  if v_normalized_status = 'rejected' and (p_notes is null or trim(p_notes) = '') then
    raise exception 'Alasan penolakan wajib diisi.';
  end if;

  -- 3. Fetch role & mapping
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

  if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG') then
    raise exception 'Anda tidak memiliki izin untuk mengelola approval task.';
  end if;

  -- 4. Check if task exists and validates existing approval status
  select *
  into v_existing_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task tidak ditemukan.';
  end if;

  if lower(coalesce(v_existing_task.approval_status, '')) in ('approved', 'rejected') then
    raise exception 'Task yang sudah diputuskan (approved/rejected) tidak dapat diubah lagi statusnya.';
  end if;

  -- 5. Update tasks table directly
  update public.tasks
  set approval_status = v_normalized_status,
      updated_at = now()
  where id = p_task_id
  returning * into v_updated_task;

  -- 6. Update mapping on approvals table
  select id, entity_id, entity_type, request_by_employee_id, requested_at
  into v_existing_approval
  from public.approvals
  where entity_type = 'task' 
    and entity_id = p_task_id 
  limit 1;

  if found then
    update public.approvals
    set 
      approval_notes = nullif(trim(coalesce(p_notes, '')), ''),
      approver_employee_id = v_employee_id,
      approved_at = case when v_normalized_status = 'approved' then now() else null end,
      rejected_at = case when v_normalized_status = 'rejected' then now() else null end,
      updated_at = now()
    where id = v_existing_approval.id
    returning id into v_approval_id;
  else
    insert into public.approvals (
      entity_type, 
      entity_id, 
      approval_notes, 
      approver_employee_id, 
      approved_at, 
      rejected_at, 
      requested_at
    ) values (
      'task', 
      p_task_id, 
      nullif(trim(coalesce(p_notes, '')), ''), 
      v_employee_id, 
      case when v_normalized_status = 'approved' then now() else null end,
      case when v_normalized_status = 'rejected' then now() else null end,
      now()
    ) returning id into v_approval_id;
  end if;

  -- 7. Audit entry onto approval_histories
  insert into public.approval_histories (
    approval_id, 
    action_name, 
    action_at, 
    action_by_employee_id, 
    notes
  ) values (
    v_approval_id, 
    v_normalized_status, 
    now(), 
    v_employee_id, 
    nullif(trim(coalesce(p_notes, '')), '')
  );

  return v_updated_task;
end;
$$;

grant execute on function public.set_task_approval_status(uuid, text, text) to authenticated;

commit;
