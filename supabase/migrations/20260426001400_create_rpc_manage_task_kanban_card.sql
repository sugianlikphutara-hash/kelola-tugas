-- Create RPC to manage Task Kanban cards safely (RLS-compatible)
begin;

create or replace function public.manage_task_kanban_card(
  p_action text,
  p_task_id uuid,
  p_target_column_id uuid default null,
  p_target_sort_order integer default null,
  p_status_id uuid default null,
  p_approval_status text default null
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
  v_task public.tasks%rowtype;
  v_current_card public.kanban_cards%rowtype;
  v_result_card public.kanban_cards%rowtype;
  v_target_column public.kanban_columns%rowtype;
  v_status public.master_statuses%rowtype;
  v_status_id uuid;
  v_status_code text;
  v_approval_status text;
  v_sort_order integer;
  v_is_assignee boolean := false;
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
    raise exception 'Anda tidak memiliki izin untuk mengelola kartu kanban task.';
  end if;

  if v_action not in ('move', 'sync', 'delete') then
    raise exception 'Aksi kartu kanban tidak valid.';
  end if;

  -- 3. Validate task
  select *
  into v_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task tidak ditemukan.';
  end if;

  if v_role_code = 'STAF' then
    select exists (
      select 1
      from public.task_assignments
      where task_id = p_task_id
        and employee_id = v_employee_id
    ) into v_is_assignee;

    if not v_is_assignee then
      raise exception 'STAF hanya boleh mengelola kartu kanban task yang di-assign kepadanya.';
    end if;
  end if;

  select *
  into v_current_card
  from public.kanban_cards
  where entity_type = 'task'
    and entity_id = p_task_id
  limit 1;

  if v_action = 'delete' then
    if found then
      delete from public.kanban_cards
      where id = v_current_card.id
      returning * into v_result_card;
    end if;

    return jsonb_build_object(
      'action', v_action,
      'task_id', p_task_id,
      'card', to_jsonb(v_result_card)
    );
  end if;

  -- 4. Resolve status and target column
  if v_action = 'move' then
    if p_target_column_id is null then
      raise exception 'Kolom tujuan kanban wajib diisi.';
    end if;

    select *
    into v_target_column
    from public.kanban_columns
    where id = p_target_column_id
      and module_name = 'task';

    if not found then
      raise exception 'Kolom tujuan kanban tidak valid.';
    end if;

    select *
    into v_status
    from public.master_statuses
    where lower(coalesce(category, '')) = 'task'
      and code = v_target_column.code
      and coalesce(is_active, true) = true
    limit 1;

    if not found then
      raise exception 'Status tujuan task tidak valid.';
    end if;

    v_status_id := v_status.id;
    v_status_code := v_status.code;
  else
    v_status_id := coalesce(p_status_id, v_task.status_id);
    v_approval_status := lower(trim(coalesce(p_approval_status, v_task.approval_status, '')));

    if v_status_id is null then
      return jsonb_build_object('action', v_action, 'task_id', p_task_id, 'card', null);
    end if;

    select *
    into v_status
    from public.master_statuses
    where id = v_status_id
      and lower(coalesce(category, '')) = 'task'
      and coalesce(is_active, true) = true
    limit 1;

    if not found then
      return jsonb_build_object('action', v_action, 'task_id', p_task_id, 'card', null);
    end if;

    v_status_code := v_status.code;

    if v_approval_status <> 'approved' or lower(coalesce(v_status_code, '')) = 'dibatalkan' then
      if v_current_card.id is not null then
        delete from public.kanban_cards
        where id = v_current_card.id
        returning * into v_result_card;
      end if;

      return jsonb_build_object(
        'action', v_action,
        'task_id', p_task_id,
        'card', to_jsonb(v_result_card)
      );
    end if;

    select *
    into v_target_column
    from public.kanban_columns
    where module_name = 'task'
      and code = v_status_code
    limit 1;

    if not found then
      return jsonb_build_object('action', v_action, 'task_id', p_task_id, 'card', null);
    end if;
  end if;

  v_sort_order := p_target_sort_order;
  if v_sort_order is null then
    select coalesce(max(sort_order), 0) + 1
    into v_sort_order
    from public.kanban_cards
    where entity_type = 'task'
      and column_id = v_target_column.id;
  end if;

  if v_current_card.id is not null then
    update public.kanban_cards
    set
      column_id = v_target_column.id,
      sort_order = v_sort_order,
      updated_at = now()
    where id = v_current_card.id
    returning * into v_result_card;
  else
    insert into public.kanban_cards (
      entity_type,
      entity_id,
      column_id,
      sort_order
    ) values (
      'task',
      p_task_id,
      v_target_column.id,
      v_sort_order
    )
    returning * into v_result_card;
  end if;

  if v_action = 'move' then
    update public.tasks
    set
      status_id = v_status_id,
      updated_at = now()
    where id = p_task_id;
  end if;

  return jsonb_build_object(
    'action', v_action,
    'task_id', p_task_id,
    'status_id', v_status_id,
    'status_code', v_status_code,
    'card', to_jsonb(v_result_card)
  );
end;
$$;

grant execute on function public.manage_task_kanban_card(text, uuid, uuid, integer, uuid, text) to authenticated;

commit;
