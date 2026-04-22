drop view if exists public.fin_v_tracking_budget_warnings;

create view public.fin_v_tracking_budget_warnings as
select
  b.fiscal_year_id,
  b.rak_version_id,
  b.rak_code,
  b.sub_activity_id,
  b.sub_activity_code,
  b.sub_activity_name,
  b.budget_account_id,
  b.budget_account_code,
  b.budget_account_name,

  -- jenis warning
  case
    when b.annual_plan = 0 and b.annual_realization > 0 then 'REALIZATION_WITHOUT_PLAN'
    when b.annual_realization > b.annual_plan then 'OVER_BUDGET_ANNUAL'

    -- NEW: overspend bulanan
    when (
      b.jan_realization > b.jan_plan or
      b.feb_realization > b.feb_plan or
      b.mar_realization > b.mar_plan or
      b.apr_realization > b.apr_plan or
      b.may_realization > b.may_plan or
      b.jun_realization > b.jun_plan or
      b.jul_realization > b.jul_plan or
      b.aug_realization > b.aug_plan or
      b.sep_realization > b.sep_plan or
      b.oct_realization > b.oct_plan or
      b.nov_realization > b.nov_plan or
      b.dec_realization > b.dec_plan
    ) then 'OVER_BUDGET_MONTHLY'

    when b.annual_realization = 0 and b.annual_plan > 0 then 'NO_REALIZATION'
    when b.absorption_percent >= 90 and b.absorption_percent < 100 then 'FAST_ABSORPTION'
    else null
  end as warning_type,

  -- info tambahan (bulan mana yang overspend)
  case
    when b.jan_realization > b.jan_plan then 'JAN'
    when b.feb_realization > b.feb_plan then 'FEB'
    when b.mar_realization > b.mar_plan then 'MAR'
    when b.apr_realization > b.apr_plan then 'APR'
    when b.may_realization > b.may_plan then 'MAY'
    when b.jun_realization > b.jun_plan then 'JUN'
    when b.jul_realization > b.jul_plan then 'JUL'
    when b.aug_realization > b.aug_plan then 'AUG'
    when b.sep_realization > b.sep_plan then 'SEP'
    when b.oct_realization > b.oct_plan then 'OCT'
    when b.nov_realization > b.nov_plan then 'NOV'
    when b.dec_realization > b.dec_plan then 'DEC'
    else null
  end as warning_month

from public.fin_v_budget_balance_summary b
where
  (
    b.annual_plan = 0 and b.annual_realization > 0
    or b.annual_realization > b.annual_plan
    or b.annual_realization = 0 and b.annual_plan > 0
    or (b.absorption_percent >= 90 and b.absorption_percent < 100)

    -- NEW: filter monthly overspend
    or (
      b.jan_realization > b.jan_plan or
      b.feb_realization > b.feb_plan or
      b.mar_realization > b.mar_plan or
      b.apr_realization > b.apr_plan or
      b.may_realization > b.may_plan or
      b.jun_realization > b.jun_plan or
      b.jul_realization > b.jul_plan or
      b.aug_realization > b.aug_plan or
      b.sep_realization > b.sep_plan or
      b.oct_realization > b.oct_plan or
      b.nov_realization > b.nov_plan or
      b.dec_realization > b.dec_plan
    )
  );