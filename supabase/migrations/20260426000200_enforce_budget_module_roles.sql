-- Role enforcement v1 for budget module writes.
-- Uses existing users/roles.role.code. No schema changes.

begin;

create or replace function public.fin_current_user_role_code()
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select upper(trim(r.code::text))
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.auth_user_id = auth.uid()
    and upper(coalesce(u.status, '')) = 'ACTIVE'
    and coalesce(u.is_locked, false) = false
    and coalesce(r.is_active, false) = true
  limit 1;
$function$;

create or replace function public.fin_current_user_has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from unnest(coalesce(p_roles, array[]::text[])) as allowed_role(role_code)
    where public.fin_current_user_role_code() = upper(trim(allowed_role.role_code))
  );
$function$;

create or replace function public.fin_is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.fin_current_user_has_role(array['ADMIN']);
$function$;

create or replace function public.fin_set_budget_period_lock(
  p_fiscal_year_id uuid,
  p_period_month integer,
  p_is_locked boolean
)
returns public.fin_budget_period_locks
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_lock public.fin_budget_period_locks%rowtype;
begin
  if p_fiscal_year_id is null then
    raise exception 'p_fiscal_year_id wajib diisi.';
  end if;

  if p_period_month is null or p_period_month < 1 or p_period_month > 12 then
    raise exception 'p_period_month harus berada pada range 1-12.';
  end if;

  if p_is_locked is null then
    raise exception 'p_is_locked wajib diisi.';
  end if;

  if v_auth_user_id is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  if not public.fin_is_current_user_admin() then
    raise exception 'Hanya Admin yang dapat mengunci atau membuka periode realisasi.';
  end if;

  if p_is_locked then
    insert into public.fin_budget_period_locks (
      fiscal_year_id,
      period_month,
      is_locked,
      locked_by,
      locked_at,
      updated_at
    )
    values (
      p_fiscal_year_id,
      p_period_month,
      true,
      v_auth_user_id,
      now(),
      now()
    )
    on conflict (fiscal_year_id, period_month)
    do update set
      is_locked = true,
      locked_by = excluded.locked_by,
      locked_at = excluded.locked_at,
      updated_at = now()
    returning * into v_lock;
  else
    insert into public.fin_budget_period_locks (
      fiscal_year_id,
      period_month,
      is_locked,
      unlocked_by,
      unlocked_at,
      updated_at
    )
    values (
      p_fiscal_year_id,
      p_period_month,
      false,
      v_auth_user_id,
      now(),
      now()
    )
    on conflict (fiscal_year_id, period_month)
    do update set
      is_locked = false,
      unlocked_by = excluded.unlocked_by,
      unlocked_at = excluded.unlocked_at,
      updated_at = now()
    returning * into v_lock;
  end if;

  return v_lock;
end;
$function$;

