-- Atomic save for aggregated monthly budget realization.
-- UI v1 writes one aggregated value per fiscal year + sub activity + account + month.

begin;

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

  delete from public.fin_budget_realizations br
  where br.fiscal_year_id = p_fiscal_year_id
    and br.sub_activity_id = p_sub_activity_id
    and br.budget_account_id = p_budget_account_id
    and br.period_month = p_period_month;

  if v_amount > 0 then
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
