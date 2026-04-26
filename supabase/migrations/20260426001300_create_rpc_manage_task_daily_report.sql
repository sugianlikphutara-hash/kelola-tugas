-- Create RPC to manage Task daily reports safely (RLS-compatible)
begin;

create or replace function public.manage_task_daily_report(
  p_action text,
  p_report_id uuid default null,
  p_task_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.task_daily_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_role_code text;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_report public.task_daily_reports%rowtype;
  v_result public.task_daily_reports%rowtype;
  v_target_task_id uuid;
  v_report_date date;
  v_work_summary text;
  v_document_id uuid;
  v_document_link text;
  v_created_by_employee_id uuid;
  v_review_status text;
  v_review_notes text;
  v_is_assignee boolean := false;
  v_duplicate_report_id uuid;
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
    raise exception 'Anda tidak memiliki izin untuk mengelola laporan harian task.';
  end if;

  if v_action not in ('create', 'update', 'delete', 'review') then
    raise exception 'Aksi laporan harian tidak valid.';
  end if;

  -- 3. Fetch current report for actions that need it
  if v_action in ('update', 'delete', 'review') then
    if p_report_id is null then
      raise exception 'ID laporan harian wajib diisi.';
    end if;

    select *
    into v_report
    from public.task_daily_reports
    where id = p_report_id;

    if not found then
      raise exception 'Laporan harian task tidak ditemukan.';
    end if;
  end if;

  -- 4. Review is supervisor-only
  if v_action = 'review' then
    if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG') then
      raise exception 'STAF tidak memiliki izin untuk memeriksa laporan harian task.';
    end if;

    v_review_status := lower(trim(coalesce(p_payload->>'review_status', 'reviewed')));
    if v_review_status not in ('pending', 'reviewed') then
      raise exception 'Status pemeriksaan sub task tidak valid.';
    end if;

    v_review_notes := nullif(trim(coalesce(p_payload->>'review_notes', '')), '');

    update public.task_daily_reports
    set
      review_status = v_review_status,
      review_notes = v_review_notes,
      reviewed_at = case when v_review_status = 'reviewed' then now() else null end,
      reviewed_by_employee_id = case when v_review_status = 'reviewed' then v_employee_id else null end,
      updated_at = now()
    where id = p_report_id
    returning * into v_result;

    return v_result;
  end if;

  -- 5. Resolve target task
  if v_action = 'create' then
    v_target_task_id := p_task_id;
  elsif v_action = 'update' then
    v_target_task_id := coalesce(nullif(trim(p_payload->>'task_id'), '')::uuid, v_report.task_id);
  else
    v_target_task_id := v_report.task_id;
  end if;

  if v_target_task_id is null then
    raise exception 'Task ID wajib diisi.';
  end if;

  if not exists (select 1 from public.tasks where id = v_target_task_id) then
    raise exception 'Task tidak ditemukan.';
  end if;

  if v_role_code = 'STAF' then
    select exists (
      select 1
      from public.task_assignments
      where task_id = v_target_task_id
        and employee_id = v_employee_id
    ) into v_is_assignee;

    if not v_is_assignee then
      raise exception 'STAF hanya boleh mengelola laporan harian task yang di-assign kepadanya.';
    end if;
  end if;

  if v_action = 'delete' then
    delete from public.task_daily_reports
    where id = p_report_id
    returning * into v_result;

    return v_result;
  end if;

  -- 6. Prepare create/update fields
  v_report_date := coalesce((p_payload->>'report_date')::date, v_report.report_date);
  if v_report_date is null then
    raise exception 'Tanggal laporan harian wajib diisi.';
  end if;

  v_work_summary := trim(coalesce(p_payload->>'work_summary', v_report.work_summary, ''));
  if v_work_summary = '' then
    raise exception 'Ringkasan pekerjaan harian wajib diisi.';
  end if;

  if p_payload ? 'document_id' and p_payload->>'document_id' is not null and trim(p_payload->>'document_id') <> '' then
    v_document_id := (p_payload->>'document_id')::uuid;

    if not exists (select 1 from public.documents where id = v_document_id) then
      raise exception 'Document ID laporan harian tidak valid.';
    end if;

    v_document_link := null;
  else
    v_document_id := null;
    v_document_link := nullif(trim(coalesce(p_payload->>'document_link', '')), '');
  end if;

  if v_action = 'update' and not (p_payload ? 'document_id') and not (p_payload ? 'document_link') then
    v_document_id := v_report.document_id;
    v_document_link := v_report.document_link;
  end if;

  select id
  into v_duplicate_report_id
  from public.task_daily_reports
  where task_id = v_target_task_id
    and report_date = v_report_date
    and (v_action = 'create' or id <> p_report_id)
  limit 1;

  if v_duplicate_report_id is not null then
    raise exception 'Sub task untuk task dan tanggal tersebut sudah ada.';
  end if;

  if v_action = 'create' then
    if v_role_code = 'STAF' then
      v_created_by_employee_id := v_employee_id;
    elsif p_payload ? 'created_by_employee_id'
      and p_payload->>'created_by_employee_id' is not null
      and trim(p_payload->>'created_by_employee_id') <> '' then
      v_created_by_employee_id := (p_payload->>'created_by_employee_id')::uuid;
    else
      v_created_by_employee_id := v_employee_id;
    end if;

    insert into public.task_daily_reports (
      task_id,
      report_date,
      work_summary,
      document_id,
      document_link,
      created_by_employee_id
    ) values (
      v_target_task_id,
      v_report_date,
      v_work_summary,
      v_document_id,
      v_document_link,
      v_created_by_employee_id
    )
    returning * into v_result;
  else
    update public.task_daily_reports
    set
      task_id = v_target_task_id,
      report_date = v_report_date,
      work_summary = v_work_summary,
      document_id = v_document_id,
      document_link = v_document_link,
      updated_at = now()
    where id = p_report_id
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

grant execute on function public.manage_task_daily_report(text, uuid, uuid, jsonb) to authenticated;

commit;