create or replace function public.fin_save_monthly_budget_realization(
  p_fiscal_year_id uuid,
  p_sub_activity_id uuid,
  p_budget_account_id uuid,
  p_rak_version_id uuid,
  p_period_month integer,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_realization_status_id uuid;
  v_fiscal_year integer;
  v_amount numeric := coalesce(p_amount, 0);
  v_old_amount numeric := 0;
  v_action_type text;
  v_realization_date date;
begin
  if auth.uid() is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  if not public.fin_current_user_has_role(array['ADMIN', 'KASI', 'KASUBAG', 'STAF']) then
    raise exception 'Anda tidak memiliki izin untuk mengubah realisasi.';
  end if;

  if p_fiscal_year_id is null then
    raise exception 'p_fiscal_year_id wajib diisi.';
  end if;

  if p_sub_activity_id is null then
    raise exception 'p_sub_activity_id wajib diisi.';
  end if;

  if p_budget_account_id is null then
    raise exception 'p_budget_account_id wajib diisi.';
  end if;

  if p_rak_version_id is null then
    raise exception 'p_rak_version_id wajib diisi.';
  end if;

  if p_period_month is null or p_period_month < 1 or p_period_month > 12 then
    raise exception 'p_period_month harus berada pada range 1-12.';
  end if;

  if v_amount < 0 then
    raise exception 'p_amount tidak boleh negatif.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        ':',
        p_fiscal_year_id::text,
        p_sub_activity_id::text,
        p_budget_account_id::text,
        p_rak_version_id::text,
        p_period_month::text
      ),
      0
    )
  );

  if exists (
    select 1
    from public.fin_budget_period_locks bpl
    where bpl.fiscal_year_id = p_fiscal_year_id
      and bpl.period_month = p_period_month
      and bpl.is_locked = true
  ) then
    raise exception 'Periode realisasi bulan ini sudah dikunci.';
  end if;

  select fy.year::integer
    into v_fiscal_year
  from public.fiscal_years fy
  where fy.id = p_fiscal_year_id;

  if v_fiscal_year is null then
    raise exception 'Fiscal year tidak ditemukan: %', p_fiscal_year_id;
  end if;

  select coalesce(sum(br.amount), 0)
    into v_old_amount
  from public.fin_budget_realizations br
  where br.fiscal_year_id = p_fiscal_year_id
    and br.sub_activity_id = p_sub_activity_id
    and br.budget_account_id = p_budget_account_id
    and br.period_month = p_period_month
    and br.rak_version_id_snapshot = p_rak_version_id;

  if v_old_amount = v_amount then
    return;
  end if;

  if v_old_amount = 0 and v_amount > 0 then
    v_action_type := 'CREATE';
  elsif v_old_amount > 0 and v_amount > 0 then
    v_action_type := 'UPDATE';
  elsif v_old_amount > 0 and v_amount = 0 then
    v_action_type := 'DELETE';
  else
    return;
  end if;

  insert into public.fin_budget_realization_audit_logs (
    fiscal_year_id,
    sub_activity_id,
    budget_account_id,
    rak_version_id_snapshot,
    period_month,
    old_amount,
    new_amount,
    action_type,
    changed_by
  )
  values (
    p_fiscal_year_id,
    p_sub_activity_id,
    p_budget_account_id,
    p_rak_version_id,
    p_period_month,
    v_old_amount,
    v_amount,
    v_action_type,
    auth.uid()
  );

  delete from public.fin_budget_realizations br
  where br.fiscal_year_id = p_fiscal_year_id
    and br.sub_activity_id = p_sub_activity_id
    and br.budget_account_id = p_budget_account_id
    and br.period_month = p_period_month
    and br.rak_version_id_snapshot = p_rak_version_id;

  if v_amount > 0 then
    select brs.id
      into v_realization_status_id
    from public.fin_budget_realization_statuses brs
    where brs.is_active = true
    order by brs.sort_order asc, brs.code asc
    limit 1;

    if v_realization_status_id is null then
      raise exception 'Status realisasi aktif/default tidak ditemukan.';
    end if;

    v_realization_date := make_date(v_fiscal_year, p_period_month, 1);

    insert into public.fin_budget_realizations (
      fiscal_year_id,
      sub_activity_id,
      budget_account_id,
      rak_version_id_snapshot,
      realization_status_id,
      realization_date,
      period_month,
      amount,
      description
    )
    values (
      p_fiscal_year_id,
      p_sub_activity_id,
      p_budget_account_id,
      p_rak_version_id,
      v_realization_status_id,
      v_realization_date,
      p_period_month,
      v_amount,
      null
    );
  end if;
end;
$function$;

create or replace function public.fin_activate_rak_version(
  p_rak_version_id uuid,
  p_approved_by uuid default null::uuid
)
returns uuid
language plpgsql
as $function$
declare
  v_target_rak public.fin_rak_versions%rowtype;
begin
  if auth.uid() is null or not public.fin_current_user_has_role(array['ADMIN']) then
    raise exception 'Anda tidak memiliki izin untuk mengelola versi RAK.';
  end if;

  select *
  into v_target_rak
  from public.fin_rak_versions
  where id = p_rak_version_id;

  if not found then
    raise exception 'RAK version not found: %', p_rak_version_id;
  end if;

  update public.fin_rak_versions
  set
    is_active = false,
    status = 'ARCHIVED',
    updated_at = now()
  where fiscal_year_id = v_target_rak.fiscal_year_id
    and is_active = true
    and id <> p_rak_version_id;

  update public.fin_rak_versions
  set
    is_active = true,
    status = 'ACTIVE',
    approved_by = coalesce(p_approved_by, approved_by),
    approved_at = now(),
    updated_at = now()
  where id = p_rak_version_id;

  return p_rak_version_id;
end;
$function$;

create or replace function public.fin_clone_rak_version(
  p_source_rak_version_id uuid,
  p_new_code character varying,
  p_new_rak_date date,
  p_new_title character varying default null::character varying,
  p_new_notes text default null::text,
  p_created_by uuid default null::uuid
)
returns uuid
language plpgsql
as $function$
declare
  v_source_rak public.fin_rak_versions%rowtype;
  v_new_rak_version_id uuid;
  v_new_version_number integer;
  v_new_rak_sub_activity_id uuid;
  v_new_rak_budget_item_id uuid;
  v_sub record;
  v_item record;
  v_detail record;
