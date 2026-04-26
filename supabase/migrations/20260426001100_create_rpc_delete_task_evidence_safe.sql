-- Create RPC to delete Task evidence safely (RLS-compatible)
begin;

create or replace function public.delete_task_evidence_safe(
  p_task_id uuid,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_role_code text;
  v_task_exists boolean := false;
  v_task_document public.task_documents%rowtype;
  v_document record;
  v_other_relation_count integer := 0;
  v_deleted_document boolean := false;
begin
  -- 1. Validate auth
  if v_auth_user_id is null then
    raise exception 'User tidak terautentikasi.';
  end if;

  -- 2. Fetch role & employee_id from database
  select u.employee_id, upper(trim(r.code::text))
  into v_employee_id, v_role_code
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.auth_user_id = v_auth_user_id
    and upper(coalesce(u.status, '')) = 'ACTIVE'
    and coalesce(u.is_locked, false) = false
    and coalesce(r.is_active, false) = true
  limit 1;

  if v_employee_id is null then
    raise exception 'Profil pegawai user tidak ditemukan.';
  end if;

  if v_role_code not in ('ADMIN', 'KASI', 'KASUBAG') then
    raise exception 'Anda tidak memiliki izin untuk menghapus eviden.';
  end if;

  -- 3. Validate task and relation
  select exists (
    select 1
    from public.tasks
    where id = p_task_id
  ) into v_task_exists;

  if not v_task_exists then
    raise exception 'Task tidak ditemukan.';
  end if;

  select *
  into v_task_document
  from public.task_documents
  where task_id = p_task_id
    and document_id = p_document_id
  limit 1;

  if not found then
    raise exception 'Relasi eviden task tidak ditemukan.';
  end if;

  select id, file_url, storage_path
  into v_document
  from public.documents
  where id = p_document_id;

  if not found then
    raise exception 'Metadata eviden tidak ditemukan.';
  end if;

  -- 4. Delete relation first
  delete from public.task_documents
  where id = v_task_document.id;

  -- 5. Delete document metadata only if no other task uses it
  select count(*)
  into v_other_relation_count
  from public.task_documents
  where document_id = p_document_id;

  if v_other_relation_count = 0 then
    delete from public.documents
    where id = p_document_id;

    v_deleted_document := true;
  end if;

  return jsonb_build_object(
    'task_document_id', v_task_document.id,
    'document_id', p_document_id,
    'storage_path', v_document.storage_path,
    'file_url', v_document.file_url,
    'document_deleted', v_deleted_document
  );
end;
$$;

grant execute on function public.delete_task_evidence_safe(uuid, uuid) to authenticated;

commit;
