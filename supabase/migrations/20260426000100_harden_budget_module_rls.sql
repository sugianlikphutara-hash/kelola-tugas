-- Hardening RLS for budget module tables.
-- Realisasi, audit, and period lock writes must go through security-definer RPCs.
-- RAK direct writes preserve the existing invoker RPC/editor flow.

begin;

delete from public.fin_budget_realizations
where description = 'RLS_DIRECT_INSERT_DEBUG_SHOULD_BE_DENIED';

alter table public.fin_budget_realizations enable row level security;
alter table public.fin_budget_realization_audit_logs enable row level security;
alter table public.fin_budget_period_locks enable row level security;
alter table public.fin_rak_versions enable row level security;
alter table public.fin_rak_budget_items enable row level security;

drop policy if exists fin_budget_realizations_select_authenticated
  on public.fin_budget_realizations;
drop policy if exists fin_budget_realizations_insert_direct_denied
  on public.fin_budget_realizations;
drop policy if exists fin_budget_realizations_update_direct_denied
  on public.fin_budget_realizations;
drop policy if exists fin_budget_realizations_delete_direct_denied
  on public.fin_budget_realizations;

create policy fin_budget_realizations_select_authenticated
  on public.fin_budget_realizations
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy fin_budget_realizations_insert_direct_denied
  on public.fin_budget_realizations
  for insert
  to authenticated
  with check (false);

create policy fin_budget_realizations_update_direct_denied
  on public.fin_budget_realizations
  for update
  to authenticated
  using (false)
  with check (false);

create policy fin_budget_realizations_delete_direct_denied
  on public.fin_budget_realizations
  for delete
  to authenticated
  using (false);

drop policy if exists fin_budget_realization_audit_logs_select_authenticated
  on public.fin_budget_realization_audit_logs;
drop policy if exists fin_budget_realization_audit_logs_insert_direct_denied
  on public.fin_budget_realization_audit_logs;
drop policy if exists fin_budget_realization_audit_logs_update_direct_denied
  on public.fin_budget_realization_audit_logs;
drop policy if exists fin_budget_realization_audit_logs_delete_direct_denied
  on public.fin_budget_realization_audit_logs;

create policy fin_budget_realization_audit_logs_select_authenticated
  on public.fin_budget_realization_audit_logs
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy fin_budget_realization_audit_logs_insert_direct_denied
  on public.fin_budget_realization_audit_logs
  for insert
  to authenticated
  with check (false);

create policy fin_budget_realization_audit_logs_update_direct_denied
  on public.fin_budget_realization_audit_logs
  for update
  to authenticated
  using (false)
  with check (false);

create policy fin_budget_realization_audit_logs_delete_direct_denied
  on public.fin_budget_realization_audit_logs
  for delete
  to authenticated
  using (false);

drop policy if exists fin_budget_period_locks_select_authenticated
  on public.fin_budget_period_locks;
drop policy if exists fin_budget_period_locks_insert_direct_denied
  on public.fin_budget_period_locks;
drop policy if exists fin_budget_period_locks_update_direct_denied
  on public.fin_budget_period_locks;
drop policy if exists fin_budget_period_locks_delete_direct_denied
  on public.fin_budget_period_locks;

create policy fin_budget_period_locks_select_authenticated
  on public.fin_budget_period_locks
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy fin_budget_period_locks_insert_direct_denied
  on public.fin_budget_period_locks
  for insert
  to authenticated
  with check (false);

create policy fin_budget_period_locks_update_direct_denied
  on public.fin_budget_period_locks
  for update
  to authenticated
  using (false)
  with check (false);

create policy fin_budget_period_locks_delete_direct_denied
  on public.fin_budget_period_locks
  for delete
  to authenticated
  using (false);

drop policy if exists fin_rak_versions_select_authenticated
  on public.fin_rak_versions;
drop policy if exists fin_rak_versions_insert_direct_denied
  on public.fin_rak_versions;
drop policy if exists fin_rak_versions_insert_draft_authenticated
  on public.fin_rak_versions;
drop policy if exists fin_rak_versions_update_draft_authenticated
  on public.fin_rak_versions;
drop policy if exists fin_rak_versions_update_authenticated_valid_state
  on public.fin_rak_versions;
drop policy if exists fin_rak_versions_delete_direct_denied
  on public.fin_rak_versions;

create policy fin_rak_versions_select_authenticated
  on public.fin_rak_versions
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy fin_rak_versions_insert_draft_authenticated
  on public.fin_rak_versions
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
    and status = 'DRAFT'
    and is_active = false
  );

create policy fin_rak_versions_update_authenticated_valid_state
  on public.fin_rak_versions
  for update
  to authenticated
  using (
    auth.role() = 'authenticated'
  )
  with check (
    auth.role() = 'authenticated'
    and status in ('DRAFT', 'ACTIVE', 'ARCHIVED')
    and (is_active = false or status = 'ACTIVE')
  );

create policy fin_rak_versions_delete_direct_denied
  on public.fin_rak_versions
  for delete
  to authenticated
  using (false);

drop policy if exists fin_rak_budget_items_select_authenticated
  on public.fin_rak_budget_items;
drop policy if exists fin_rak_budget_items_insert_draft_authenticated
  on public.fin_rak_budget_items;
drop policy if exists fin_rak_budget_items_update_draft_authenticated
  on public.fin_rak_budget_items;
drop policy if exists fin_rak_budget_items_delete_draft_authenticated
  on public.fin_rak_budget_items;

create policy fin_rak_budget_items_select_authenticated
  on public.fin_rak_budget_items
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy fin_rak_budget_items_insert_draft_authenticated
  on public.fin_rak_budget_items
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.fin_rak_versions rv
      where rv.id = fin_rak_budget_items.rak_version_id
        and rv.status = 'DRAFT'
        and rv.is_active = false
    )
    and exists (
      select 1
      from public.fin_rak_sub_activities rsa
      where rsa.id = fin_rak_budget_items.rak_sub_activity_id
        and rsa.rak_version_id = fin_rak_budget_items.rak_version_id
    )
  );

create policy fin_rak_budget_items_update_draft_authenticated
  on public.fin_rak_budget_items
  for update
  to authenticated
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.fin_rak_versions rv
      where rv.id = fin_rak_budget_items.rak_version_id
        and rv.status = 'DRAFT'
        and rv.is_active = false
    )
  )
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.fin_rak_versions rv
      where rv.id = fin_rak_budget_items.rak_version_id
        and rv.status = 'DRAFT'
        and rv.is_active = false
    )
    and exists (
      select 1
      from public.fin_rak_sub_activities rsa
      where rsa.id = fin_rak_budget_items.rak_sub_activity_id
        and rsa.rak_version_id = fin_rak_budget_items.rak_version_id
    )
  );

create policy fin_rak_budget_items_delete_draft_authenticated
  on public.fin_rak_budget_items
  for delete
  to authenticated
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.fin_rak_versions rv
      where rv.id = fin_rak_budget_items.rak_version_id
        and rv.status = 'DRAFT'
        and rv.is_active = false
    )
  );

commit;
