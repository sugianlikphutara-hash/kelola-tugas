-- Create RPC to handle Task Follow-up
begin;

create or replace function public.manage_task_follow_up(
  p_action text,
  p_task_id uuid,
  p_follow_up_id uuid,
  p_payload jsonb
)
returns public.task_follow_ups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_role_code text;
  v_result public.task_follow_ups;
  v_is_assignee boolean := false;
  v_normalized_action text := lower(trim(p_action));
  v_is_followed_up boolean;
  v_target_task_id uuid;
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

  if v_employee_id is null then
    raise exception 'Profil pegawai user tidak ditemukan.';
  end if;

  if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG', 'STAF') then
    raise exception 'Anda tidak memiliki izin untuk mengelola follow-up.';
  end if;

  -- 3. Action: create
  if v_normalized_action = 'create' then
    if p_task_id is null then
      raise exception 'Task ID wajib diisi untuk membuat follow-up.';
    end if;

    if v_role_code = 'STAF' then
        -- Mirroring existing rule: STAF can create if assigned
        select exists (
          select 1 
          from public.task_assignments 
          where task_id = p_task_id 
            and employee_id = v_employee_id
        ) into v_is_assignee;
        
        if not v_is_assignee then
          raise exception 'STAF hanya boleh membuat follow-up untuk task yang di-assign kepadanya.';
        end if;
    end if;

    insert into public.task_follow_ups (
      task_id,
      note_text,
      created_by_employee_id,
      is_followed_up,
      followed_up_at,
      followed_up_by_employee_id,
      notes
    ) values (
      p_task_id,
      trim(p_payload->>'note_text'),
      v_employee_id,
      false,
      null,
      null,
      nullif(trim(p_payload->>'notes'), '')
    )
    returning * into v_result;

  -- 4. Action: update_status
  elsif v_normalized_action = 'update_status' then
    if p_follow_up_id is null then
        raise exception 'Follow-up ID wajib diisi untuk update status.';
    end if;

    v_is_followed_up := (p_payload->>'is_followed_up')::boolean;

    -- Fetch target follow-up and its task_id
    select task_id into v_target_task_id from public.task_follow_ups where id = p_follow_up_id;
    
    if not found then
      raise exception 'Follow-up tidak ditemukan.';
    end if;

    if v_role_code = 'STAF' then
        -- Only allow mark done (true)
        if v_is_followed_up = false then
            raise exception 'STAF tidak memiliki izin untuk membuka kembali (reopen) follow-up.';
        end if;

        -- Check assignment
        select exists (
          select 1 
          from public.task_assignments 
          where task_id = v_target_task_id
            and employee_id = v_employee_id
        ) into v_is_assignee;
        
        if not v_is_assignee then
          raise exception 'STAF hanya boleh menindaklanjuti follow-up untuk task yang di-assign kepadanya.';
        end if;
    end if;

    update public.task_follow_ups
    set
      is_followed_up = v_is_followed_up,
      followed_up_at = case when v_is_followed_up then now() else null end,
      followed_up_by_employee_id = case when v_is_followed_up then v_employee_id else null end
    where id = p_follow_up_id
    returning * into v_result;

  else
    raise exception 'Aksi tidak valid.';
  end if;

  return v_result;
end;
$$;

grant execute on function public.manage_task_follow_up(text, uuid, uuid, jsonb) to authenticated;

commit;
