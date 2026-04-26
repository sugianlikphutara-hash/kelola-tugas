-- Create RPC to handle Task Progress and Evidence (bypass direct RLS)
begin;

create or replace function public.create_task_progress_with_evidence(p_task_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_role_code text;
  v_existing_task public.tasks%rowtype;
  v_is_staf boolean := false;
  v_is_assignee boolean := false;
  
  -- Progress variables
  v_progress_percent numeric;
  v_report_date date;
  v_result_summary text;
  v_issue_summary text;
  v_next_step_summary text;
  v_reported_by_employee_id uuid;
  v_new_progress_report_id uuid;
  
  -- Evidence variables
  v_document_id uuid;
  v_document_exists boolean;
  v_new_task_document_id uuid;
  
  -- Sync variable
  v_highest_progress numeric;
  
  -- Return object
  v_result jsonb := '{}'::jsonb;
begin
  -- 1. Validate auth
  if v_auth_user_id is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  -- 2. Fetch role & employee_id
  select u.employee_id, upper(trim(r.code::text))
  into v_employee_id, v_role_code
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.auth_user_id = v_auth_user_id
    and upper(coalesce(u.status, '')) = 'ACTIVE'
    and coalesce(u.is_locked, false) = false
    and coalesce(r.is_active, false) = true
  limit 1;

  if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG', 'STAF') then
    raise exception 'Anda tidak memiliki izin untuk menginput progress/evidence.';
  end if;

  if v_role_code = 'STAF' then
    v_is_staf := true;
  end if;

  -- 3. Check if task exists
  select *
  into v_existing_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task tidak ditemukan.';
  end if;

  -- 4. Assignee Validation for STAF
  if v_is_staf then
    select exists (
      select 1 
      from public.task_assignments 
      where task_id = p_task_id 
        and employee_id = v_employee_id
    ) into v_is_assignee;
    
    if not v_is_assignee then
      raise exception 'STAF hanya boleh input progress untuk task yang di-assign kepadanya.';
    end if;
  end if;

  -- 5. Process Progress Data (if present)
  if p_payload ? 'progress_percent' and p_payload->>'progress_percent' is not null then
    v_progress_percent := (p_payload->>'progress_percent')::numeric;
    
    if v_progress_percent < 0 or v_progress_percent > 100 then
      raise exception 'Progress percent harus antara 0 sampai 100.';
    end if;
    
    v_report_date := coalesce((p_payload->>'report_date')::date, current_date);
    v_result_summary := trim(p_payload->>'result_summary');
    v_issue_summary := trim(p_payload->>'issue_summary');
    v_next_step_summary := trim(p_payload->>'next_step_summary');
    
    if p_payload ? 'reported_by_employee_id' and p_payload->>'reported_by_employee_id' is not null and trim(p_payload->>'reported_by_employee_id') <> '' then
      v_reported_by_employee_id := (p_payload->>'reported_by_employee_id')::uuid;
    else
      v_reported_by_employee_id := v_employee_id;
    end if;

    -- Insert into task_progress_reports
    insert into public.task_progress_reports (
      task_id,
      report_date,
      progress_percent,
      result_summary,
      issue_summary,
      next_step_summary,
      reported_by_employee_id
    ) values (
      p_task_id,
      v_report_date,
      v_progress_percent,
      nullif(v_result_summary, ''),
      nullif(v_issue_summary, ''),
      nullif(v_next_step_summary, ''),
      v_reported_by_employee_id
    ) returning id into v_new_progress_report_id;
    
    v_result := jsonb_set(v_result, '{progress_report_id}', to_jsonb(v_new_progress_report_id));
  end if;

  -- 6. Process Evidence Data (if present)
  if p_payload ? 'document_id' and p_payload->>'document_id' is not null and trim(p_payload->>'document_id') <> '' then
    v_document_id := (p_payload->>'document_id')::uuid;
    
    select exists (
      select 1 from public.documents where id = v_document_id
    ) into v_document_exists;
    
    if not v_document_exists then
      raise exception 'Document ID yang diberikan tidak valid / tidak ditemukan.';
    end if;
    
    -- Insert into task_documents
    insert into public.task_documents (
      task_id,
      document_id
    ) values (
      p_task_id,
      v_document_id
    ) returning id into v_new_task_document_id;
    
    v_result := jsonb_set(v_result, '{task_document_id}', to_jsonb(v_new_task_document_id));
  end if;

  -- 7. Sync tasks.progress_percent
  -- Cari progress tertinggi dari list task_progress_reports untuk task ini (berdasarkan urutan waktu dsb., kita ambil nilai terupdate/max aja).
  -- Dalam query sebelumnya, frontend mengambil laporan terbaru.
  -- Kita gunakan MAX progress saja atau sorting report_date descending? 
  -- Logic standar: ambil record terbaru berdasarkan report_date desc, created_at desc.
  select progress_percent
  into v_highest_progress
  from public.task_progress_reports
  where task_id = p_task_id
  order by report_date desc nulls last, created_at desc nulls last
  limit 1;
  
  if v_highest_progress is null then
    v_highest_progress := coalesce(v_existing_task.progress_percent, 0);
  end if;

  update public.tasks
  set progress_percent = v_highest_progress
  where id = p_task_id;
  
  v_result := jsonb_set(v_result, '{synced_progress_percent}', to_jsonb(v_highest_progress));

  return v_result;
end;
$$;

grant execute on function public.create_task_progress_with_evidence(uuid, jsonb) to authenticated;

commit;
