-- Create RPC to handle Task update (bypass direct RLS update)
begin;

create or replace function public.update_task_with_relations(p_task_id uuid, p_payload jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role_code text;
  v_existing_task public.tasks%rowtype;
  v_updated_task public.tasks%rowtype;
  v_start_date date;
  v_due_date date;
  v_evidence_item text;
begin
  -- 1. Validate auth
  if v_auth_user_id is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  -- 2. Fetch role
  select upper(trim(r.code::text))
  into v_role_code
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.auth_user_id = v_auth_user_id
    and upper(coalesce(u.status, '')) = 'ACTIVE'
    and coalesce(u.is_locked, false) = false
    and coalesce(r.is_active, false) = true
  limit 1;

  if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG') then
    raise exception 'Anda tidak memiliki izin untuk mengubah data dasar task.';
  end if;

  -- 3. Check if task exists
  select *
  into v_existing_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task tidak ditemukan.';
  end if;

  -- Optional: Tolak jika status disetuju/ditolak/etc (Untuk saat ini hanya Role validation yang diterapkan)

  -- 4. Prepare fields
  if p_payload->>'start_date' is not null and trim(p_payload->>'start_date') <> '' then
    v_start_date := (p_payload->>'start_date')::date;
  else
    v_start_date := null;
  end if;

  if p_payload->>'due_date' is not null and trim(p_payload->>'due_date') <> '' then
    v_due_date := (p_payload->>'due_date')::date;
  else
    v_due_date := null;
  end if;

  -- 5. Execute Update Task Dashboard
  update public.tasks
  set
    action_plan_id = nullif(trim(p_payload->>'action_plan_id'), '')::uuid,
    title = trim(p_payload->>'title'),
    description = trim(p_payload->>'description'),
    start_date = v_start_date,
    due_date = v_due_date,
    status_id = nullif(trim(p_payload->>'status_id'), '')::uuid,
    priority_id = nullif(trim(p_payload->>'priority_id'), '')::uuid,
    updated_at = now()
  where id = p_task_id
  returning * into v_updated_task;

  -- 6. Sub-update: Task Assignment Re-Assignment
  delete from public.task_assignments where task_id = p_task_id;

  if p_payload->>'assignee_id' is not null and trim(p_payload->>'assignee_id') <> '' then
    insert into public.task_assignments (
      task_id,
      employee_id,
      assignment_role,
      is_primary
    ) values (
      p_task_id,
      (p_payload->>'assignee_id')::uuid,
      'Pelaksana',
      true
    );
  end if;

  -- 7. Sub-update: Evidence Request Substitution
  delete from public.task_evidence_requests where task_id = p_task_id;

  if p_payload->>'evidence_request' is not null and trim(p_payload->>'evidence_request') <> '' then
    for v_evidence_item in
      select regexp_replace(item, '^\s*-\s*', '')
      from unnest(string_to_array(p_payload->>'evidence_request', e'\n')) as item
      where trim(item) <> ''
    loop
      insert into public.task_evidence_requests (
        task_id,
        request_name,
        notes
      ) values (
        p_task_id,
        trim(v_evidence_item),
        null
      );
    end loop;
  end if;

  return v_updated_task;
end;
$$;

grant execute on function public.update_task_with_relations(uuid, jsonb) to authenticated;

commit;
