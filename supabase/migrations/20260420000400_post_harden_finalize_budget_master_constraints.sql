-- Finalisasi constraint minimal modul anggaran.
-- Fokus migration ini:
-- 1. menegaskan FK ke master/status table yang masih relevan
-- 2. menambah unique constraint untuk mencegah duplikasi data master-versioned
-- 3. menegaskan hanya satu versi RAK aktif per tahun anggaran
-- 4. memperluas validasi akun aktif, leaf, level 5 ke realisasi anggaran

begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_budget_accounts_parent_id_fkey'
      and conrelid = 'public.fin_budget_accounts'::regclass
  ) then
    alter table public.fin_budget_accounts
      add constraint fin_budget_accounts_parent_id_fkey
      foreign key (parent_id)
      references public.fin_budget_accounts (id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_rak_versions_previous_rak_version_id_fkey'
      and conrelid = 'public.fin_rak_versions'::regclass
  ) then
    alter table public.fin_rak_versions
      add constraint fin_rak_versions_previous_rak_version_id_fkey
      foreign key (previous_rak_version_id)
      references public.fin_rak_versions (id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_rak_sub_activities_sub_activity_status_id_fkey'
      and conrelid = 'public.fin_rak_sub_activities'::regclass
  ) then
    alter table public.fin_rak_sub_activities
      add constraint fin_rak_sub_activities_sub_activity_status_id_fkey
      foreign key (sub_activity_status_id)
      references public.fin_sub_activity_rak_statuses (id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_rak_budget_items_item_change_status_id_fkey'
      and conrelid = 'public.fin_rak_budget_items'::regclass
  ) then
    alter table public.fin_rak_budget_items
      add constraint fin_rak_budget_items_item_change_status_id_fkey
      foreign key (item_change_status_id)
      references public.fin_budget_item_change_statuses (id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_budget_realizations_realization_status_id_fkey'
      and conrelid = 'public.fin_budget_realizations'::regclass
  ) then
    alter table public.fin_budget_realizations
      add constraint fin_budget_realizations_realization_status_id_fkey
      foreign key (realization_status_id)
      references public.fin_budget_realization_statuses (id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_rak_sub_activities_rak_version_sub_activity_key'
      and conrelid = 'public.fin_rak_sub_activities'::regclass
  ) then
    alter table public.fin_rak_sub_activities
      add constraint fin_rak_sub_activities_rak_version_sub_activity_key
      unique (rak_version_id, sub_activity_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fin_rak_budget_items_rak_sub_activity_budget_account_key'
      and conrelid = 'public.fin_rak_budget_items'::regclass
  ) then
    alter table public.fin_rak_budget_items
      add constraint fin_rak_budget_items_rak_sub_activity_budget_account_key
      unique (rak_sub_activity_id, budget_account_id);
  end if;
end
$$;

create unique index if not exists fin_rak_versions_one_active_per_fiscal_year_uidx
  on public.fin_rak_versions (fiscal_year_id)
  where is_active = true and fiscal_year_id is not null;

create or replace function public.fin_trg_fin_budget_realizations_assert_leaf_lv5()
returns trigger
language plpgsql
as $$
begin
  perform public.fin_assert_budget_account_is_leaf_lv5(new.budget_account_id);
  return new;
end;
$$;

drop trigger if exists trg_fin_budget_realizations_assert_leaf_lv5 on public.fin_budget_realizations;

create trigger trg_fin_budget_realizations_assert_leaf_lv5
before insert or update on public.fin_budget_realizations
for each row execute function public.fin_trg_fin_budget_realizations_assert_leaf_lv5();

commit;
