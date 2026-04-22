-- Pengetatan schema modul anggaran.
-- Fokus migration ini hanya pada integritas data master/relasi:
-- 1. status dan is_active pada fin_rak_versions harus konsisten
-- 2. period_month realisasi harus sesuai realization_date
-- 3. fin_rak_budget_items hanya boleh mengarah ke akun aktif, leaf, level 5
-- 4. rak_version_id pada fin_rak_budget_items harus selalu selaras dengan rak_sub_activity_id

begin;

alter table public.fin_rak_versions
  drop constraint if exists fin_rak_versions_active_status_check;

alter table public.fin_rak_versions
  add constraint fin_rak_versions_active_status_check
  check (not is_active or status = 'ACTIVE');

alter table public.fin_budget_realizations
  drop constraint if exists fin_budget_realizations_period_month_match_date_check;

alter table public.fin_budget_realizations
  add constraint fin_budget_realizations_period_month_match_date_check
  check (extract(month from realization_date)::int = period_month);

create or replace function public.fin_assert_budget_account_is_leaf_lv5(p_budget_account_id uuid)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.fin_budget_accounts ba
    join public.fin_budget_levels bl on bl.id = ba.budget_level_id
    where ba.id = p_budget_account_id
      and ba.is_active = true
      and ba.is_leaf = true
      and bl.level_number = 5
  ) then
    raise exception 'budget_account_id % must reference an active leaf level-5 account', p_budget_account_id;
  end if;
end;
$$;

create or replace function public.fin_trg_fin_rak_budget_items_assert_leaf_lv5()
returns trigger
language plpgsql
as $$
begin
  perform public.fin_assert_budget_account_is_leaf_lv5(new.budget_account_id);
  return new;
end;
$$;

drop trigger if exists trg_fin_rak_budget_items_assert_leaf_lv5 on public.fin_rak_budget_items;

create trigger trg_fin_rak_budget_items_assert_leaf_lv5
before insert or update on public.fin_rak_budget_items
for each row execute function public.fin_trg_fin_rak_budget_items_assert_leaf_lv5();

create or replace function public.fin_trg_fin_rak_budget_items_sync_version_id()
returns trigger
language plpgsql
as $$
declare
  v_rak_version_id uuid;
begin
  select rsa.rak_version_id
    into v_rak_version_id
  from public.fin_rak_sub_activities rsa
  where rsa.id = new.rak_sub_activity_id;

  if v_rak_version_id is null then
    raise exception 'rak_sub_activity_id % not found', new.rak_sub_activity_id;
  end if;

  new.rak_version_id := v_rak_version_id;
  return new;
end;
$$;

drop trigger if exists trg_fin_rak_budget_items_sync_version_id on public.fin_rak_budget_items;

create trigger trg_fin_rak_budget_items_sync_version_id
before insert or update on public.fin_rak_budget_items
for each row execute function public.fin_trg_fin_rak_budget_items_sync_version_id();

commit;
