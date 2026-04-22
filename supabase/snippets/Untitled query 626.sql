insert into public.sub_activities (
  id,
  code,
  name
)
values (
  '22222222-2222-2222-2222-222222222222',
  'SA-001',
  'Sub Kegiatan Dummy'
)
on conflict (id) do nothing;