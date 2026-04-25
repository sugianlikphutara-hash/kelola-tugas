-- Audit trail v1 for aggregated monthly budget realization saves.
-- Audit is recorded inside fin_save_monthly_budget_realization so replace writes stay atomic.

begin;

create table if not exists public.fin_budget_realization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null,
  sub_activity_id uuid not null,
  budget_account_id uuid not null,
  rak_version_id_snapshot uuid not null,
  period_month integer not null,
  old_amount numeric not null default 0,
  new_amount numeric not null default 0,
  action_type text not null,
  changed_by uuid null,
  changed_at timestamptz not null default now(),
  constraint fin_budget_realization_audit_logs_period_month_check
    check (period_month between 1 and 12),
  constraint fin_budget_realization_audit_logs_action_type_check
    check (action_type in ('CREATE', 'UPDATE', 'DELETE')),
  constraint fin_budget_realization_audit_logs_old_amount_check
    check (old_amount >= 0),
  constraint fin_budget_realization_audit_logs_new_amount_check
    check (new_amount >= 0)
);

create index if not exists fin_budget_realization_audit_logs_fiscal_year_id_idx
  on public.fin_budget_realization_audit_logs (fiscal_year_id);

create index if not exists fin_budget_realization_audit_logs_sub_activity_id_idx
  on public.fin_budget_realization_audit_logs (sub_activity_id);

create index if not exists fin_budget_realization_audit_logs_budget_account_id_idx
  on public.fin_budget_realization_audit_logs (budget_account_id);

create index if not exists fin_budget_realization_audit_logs_rak_version_snapshot_idx
  on public.fin_budget_realization_audit_logs (rak_version_id_snapshot);

create index if not exists fin_budget_realization_audit_logs_period_month_idx
  on public.fin_budget_realization_audit_logs (period_month);

create index if not exists fin_budget_realization_audit_logs_changed_at_desc_idx
  on public.fin_budget_realization_audit_logs (changed_at desc);

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
