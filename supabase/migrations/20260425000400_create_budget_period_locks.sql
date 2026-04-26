-- Manual monthly period lock for aggregated budget realization input.

begin;

create table if not exists public.fin_budget_period_locks (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null references public.fiscal_years (id) on update cascade on delete restrict,
  period_month integer not null,
  is_locked boolean not null default false,
  locked_by uuid null,
  locked_at timestamptz null,
  unlocked_by uuid null,
  unlocked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fin_budget_period_locks_period_month_check
    check (period_month between 1 and 12),
  constraint fin_budget_period_locks_fiscal_year_period_month_key
    unique (fiscal_year_id, period_month)
);

create index if not exists fin_budget_period_locks_fiscal_year_id_idx
  on public.fin_budget_period_locks (fiscal_year_id);

create index if not exists fin_budget_period_locks_period_month_idx
  on public.fin_budget_period_locks (period_month);

create index if not exists fin_budget_period_locks_is_locked_idx
  on public.fin_budget_period_locks (is_locked);

create or replace function public.fin_is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.auth_user_id = auth.uid()
      and upper(coalesce(u.status, '')) = 'ACTIVE'
      and coalesce(u.is_locked, false) = false
      and upper(coalesce(r.code, '')) = 'ADMIN'
  );
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

commit;
