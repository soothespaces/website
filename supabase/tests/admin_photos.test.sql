begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(14);

insert into public.buildings (slug, name)
values ('test-photo-hall', 'Test Photo Hall')
on conflict do nothing;

-- A student can't add photos or photo files.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@umich.edu","role":"authenticated"}';

select throws_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license)
    values ('test-photo-hall', 'photos/buildings/test-photo-hall/student', '{480}', 480, 360, 'A room', 'Me', 'Mine')$$,
  '42501',
  null,
  'a student cannot add a photo'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'buildings/test-photo-hall/student-480.webp')$$,
  '42501',
  null,
  'a student cannot upload a photo file'
);

-- An admin can upload, tag and re-tag.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"tkaslan@umich.edu","role":"authenticated"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'buildings/test-photo-hall/abc-480.webp')$$,
  'an admin can upload a photo file'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('floor-plans', 'test/admin.png')$$,
  '42501',
  null,
  'the admin upload policy only covers the photos bucket'
);

select lives_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license,
      floor, room_number, lat, lng, is_listed, uploaded_by)
    values ('test-photo-hall', 'photos/buildings/test-photo-hall/abc', '{480}', 480, 360,
      'Quiet corner by the windows', 'Soothe Spaces team', 'Soothe Spaces team photo',
      3, '3045', 42.27, -83.73, false, 'someone@umich.edu')$$,
  'an admin can add a photo tagged to a room and a spot'
);

select is(
  (select uploaded_by from public.photos where path_prefix = 'photos/buildings/test-photo-hall/abc'),
  'tkaslan@umich.edu',
  'uploaded_by is the signed-in admin, not what the client sent'
);

select is(
  (select count(*)::int from public.photos where path_prefix = 'photos/buildings/test-photo-hall/abc'),
  1,
  'an admin can read an unlisted photo'
);

select throws_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license, room_number)
    values ('test-photo-hall', 'photos/buildings/test-photo-hall/nofloor', '{480}', 480, 360, 'A room', 'Us', 'Ours', '3045')$$,
  '23514',
  null,
  'a room needs a floor'
);

select lives_ok(
  $$update public.photos set room_number = null, lat = null, lng = null, floor = null,
      uploaded_by = 'someone@umich.edu'
    where path_prefix = 'photos/buildings/test-photo-hall/abc'$$,
  'an admin can re-tag a photo to the whole building'
);

select is(
  (select uploaded_by from public.photos where path_prefix = 'photos/buildings/test-photo-hall/abc'),
  'tkaslan@umich.edu',
  'uploaded_by never changes after upload'
);

-- A student can't see the unlisted photo, change it or remove it.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@umich.edu","role":"authenticated"}';

select is(
  (select count(*)::int from public.photos where path_prefix = 'photos/buildings/test-photo-hall/abc'),
  0,
  'a student cannot see an unlisted photo'
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'photos' and name = 'buildings/test-photo-hall/abc-480.webp'),
  0,
  'a student cannot list photo files'
);

-- An admin can remove the photo. Storage blocks deleting files with SQL
-- (storage.protect_delete), so the app removes them through the Storage API;
-- check the policy that lets it is there.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"tkaslan@umich.edu","role":"authenticated"}';

delete from public.photos where path_prefix = 'photos/buildings/test-photo-hall/abc';

reset role;
select is(
  (select count(*)::int from public.photos where path_prefix = 'photos/buildings/test-photo-hall/abc'),
  0,
  'an admin can remove a photo'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'admins can remove photo files' and cmd = 'DELETE'
  ),
  'admins may remove photo files through the Storage API'
);

select * from finish();

rollback;
