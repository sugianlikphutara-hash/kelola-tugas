-- Create RPC to delete Task safely (RLS-compatible)
begin;

create or replace function public.delete_task_safe(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role_code text;
  v_existing_task public.tasks%rowtype;
  v_progress_count integer := 0;
  v_evidence_count integer := 0;
  v_daily_report_count integer := 0;
  v_follow_up_count integer := 0;
  v_approval_history_count integer := 0;
begin
  -- 1. Validate auth
  if v_auth_user_id is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  -- 2. Fetch role from database
  select upper(trim(r.code::text))
  into v_role_code
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.auth_user_id = v_auth_user_id
    and upper(coalesce(u.status, '')) = 'ACTIVE'
    and coalesce(u.is_locked, false) = false
    and coalesce(r.is_active, false) = true
  limit 1;

  if v_role_code <> 'ADMIN' then
    raise exception 'Hanya ADMIN yang boleh menghapus task.';
  end if;

  -- 3. Check if task exists
  select *
  into v_existing_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task tidak ditemukan.';
  end if;

  if lower(coalesce(v_existing_task.approval_status, '')) in ('approved', 'rejected') then
    raise exception 'Task yang sudah approved atau rejected tidak boleh dihapus.';
  end if;

  -- 4. Strict delete guards
  select count(*) into v_progress_count
  from public.task_progress_reports
  where task_id = p_task_id;

  if v_progress_count > 0 then
    raise exception 'Task tidak boleh dihapus karena sudah memiliki progress.';
  end if;

  select count(*) into v_evidence_count
  from public.task_documents
  where task_id = p_task_id;

  if v_evidence_count > 0 then
    raise exception 'Task tidak boleh dihapus karena sudah memiliki evidence.';
  end if;

  select count(*) into v_daily_report_count
  from public.task_daily_reports
  where task_id = p_task_id;

  if v_daily_report_count > 0 then
    raise exception 'Task tidak boleh dihapus karena sudah memiliki sub task/laporan harian.';
  end if;

  select count(*) into v_follow_up_count
  from public.task_follow_ups
  where task_id = p_task_id;

  if v_follow_up_count > 0 then
    raise exception 'Task tidak boleh dihapus karena sudah memiliki follow-up.';
  end if;

  select count(*) into v_approval_history_count
  from public.approval_histories ah
  join public.approvals a on a.id = ah.approval_id
  where a.entity_type = 'task'
    and a.entity_id = p_task_id;

  if v_approval_history_count > 0 then
    raise exception 'Task tidak boleh dihapus karena sudah memiliki histori approval.';
  end if;

  -- 5. Hard delete pending task and non-history relations only.
  delete from public.kanban_cards
  where entity_type = 'task'
    and entity_id = p_task_id;

  delete from public.task_evidence_requests
  where task_id = p_task_id;

  delete from public.task_assignments
  where task_id = p_task_id;

  delete from public.approvals
  where entity_type = 'task'
    and entity_id = p_task_id;

  delete from public.tasks
  where id = p_task_id;

  return p_task_id;
end;
$$;

grant execute on function public.delete_task_safe(uuid) to authenticated;

commit;
