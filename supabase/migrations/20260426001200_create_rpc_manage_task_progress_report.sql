-- Create RPC to update/delete Task progress reports safely (RLS-compatible)
begin;

create or replace function public.manage_task_progress_report(
  p_action text,
  p_progress_report_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_role_code text;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_existing_report public.task_progress_reports%rowtype;
  v_updated_report public.task_progress_reports%rowtype;
  v_task public.tasks%rowtype;
  v_task_status_code text;
  v_is_assignee boolean := false;
  v_progress_percent numeric;
  v_reported_by_employee_id uuid;
  v_latest_progress numeric := 0;
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
    raise exception 'Anda tidak memiliki izin untuk mengelola progress report.';
  end if;

  if v_action not in ('update', 'delete') then
    raise exception 'Aksi progress report tidak valid.';
  end if;

  -- 3. Validate progress report and task
  select *
  into v_existing_report
  from public.task_progress_reports
  where id = p_progress_report_id;

  if not found then
    raise exception 'Progress report tidak ditemukan.';
  end if;

  select *
  into v_task
  from public.tasks
  where id = v_existing_report.task_id;

  if not found then
    raise exception 'Task tidak ditemukan.';
  end if;

  if v_role_code = 'STAF' then
    select exists (
      select 1
      from public.task_assignments
      where task_id = v_existing_report.task_id
        and employee_id = v_employee_id
    ) into v_is_assignee;

    if not v_is_assignee then
      raise exception 'STAF hanya boleh mengelola progress untuk task yang di-assign kepadanya.';
    end if;

    if v_existing_report.reported_by_employee_id is distinct from v_employee_id then
      raise exception 'STAF hanya boleh mengelola progress report yang dibuat sendiri.';
    end if;
  end if;

  if v_action = 'update' then
    if not (p_payload ? 'progress_percent') then
      raise exception 'Progress percent wajib diisi.';
    end if;

    v_progress_percent := (p_payload->>'progress_percent')::numeric;

    if v_progress_percent < 0 or v_progress_percent > 100 then
      raise exception 'Progress percent harus antara 0 sampai 100.';
    end if;

    if lower(coalesce(v_task.approval_status, '')) = 'rejected' then
      raise exception 'Progress tidak dapat diubah karena task ditolak.';
    end if;

    select code
    into v_task_status_code
    from public.master_statuses
    where id = v_task.status_id
      and lower(coalesce(category, '')) = 'task'
    limit 1;

    if lower(coalesce(v_task_status_code, '')) = 'dibatalkan' then
      raise exception 'Progress tidak dapat diubah karena task dibatalkan.';
    end if;

    if v_progress_percent < coalesce(v_task.progress_percent, 0) then
      raise exception 'Progress baru tidak boleh lebih kecil dari progress saat ini.';
    end if;

    if v_role_code = 'STAF' then
      v_reported_by_employee_id := v_employee_id;
    elsif p_payload ? 'reported_by_employee_id'
      and p_payload->>'reported_by_employee_id' is not null
      and trim(p_payload->>'reported_by_employee_id') <> '' then
      v_reported_by_employee_id := (p_payload->>'reported_by_employee_id')::uuid;
    else
      v_reported_by_employee_id := coalesce(v_existing_report.reported_by_employee_id, v_employee_id);
    end if;

    update public.task_progress_reports
    set
      progress_percent = v_progress_percent,
      result_summary = nullif(trim(coalesce(p_payload->>'result_summary', '')), ''),
      issue_summary = nullif(trim(coalesce(p_payload->>'issue_summary', '')), ''),
      next_step_summary = nullif(trim(coalesce(p_payload->>'next_step_summary', '')), ''),
      reported_by_employee_id = v_reported_by_employee_id,
      updated_at = now()
    where id = p_progress_report_id
    returning * into v_updated_report;
  else
    delete from public.task_progress_reports
    where id = p_progress_report_id;
  end if;

  -- 4. Recalculate latest task progress after update/delete
  select progress_percent
  into v_latest_progress
  from public.task_progress_reports
  where task_id = v_existing_report.task_id
  order by report_date desc nulls last, created_at desc nulls last
  limit 1;

  v_latest_progress := coalesce(v_latest_progress, 0);

  update public.tasks
  set
    progress_percent = v_latest_progress,
    updated_at = now()
  where id = v_existing_report.task_id;

  return jsonb_build_object(
    'action', v_action,
    'progress_report', case
      when v_action = 'update' then to_jsonb(v_updated_report)
      else to_jsonb(v_existing_report)
    end,
    'task_id', v_existing_report.task_id,
    'synced_progress_percent', v_latest_progress
  );
end;
$$;

grant execute on function public.manage_task_progress_report(text, uuid, jsonb) to authenticated;

commit;
