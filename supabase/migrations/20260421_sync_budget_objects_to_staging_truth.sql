-- 20260421_sync_budget_objects_to_staging_truth.sql
-- Sync patch for budget objects whose STAGING definitions have been verified.

begin;

create table if not exists public.fin_rak_budget_item_details (
  id uuid primary key default gen_random_uuid(),
  rak_budget_item_id uuid not null,
  item_name varchar null,
  specification text null,
  volume numeric null,
  unit varchar null,
  unit_price numeric null,
  ppn_percent numeric not null default 0,
  total_amount numeric not null default 0,
  source_document_type varchar not null default 'DPA',
  remarks text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fin_rak_budget_item_details
  add column if not exists item_name varchar null,
  add column if not exists specification text null,
  add column if not exists volume numeric null,
  add column if not exists unit varchar null,
  add column if not exists unit_price numeric null,
  add column if not exists ppn_percent numeric not null default 0,
  add column if not exists total_amount numeric not null default 0,
  add column if not exists source_document_type varchar not null default 'DPA',
  add column if not exists remarks text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.fin_rak_budget_item_details
  alter column rak_budget_item_id set not null,
  alter column ppn_percent set default 0,
  alter column ppn_percent set not null,
  alter column total_amount set default 0,
  alter column total_amount set not null,
  alter column source_document_type set default 'DPA',
  alter column source_document_type set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_rak_budget_item_details_rak_budget_item_fk'
      and conrelid = 'public.fin_rak_budget_item_details'::regclass
  ) then
    alter table public.fin_rak_budget_item_details
      add constraint fin_rak_budget_item_details_rak_budget_item_fk
      foreign key (rak_budget_item_id)
      references public.fin_rak_budget_items(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_fin_rak_budget_item_details_rak_budget_item_id
  on public.fin_rak_budget_item_details (rak_budget_item_id);

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

create or replace view public.fin_v_tracking_rak_changes as
with version_pairs as (
  select
    new_rv.id as new_rak_version_id,
    new_rv.code as new_rak_code,
    old_rv.id as old_rak_version_id,
    old_rv.code as old_rak_code,
    new_rv.fiscal_year_id
  from fin_rak_versions new_rv
  left join fin_rak_versions old_rv on old_rv.id = new_rv.previous_rak_version_id
),
old_items as (
  select
    vp.new_rak_version_id,
    vp.new_rak_code,
    vp.old_rak_version_id,
    vp.old_rak_code,
    rsa.sub_activity_id,
    rbi.budget_account_id,
    rbi.annual_amount as old_annual_amount
  from version_pairs vp
  join fin_rak_sub_activities rsa on rsa.rak_version_id = vp.old_rak_version_id
  join fin_rak_budget_items rbi on rbi.rak_sub_activity_id = rsa.id
),
new_items as (
  select
    vp.new_rak_version_id,
    vp.new_rak_code,
    vp.old_rak_version_id,
    vp.old_rak_code,
    rsa.sub_activity_id,
    rbi.budget_account_id,
    rbi.annual_amount as new_annual_amount,
    bics.code as item_change_status_code
  from version_pairs vp
  join fin_rak_sub_activities rsa on rsa.rak_version_id = vp.new_rak_version_id
  join fin_rak_budget_items rbi on rbi.rak_sub_activity_id = rsa.id
  join fin_budget_item_change_statuses bics on bics.id = rbi.item_change_status_id
)
select
  coalesce(n.new_rak_version_id, o.new_rak_version_id) as new_rak_version_id,
  coalesce(n.new_rak_code, o.new_rak_code) as new_rak_code,
  coalesce(n.old_rak_version_id, o.old_rak_version_id) as old_rak_version_id,
  coalesce(n.old_rak_code, o.old_rak_code) as old_rak_code,
  coalesce(n.sub_activity_id, o.sub_activity_id) as sub_activity_id,
  sa.code as sub_activity_code,
  sa.name as sub_activity_name,
  coalesce(n.budget_account_id, o.budget_account_id) as budget_account_id,
  ba.code as budget_account_code,
  ba.name as budget_account_name,
  coalesce(o.old_annual_amount, 0::numeric) as old_annual_amount,
  coalesce(n.new_annual_amount, 0::numeric) as new_annual_amount,
  coalesce(n.new_annual_amount, 0::numeric) - coalesce(o.old_annual_amount, 0::numeric) as difference_amount,
  case
    when coalesce(o.old_annual_amount, 0::numeric) = 0::numeric then null::numeric
    else round((coalesce(n.new_annual_amount, 0::numeric) - coalesce(o.old_annual_amount, 0::numeric)) / o.old_annual_amount * 100::numeric, 2)
  end as difference_percent,
  coalesce(
    n.item_change_status_code,
    case
      when coalesce(o.old_annual_amount, 0::numeric) = 0::numeric and coalesce(n.new_annual_amount, 0::numeric) > 0::numeric then 'BARU'::text
      when coalesce(o.old_annual_amount, 0::numeric) > 0::numeric and coalesce(n.new_annual_amount, 0::numeric) = 0::numeric then 'DIHAPUS'::text
      when coalesce(o.old_annual_amount, 0::numeric) <> coalesce(n.new_annual_amount, 0::numeric) then 'BERUBAH'::text
      else 'TETAP'::text
    end::character varying
  ) as change_status_code
from old_items o
full join new_items n
  on n.new_rak_version_id = o.new_rak_version_id
 and n.sub_activity_id = o.sub_activity_id
 and n.budget_account_id = o.budget_account_id
join sub_activities sa on sa.id = coalesce(n.sub_activity_id, o.sub_activity_id)
join fin_budget_accounts ba on ba.id = coalesce(n.budget_account_id, o.budget_account_id);

create or replace view public.fin_v_budget_balance_summary as
with active_rak as (
  select
    rv.id,
    rv.fiscal_year_id,
    rv.code,
    rv.version_number,
    rv.title,
    rv.rak_date,
    rv.previous_rak_version_id,
    rv.status,
    rv.is_active,
    rv.notes,
    rv.created_by,
    rv.approved_by,
    rv.approved_at,
    rv.created_at,
    rv.updated_at
  from fin_rak_versions rv
  where rv.is_active = true
),
plan_data as (
  select
    rv.fiscal_year_id,
    rv.id as rak_version_id,
    rv.code as rak_code,
    rsa.sub_activity_id,
    rbi.budget_account_id,
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
    rbi.dec_amount
  from active_rak rv
  join fin_rak_sub_activities rsa on rsa.rak_version_id = rv.id
  join fin_rak_budget_items rbi on rbi.rak_sub_activity_id = rsa.id
),
realization_data as (
  select
    br.fiscal_year_id,
    br.sub_activity_id,
    br.budget_account_id,
    sum(br.amount) as annual_realization,
    sum(case when br.period_month = 1 then br.amount else 0::numeric end) as jan_amount,
    sum(case when br.period_month = 2 then br.amount else 0::numeric end) as feb_amount,
    sum(case when br.period_month = 3 then br.amount else 0::numeric end) as mar_amount,
    sum(case when br.period_month = 4 then br.amount else 0::numeric end) as apr_amount,
    sum(case when br.period_month = 5 then br.amount else 0::numeric end) as may_amount,
    sum(case when br.period_month = 6 then br.amount else 0::numeric end) as jun_amount,
    sum(case when br.period_month = 7 then br.amount else 0::numeric end) as jul_amount,
    sum(case when br.period_month = 8 then br.amount else 0::numeric end) as aug_amount,
    sum(case when br.period_month = 9 then br.amount else 0::numeric end) as sep_amount,
    sum(case when br.period_month = 10 then br.amount else 0::numeric end) as oct_amount,
    sum(case when br.period_month = 11 then br.amount else 0::numeric end) as nov_amount,
    sum(case when br.period_month = 12 then br.amount else 0::numeric end) as dec_amount
  from fin_budget_realizations br
  group by br.fiscal_year_id, br.sub_activity_id, br.budget_account_id
)
select
  p.fiscal_year_id,
  p.rak_version_id,
  p.rak_code,
  p.sub_activity_id,
  sa.code as sub_activity_code,
  sa.name as sub_activity_name,
  p.budget_account_id,
  ba.code as budget_account_code,
  ba.name as budget_account_name,
  p.annual_amount as annual_plan,
  coalesce(r.annual_realization, 0::numeric) as annual_realization,
  p.annual_amount - coalesce(r.annual_realization, 0::numeric) as annual_balance,
  case
    when p.annual_amount = 0::numeric then 0::numeric
    else round(coalesce(r.annual_realization, 0::numeric) / p.annual_amount * 100::numeric, 2)
  end as absorption_percent,
  p.jan_amount as jan_plan,
  coalesce(r.jan_amount, 0::numeric) as jan_realization,
  p.jan_amount - coalesce(r.jan_amount, 0::numeric) as jan_balance,
  p.feb_amount as feb_plan,
  coalesce(r.feb_amount, 0::numeric) as feb_realization,
  p.feb_amount - coalesce(r.feb_amount, 0::numeric) as feb_balance,
  p.mar_amount as mar_plan,
  coalesce(r.mar_amount, 0::numeric) as mar_realization,
  p.mar_amount - coalesce(r.mar_amount, 0::numeric) as mar_balance,
  p.apr_amount as apr_plan,
  coalesce(r.apr_amount, 0::numeric) as apr_realization,
  p.apr_amount - coalesce(r.apr_amount, 0::numeric) as apr_balance,
  p.may_amount as may_plan,
  coalesce(r.may_amount, 0::numeric) as may_realization,
  p.may_amount - coalesce(r.may_amount, 0::numeric) as may_balance,
  p.jun_amount as jun_plan,
  coalesce(r.jun_amount, 0::numeric) as jun_realization,
  p.jun_amount - coalesce(r.jun_amount, 0::numeric) as jun_balance,
  p.jul_amount as jul_plan,
  coalesce(r.jul_amount, 0::numeric) as jul_realization,
  p.jul_amount - coalesce(r.jul_amount, 0::numeric) as jul_balance,
  p.aug_amount as aug_plan,
  coalesce(r.aug_amount, 0::numeric) as aug_realization,
  p.aug_amount - coalesce(r.aug_amount, 0::numeric) as aug_balance,
  p.sep_amount as sep_plan,
  coalesce(r.sep_amount, 0::numeric) as sep_realization,
  p.sep_amount - coalesce(r.sep_amount, 0::numeric) as sep_balance,
  p.oct_amount as oct_plan,
  coalesce(r.oct_amount, 0::numeric) as oct_realization,
  p.oct_amount - coalesce(r.oct_amount, 0::numeric) as oct_balance,
  p.nov_amount as nov_plan,
  coalesce(r.nov_amount, 0::numeric) as nov_realization,
  p.nov_amount - coalesce(r.nov_amount, 0::numeric) as nov_balance,
  p.dec_amount as dec_plan,
  coalesce(r.dec_amount, 0::numeric) as dec_realization,
  p.dec_amount - coalesce(r.dec_amount, 0::numeric) as dec_balance,
  case
    when p.annual_amount = 0::numeric and coalesce(r.annual_realization, 0::numeric) = 0::numeric then 'NO_PLAN_NO_REALIZATION'::text
    when p.annual_amount = 0::numeric and coalesce(r.annual_realization, 0::numeric) > 0::numeric then 'REALIZATION_WITHOUT_PLAN'::text
    when coalesce(r.annual_realization, 0::numeric) > p.annual_amount then 'OVER_BUDGET'::text
    when coalesce(r.annual_realization, 0::numeric) = p.annual_amount then 'FULLY_ABSORBED'::text
    when coalesce(r.annual_realization, 0::numeric) = 0::numeric then 'NO_REALIZATION'::text
    else 'NORMAL'::text
  end as balance_status
from plan_data p
join sub_activities sa on sa.id = p.sub_activity_id
join fin_budget_accounts ba on ba.id = p.budget_account_id
left join realization_data r
  on r.fiscal_year_id = p.fiscal_year_id
 and r.sub_activity_id = p.sub_activity_id
 and r.budget_account_id = p.budget_account_id;

create or replace view public.fin_v_budget_balance_unpivot as
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'JAN'::text as month, 1 as period_month, jan_plan as plan, jan_realization as realization, jan_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'FEB'::text as month, 2 as period_month, feb_plan as plan, feb_realization as realization, feb_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'MAR'::text as month, 3 as period_month, mar_plan as plan, mar_realization as realization, mar_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'APR'::text as month, 4 as period_month, apr_plan as plan, apr_realization as realization, apr_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'MAY'::text as month, 5 as period_month, may_plan as plan, may_realization as realization, may_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'JUN'::text as month, 6 as period_month, jun_plan as plan, jun_realization as realization, jun_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'JUL'::text as month, 7 as period_month, jul_plan as plan, jul_realization as realization, jul_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'AUG'::text as month, 8 as period_month, aug_plan as plan, aug_realization as realization, aug_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'SEP'::text as month, 9 as period_month, sep_plan as plan, sep_realization as realization, sep_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'OCT'::text as month, 10 as period_month, oct_plan as plan, oct_realization as realization, oct_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'NOV'::text as month, 11 as period_month, nov_plan as plan, nov_realization as realization, nov_balance as balance
from fin_v_budget_balance_summary
union all
select fiscal_year_id, rak_version_id, rak_code, sub_activity_id, sub_activity_code, sub_activity_name,
       budget_account_id, budget_account_code, budget_account_name,
       'DEC'::text as month, 12 as period_month, dec_plan as plan, dec_realization as realization, dec_balance as balance
from fin_v_budget_balance_summary;

create or replace view public.fin_v_tracking_budget_progress as
select
  fiscal_year_id,
  rak_version_id,
  rak_code,
  sub_activity_id,
  sub_activity_code,
  sub_activity_name,
  budget_account_id,
  budget_account_code,
  budget_account_name,
  annual_plan,
  annual_realization,
  absorption_percent as progress_percent,
  case
    when annual_plan = 0::numeric and annual_realization = 0::numeric then 'NO_ACTIVITY'::text
    when annual_realization = 0::numeric then 'NOT_STARTED'::text
    when annual_realization < annual_plan then 'IN_PROGRESS'::text
    when annual_realization = annual_plan then 'COMPLETED'::text
    else 'OVER_REALIZED'::text
  end as progress_status
from fin_v_budget_balance_summary b;

create or replace view public.fin_v_tracking_budget_warnings as
select
  fiscal_year_id,
  rak_version_id,
  rak_code,
  sub_activity_id,
  sub_activity_code,
  sub_activity_name,
  budget_account_id,
  budget_account_code,
  budget_account_name,
  annual_plan,
  annual_realization,
  annual_balance,
  absorption_percent,
  case
    when annual_plan = 0::numeric and annual_realization > 0::numeric then 'REALIZATION_WITHOUT_PLAN'::text
    when annual_realization > annual_plan then 'OVER_BUDGET'::text
    when annual_plan > 0::numeric and annual_realization = 0::numeric then 'NO_REALIZATION'::text
    when absorption_percent >= 90::numeric and absorption_percent < 100::numeric then 'FAST_ABSORPTION'::text
    else null::text
  end as warning_type
from fin_v_budget_balance_summary b
where (annual_plan = 0::numeric and annual_realization > 0::numeric)
   or (annual_realization > annual_plan)
   or (annual_plan > 0::numeric and annual_realization = 0::numeric)
   or (absorption_percent >= 90::numeric and absorption_percent < 100::numeric);

commit;
