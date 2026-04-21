-- Fase RAK versioning:
-- 1. clone versi lama menjadi draft versi baru
-- 2. aktivasi versi draft dengan guardrail snapshot
-- 3. menjaga child rows RAK hanya bisa diubah pada versi draft
-- 4. menyediakan view sederhana untuk membaca versi aktif

begin;

create or replace view public.fin_v_active_rak_versions as
select *
from public.fin_rak_versions
where is_active = true
  and status = 'ACTIVE';

create or replace function public.fin_assert_rak_version_is_draft(p_rak_version_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_is_active boolean;
begin
  select rv.status, rv.is_active
    into v_status, v_is_active
  from public.fin_rak_versions rv
  where rv.id = p_rak_version_id;

  if v_status is null then
    raise exception 'rak_version_id % not found', p_rak_version_id;
  end if;

  if v_status <> 'DRAFT' or v_is_active then
    raise exception 'rak_version_id % is not editable because status=% and is_active=%',
      p_rak_version_id,
      v_status,
      coalesce(v_is_active, false);
  end if;
end;
$$;

create or replace function public.fin_trg_fin_rak_sub_activities_assert_draft()
returns trigger
language plpgsql
as $$
begin
  perform public.fin_assert_rak_version_is_draft(coalesce(new.rak_version_id, old.rak_version_id));
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fin_rak_sub_activities_assert_draft on public.fin_rak_sub_activities;

create trigger trg_fin_rak_sub_activities_assert_draft
before insert or update or delete on public.fin_rak_sub_activities
for each row execute function public.fin_trg_fin_rak_sub_activities_assert_draft();

create or replace function public.fin_trg_fin_rak_budget_items_assert_draft()
returns trigger
language plpgsql
as $$
declare
  v_rak_version_id uuid;
begin
  v_rak_version_id := coalesce(
    new.rak_version_id,
    old.rak_version_id
  );

  if v_rak_version_id is null then
    select rsa.rak_version_id
      into v_rak_version_id
    from public.fin_rak_sub_activities rsa
    where rsa.id = coalesce(new.rak_sub_activity_id, old.rak_sub_activity_id);
  end if;

  perform public.fin_assert_rak_version_is_draft(v_rak_version_id);
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fin_rak_budget_items_assert_draft on public.fin_rak_budget_items;

create trigger trg_fin_rak_budget_items_assert_draft
before insert or update or delete on public.fin_rak_budget_items
for each row execute function public.fin_trg_fin_rak_budget_items_assert_draft();

create or replace function public.fin_trg_fin_rak_budget_item_details_assert_draft()
returns trigger
language plpgsql
as $$
declare
  v_rak_version_id uuid;
begin
  select rbi.rak_version_id
    into v_rak_version_id
  from public.fin_rak_budget_items rbi
  where rbi.id = coalesce(new.rak_budget_item_id, old.rak_budget_item_id);

  perform public.fin_assert_rak_version_is_draft(v_rak_version_id);
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fin_rak_budget_item_details_assert_draft on public.fin_rak_budget_item_details;

create trigger trg_fin_rak_budget_item_details_assert_draft
before insert or update or delete on public.fin_rak_budget_item_details
for each row execute function public.fin_trg_fin_rak_budget_item_details_assert_draft();

create or replace function public.fin_clone_rak_version(
  p_source_rak_version_id uuid,
  p_new_code text default null,
  p_new_title text default null,
  p_new_rak_date date default null,
  p_notes text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_source public.fin_rak_versions%rowtype;
  v_new_rak_version_id uuid;
  v_new_rak_date date;
  v_new_version_number integer;
  v_new_code text;
  v_new_title text;
  v_detail_copy_columns text;
  v_detail_select_columns text;
begin
  select *
    into v_source
  from public.fin_rak_versions rv
  where rv.id = p_source_rak_version_id;

  if v_source.id is null then
    raise exception 'source rak_version_id % not found', p_source_rak_version_id;
  end if;

  v_new_rak_date := coalesce(p_new_rak_date, current_date);

  select coalesce(max(rv.version_number), 0) + 1
    into v_new_version_number
  from public.fin_rak_versions rv
  where rv.fiscal_year_id = v_source.fiscal_year_id;

  v_new_code := coalesce(
    nullif(trim(p_new_code), ''),
    'RAK-' || to_char(v_new_rak_date, 'YYYYMMDD') || '-V' || v_new_version_number
  );

  v_new_title := coalesce(
    nullif(trim(p_new_title), ''),
    coalesce(v_source.title, v_source.code, 'RAK') || ' Rev ' || v_new_version_number
  );

  create temporary table if not exists tmp_fin_rak_sub_activity_clone_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  truncate table tmp_fin_rak_sub_activity_clone_map;

  create temporary table if not exists tmp_fin_rak_budget_item_clone_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  truncate table tmp_fin_rak_budget_item_clone_map;

  insert into public.fin_rak_versions (
    id,
    fiscal_year_id,
    code,
    version_number,
    title,
    rak_date,
    previous_rak_version_id,
    status,
    is_active,
    notes,
    created_by,
    approved_by,
    approved_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_source.fiscal_year_id,
    v_new_code,
    v_new_version_number,
    v_new_title,
    v_new_rak_date,
    v_source.id,
    'DRAFT',
    false,
    coalesce(p_notes, v_source.notes),
    coalesce(p_created_by, v_source.created_by),
    null,
    null,
    now(),
    now()
  )
  returning id into v_new_rak_version_id;

  insert into public.fin_rak_sub_activities (
    id,
    rak_version_id,
    sub_activity_id,
    sub_activity_status_id,
    remarks,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    v_new_rak_version_id,
    rsa.sub_activity_id,
    rsa.sub_activity_status_id,
    rsa.remarks,
    now(),
    now()
  from public.fin_rak_sub_activities rsa
  where rsa.rak_version_id = v_source.id;

  insert into tmp_fin_rak_sub_activity_clone_map (old_id, new_id)
  select old_rsa.id, new_rsa.id
  from public.fin_rak_sub_activities old_rsa
  join public.fin_rak_sub_activities new_rsa
    on new_rsa.rak_version_id = v_new_rak_version_id
   and new_rsa.sub_activity_id = old_rsa.sub_activity_id
  where old_rsa.rak_version_id = v_source.id;

  insert into public.fin_rak_budget_items (
    id,
    rak_version_id,
    rak_sub_activity_id,
    budget_account_id,
    item_change_status_id,
    annual_amount,
    jan_amount,
    feb_amount,
    mar_amount,
    apr_amount,
    may_amount,
    jun_amount,
    jul_amount,
    aug_amount,
    sep_amount,
    oct_amount,
    nov_amount,
    dec_amount,
    remarks,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    v_new_rak_version_id,
    map.new_id,
    rbi.budget_account_id,
    rbi.item_change_status_id,
    rbi.annual_amount,
    rbi.jan_amount,
    rbi.feb_amount,
    rbi.mar_amount,
    rbi.apr_amount,
    rbi.may_amount,
    rbi.jun_amount,
    rbi.jul_amount,
    rbi.aug_amount,
    rbi.sep_amount,
    rbi.oct_amount,
    rbi.nov_amount,
    rbi.dec_amount,
    rbi.remarks,
    now(),
    now()
  from public.fin_rak_budget_items rbi
  join tmp_fin_rak_sub_activity_clone_map map
    on map.old_id = rbi.rak_sub_activity_id;

  insert into tmp_fin_rak_budget_item_clone_map (old_id, new_id)
  select old_rbi.id, new_rbi.id
  from public.fin_rak_budget_items old_rbi
  join tmp_fin_rak_sub_activity_clone_map rsa_map
    on rsa_map.old_id = old_rbi.rak_sub_activity_id
  join public.fin_rak_budget_items new_rbi
    on new_rbi.rak_sub_activity_id = rsa_map.new_id
   and new_rbi.budget_account_id = old_rbi.budget_account_id
  where old_rbi.rak_version_id = v_source.id;

  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position),
         string_agg(
           case
             when c.column_name in ('created_at', 'updated_at') then 'now()'
             else 'd.' || quote_ident(c.column_name)
           end,
           ', ' order by c.ordinal_position
         )
    into v_detail_copy_columns, v_detail_select_columns
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'fin_rak_budget_item_details'
    and c.column_name not in ('id', 'rak_budget_item_id');

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'fin_rak_budget_item_details'
      and c.column_name = 'rak_budget_item_id'
  ) then
    execute format(
      'insert into public.fin_rak_budget_item_details (id, rak_budget_item_id%s%s)
       select gen_random_uuid(), map.new_id%s%s
       from public.fin_rak_budget_item_details d
       join tmp_fin_rak_budget_item_clone_map map on map.old_id = d.rak_budget_item_id',
      case when v_detail_copy_columns is not null then ', ' else '' end,
      coalesce(v_detail_copy_columns, ''),
      case when v_detail_select_columns is not null then ', ' else '' end,
      coalesce(v_detail_select_columns, '')
    );
  end if;

  return v_new_rak_version_id;
end;
$$;

create or replace function public.fin_activate_rak_version(
  p_rak_version_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_target public.fin_rak_versions%rowtype;
  v_invalid_item_count integer;
  v_empty_sub_activity_count integer;
  v_inconsistent_item_count integer;
begin
  select *
    into v_target
  from public.fin_rak_versions rv
  where rv.id = p_rak_version_id;

  if v_target.id is null then
    raise exception 'rak_version_id % not found', p_rak_version_id;
  end if;

  select count(*)
    into v_empty_sub_activity_count
  from public.fin_rak_sub_activities rsa
  where rsa.rak_version_id = p_rak_version_id
    and not exists (
      select 1
      from public.fin_rak_budget_items rbi
      where rbi.rak_sub_activity_id = rsa.id
    );

  if v_empty_sub_activity_count > 0 then
    raise exception 'rak_version_id % has sub activities without budget items', p_rak_version_id;
  end if;

  select count(*)
    into v_invalid_item_count
  from public.fin_rak_budget_items rbi
  join public.fin_budget_accounts ba on ba.id = rbi.budget_account_id
  join public.fin_budget_levels bl on bl.id = ba.budget_level_id
  where rbi.rak_version_id = p_rak_version_id
    and not (
      ba.is_active = true
      and ba.is_leaf = true
      and bl.level_number = 5
    );

  if v_invalid_item_count > 0 then
    raise exception 'rak_version_id % contains budget items that are not active leaf level-5 accounts', p_rak_version_id;
  end if;

  select count(*)
    into v_inconsistent_item_count
  from public.fin_rak_budget_items rbi
  where rbi.rak_version_id = p_rak_version_id
    and coalesce(rbi.annual_amount, 0) <> (
      coalesce(rbi.jan_amount, 0) +
      coalesce(rbi.feb_amount, 0) +
      coalesce(rbi.mar_amount, 0) +
      coalesce(rbi.apr_amount, 0) +
      coalesce(rbi.may_amount, 0) +
      coalesce(rbi.jun_amount, 0) +
      coalesce(rbi.jul_amount, 0) +
      coalesce(rbi.aug_amount, 0) +
      coalesce(rbi.sep_amount, 0) +
      coalesce(rbi.oct_amount, 0) +
      coalesce(rbi.nov_amount, 0) +
      coalesce(rbi.dec_amount, 0)
    );

  if v_inconsistent_item_count > 0 then
    raise exception 'rak_version_id % has budget items with annual_amount not equal to total Jan-Dec', p_rak_version_id;
  end if;

  update public.fin_rak_versions
  set is_active = false,
      status = case when id = p_rak_version_id then status else 'ARCHIVED' end,
      updated_at = now()
  where fiscal_year_id = v_target.fiscal_year_id
    and id <> p_rak_version_id
    and is_active = true;

  update public.fin_rak_versions
  set is_active = true,
      status = 'ACTIVE',
      approved_at = coalesce(approved_at, now()),
      updated_at = now()
  where id = p_rak_version_id;

  return p_rak_version_id;
end;
$$;

commit;