begin
  if auth.uid() is null or not public.fin_current_user_has_role(array['ADMIN']) then
    raise exception 'Anda tidak memiliki izin untuk mengelola versi RAK.';
  end if;

  select *
  into v_source_rak
  from public.fin_rak_versions
  where id = p_source_rak_version_id;

  if not found then
    raise exception 'Source RAK version not found: %', p_source_rak_version_id;
  end if;

  if exists (
    select 1
    from public.fin_rak_versions
    where fiscal_year_id = v_source_rak.fiscal_year_id
      and code = p_new_code
  ) then
    raise exception 'RAK code % already exists in the same fiscal year', p_new_code;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_new_version_number
  from public.fin_rak_versions
  where fiscal_year_id = v_source_rak.fiscal_year_id;

  insert into public.fin_rak_versions (
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
    approved_at
  )
  values (
    v_source_rak.fiscal_year_id,
    p_new_code,
    v_new_version_number,
    p_new_title,
    p_new_rak_date,
    v_source_rak.id,
    'DRAFT',
    false,
    p_new_notes,
    p_created_by,
    null,
    null
  )
  returning id into v_new_rak_version_id;

  create temporary table if not exists pg_temp.tmp_fin_rak_sub_activity_map (
    old_id uuid,
    new_id uuid
  ) on commit drop;

  truncate table pg_temp.tmp_fin_rak_sub_activity_map;

  for v_sub in
    select *
    from public.fin_rak_sub_activities
    where rak_version_id = p_source_rak_version_id
    order by created_at, id
  loop
    insert into public.fin_rak_sub_activities (
      rak_version_id,
      sub_activity_id,
      sub_activity_status_id,
      remarks
    )
    values (
      v_new_rak_version_id,
      v_sub.sub_activity_id,
      v_sub.sub_activity_status_id,
      v_sub.remarks
    )
    returning id into v_new_rak_sub_activity_id;

    insert into pg_temp.tmp_fin_rak_sub_activity_map (old_id, new_id)
    values (v_sub.id, v_new_rak_sub_activity_id);
  end loop;

  create temporary table if not exists pg_temp.tmp_fin_rak_budget_item_map (
    old_id uuid,
    new_id uuid
  ) on commit drop;

  truncate table pg_temp.tmp_fin_rak_budget_item_map;

  for v_item in
    select rbi.*
    from public.fin_rak_budget_items rbi
    where rbi.rak_version_id = p_source_rak_version_id
    order by rbi.created_at, rbi.id
  loop
    insert into public.fin_rak_budget_items (
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
      remarks
    )
    values (
      v_new_rak_version_id,
      (select m.new_id from pg_temp.tmp_fin_rak_sub_activity_map m where m.old_id = v_item.rak_sub_activity_id),
      v_item.budget_account_id,
      v_item.item_change_status_id,
      v_item.annual_amount,
      v_item.jan_amount,
      v_item.feb_amount,
      v_item.mar_amount,
      v_item.apr_amount,
      v_item.may_amount,
      v_item.jun_amount,
      v_item.jul_amount,
      v_item.aug_amount,
      v_item.sep_amount,
      v_item.oct_amount,
      v_item.nov_amount,
      v_item.dec_amount,
      v_item.remarks
    )
    returning id into v_new_rak_budget_item_id;

    insert into pg_temp.tmp_fin_rak_budget_item_map (old_id, new_id)
    values (v_item.id, v_new_rak_budget_item_id);
  end loop;

  for v_detail in
    select d.*
    from public.fin_rak_budget_item_details d
    join pg_temp.tmp_fin_rak_budget_item_map m
      on m.old_id = d.rak_budget_item_id
    order by d.created_at, d.id
  loop
    insert into public.fin_rak_budget_item_details (
      rak_budget_item_id,
      item_name,
      specification,
      volume,
      unit,
      unit_price,
      ppn_percent,
      total_amount,
      source_document_type,
      remarks
    )
    values (
      (select m.new_id from pg_temp.tmp_fin_rak_budget_item_map m where m.old_id = v_detail.rak_budget_item_id),
      v_detail.item_name,
      v_detail.specification,
      v_detail.volume,
      v_detail.unit,
      v_detail.unit_price,
      v_detail.ppn_percent,
      v_detail.total_amount,
      v_detail.source_document_type,
      v_detail.remarks
    );
  end loop;

  return v_new_rak_version_id;
end;
$function$;

commit;
