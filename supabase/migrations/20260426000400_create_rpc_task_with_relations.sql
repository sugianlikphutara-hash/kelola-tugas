-- Create RPC to handle Task insertion (bypass direct RLS insertion)
begin;

create or replace function public.create_task_with_relations(p_payload jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role_code text;
  v_task public.tasks%rowtype;
  v_code text;
  v_start_date date;
  v_due_date date;
  v_approval_status text;
  v_random_suffix text;
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

  if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG', 'STAF') then
    raise exception 'Anda tidak memiliki izin untuk membuat task.';
  end if;

  -- 3. Prepare task fields
  select substr(md5(random()::text), 1, 4) into v_random_suffix;
  v_code := 'TSK-' || to_char(now(), 'YYYYMMDD-HH24MISSMS') || '-' || upper(v_random_suffix);

  if p_payload->>'start_date' is not null and trim(p_payload->>'start_date') <> '' then
    v_start_date := (p_payload->>'start_date')::date;
  end if;

  if p_payload->>'due_date' is not null and trim(p_payload->>'due_date') <> '' then
    v_due_date := (p_payload->>'due_date')::date;
  end if;

  v_approval_status := lower(trim(p_payload->>'approval_status'));
  if v_approval_status = 'approved' then
    v_approval_status := 'approved';
  else
    v_approval_status := 'pending';
  end if;

  -- 4. Execute Insert
  insert into public.tasks (
    code,
    action_plan_id,
    title,
    description,
    start_date,
    due_date,
    status_id,
    priority_id,
    approval_status
  ) values (
    v_code,
    nullif(trim(p_payload->>'action_plan_id'), '')::uuid,
    trim(p_payload->>'title'),
    trim(p_payload->>'description'),
    v_start_date,
    v_due_date,
    nullif(trim(p_payload->>'status_id'), '')::uuid,
    nullif(trim(p_payload->>'priority_id'), '')::uuid,
    v_approval_status
  )
  returning * into v_task;

  -- 5. Sub-inserts: Task Assignment
  if p_payload->>'assignee_id' is not null and trim(p_payload->>'assignee_id') <> '' then
    insert into public.task_assignments (
      task_id,
      employee_id,
      assignment_role,
      is_primary
    ) values (
      v_task.id,
      (p_payload->>'assignee_id')::uuid,
      'Pelaksana',
      true
    );
  end if;

  -- 6. Sub-inserts: Evidence Request
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
        v_task.id,
        trim(v_evidence_item),
        null
      );
    end loop;
  end if;

  return v_task;
end;
$$;

commit;
