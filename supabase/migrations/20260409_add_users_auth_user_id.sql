alter table public.users
add column if not exists auth_user_id uuid;

comment on column public.users.auth_user_id is
'Maps aplikasi user ke Supabase Auth user (auth.users.id) sebagai identitas session resmi.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_user_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
    add constraint users_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users (id)
      on update cascade
      on delete set null;
  end if;
end
$$;

create unique index if not exists users_auth_user_id_key
  on public.users (auth_user_id)
  where auth_user_id is not null;
