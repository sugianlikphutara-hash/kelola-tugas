-- Recreate fin_v_rak_sub_activity_summary because PostgreSQL cannot change
-- existing view column typmods via CREATE OR REPLACE VIEW.

begin;

drop view if exists public.fin_v_rak_sub_activity_summary;

create view public.fin_v_rak_sub_activity_summary as
select
  rv.id as rak_version_id,
  rv.fiscal_year_id,
  rv.code as rak_code,
  rv.rak_date,
  rsa.id as rak_sub_activity_id,
  sa.id as sub_activity_id,
  sa.code as sub_activity_code,
  sa.name as sub_activity_name,
  sr.code as sub_activity_status_code,
  sr.name as sub_activity_status_name,
  coalesce(sum(rbi.annual_amount), 0)::numeric(18,2) as annual_amount,
  coalesce(sum(rbi.jan_amount), 0)::numeric(18,2) as jan_amount,
  coalesce(sum(rbi.feb_amount), 0)::numeric(18,2) as feb_amount,
  coalesce(sum(rbi.mar_amount), 0)::numeric(18,2) as mar_amount,
  coalesce(sum(rbi.apr_amount), 0)::numeric(18,2) as apr_amount,
  coalesce(sum(rbi.may_amount), 0)::numeric(18,2) as may_amount,
  coalesce(sum(rbi.jun_amount), 0)::numeric(18,2) as jun_amount,
  coalesce(sum(rbi.jul_amount), 0)::numeric(18,2) as jul_amount,
  coalesce(sum(rbi.aug_amount), 0)::numeric(18,2) as aug_amount,
  coalesce(sum(rbi.sep_amount), 0)::numeric(18,2) as sep_amount,
  coalesce(sum(rbi.oct_amount), 0)::numeric(18,2) as oct_amount,
  coalesce(sum(rbi.nov_amount), 0)::numeric(18,2) as nov_amount,
  coalesce(sum(rbi.dec_amount), 0)::numeric(18,2) as dec_amount,
  (
    coalesce(sum(rbi.jan_amount), 0) +
    coalesce(sum(rbi.feb_amount), 0) +
    coalesce(sum(rbi.mar_amount), 0)
  )::numeric(18,2) as q1_amount,
  (
    coalesce(sum(rbi.apr_amount), 0) +
    coalesce(sum(rbi.may_amount), 0) +
    coalesce(sum(rbi.jun_amount), 0)
  )::numeric(18,2) as q2_amount,
  (
    coalesce(sum(rbi.jul_amount), 0) +
    coalesce(sum(rbi.aug_amount), 0) +
    coalesce(sum(rbi.sep_amount), 0)
  )::numeric(18,2) as q3_amount,
  (
    coalesce(sum(rbi.oct_amount), 0) +
    coalesce(sum(rbi.nov_amount), 0) +
    coalesce(sum(rbi.dec_amount), 0)
  )::numeric(18,2) as q4_amount,
  (
    coalesce(sum(rbi.jan_amount), 0) +
    coalesce(sum(rbi.feb_amount), 0) +
    coalesce(sum(rbi.mar_amount), 0) +
    coalesce(sum(rbi.apr_amount), 0) +
    coalesce(sum(rbi.may_amount), 0) +
    coalesce(sum(rbi.jun_amount), 0)
  )::numeric(18,2) as s1_amount,
  (
    coalesce(sum(rbi.jul_amount), 0) +
    coalesce(sum(rbi.aug_amount), 0) +
    coalesce(sum(rbi.sep_amount), 0) +
    coalesce(sum(rbi.oct_amount), 0) +
    coalesce(sum(rbi.nov_amount), 0) +
    coalesce(sum(rbi.dec_amount), 0)
  )::numeric(18,2) as s2_amount
from public.fin_rak_sub_activities rsa
join public.fin_rak_versions rv on rv.id = rsa.rak_version_id
join public.sub_activities sa on sa.id = rsa.sub_activity_id
join public.fin_sub_activity_rak_statuses sr on sr.id = rsa.sub_activity_status_id
left join public.fin_rak_budget_items rbi on rbi.rak_sub_activity_id = rsa.id
group by
  rv.id,
  rv.fiscal_year_id,
  rv.code,
  rv.rak_date,
  rsa.id,
  sa.id,
  sa.code,
  sa.name,
  sr.code,
  sr.name;

commit;
