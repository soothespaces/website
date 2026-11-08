begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(13);

select ok(
  not has_column_privilege('anon', 'public.floor_alignments', 'aligned_by', 'select')
  and not has_column_privilege('authenticated', 'public.floor_alignments', 'aligned_by', 'select'),
  'no API role can read who saved an alignment'
);

select ok(
  has_column_privilege('anon', 'public.floor_alignments', 'corners', 'select'),
  'the pipeline can still read alignment corners with the publishable key'
);

select ok(
  not has_column_privilege('anon', 'public.space_locations', 'created_by', 'select')
  and not has_column_privilege('authenticated', 'public.space_locations', 'created_by', 'select'),
  'no API role can read who placed a space'
);

select ok(
  not has_column_privilege('anon', 'public.classrooms', 'scheduling_contact', 'select')
  and not has_column_privilege('anon', 'public.classrooms', 'support_contact', 'select')
  and not has_column_privilege('authenticated', 'public.classrooms', 'scheduling_contact', 'select')
  and not has_column_privilege('authenticated', 'public.classrooms', 'support_contact', 'select'),
  'classroom contacts are not served'
);

select ok(
  has_column_privilege('anon', 'public.classrooms', 'room_code', 'select')
  and has_column_privilege('anon', 'public.classrooms', 'seats', 'select'),
  'the rooms list can still read classrooms'
);

select ok(
  not has_function_privilege('anon', 'public.photo_uploaders(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.floor_alignment_authors()', 'execute'),
  'anon cannot call the admin author functions'
);

select is(
  (select public from storage.buckets where id = 'photos-hidden'),
  false,
  'unlisted photo files live in a private bucket'
);

-- Locations of an unlisted space are hidden from the public.
insert into public.buildings (slug, name) values ('test-email-hall', 'Test Email Hall') on conflict do nothing;
insert into public.spaces (slug, building_slug, name, source, is_listed)
values ('test-email-hidden', 'test-email-hall', 'Hidden', 'manual', false),
       ('test-email-shown', 'test-email-hall', 'Shown', 'manual', true);
insert into public.space_locations (space_id, floor, room_number, created_by)
select id, 1, '101', 'someone@umich.edu' from public.spaces where slug in ('test-email-hidden', 'test-email-shown');
insert into public.floor_alignments (sheet, sha256, width, height, corners, aligned_by)
values ('test_email', repeat('a', 64), 10, 10, '[[0,0],[1,0],[1,1],[0,1]]', 'someone@umich.edu');

set local role anon;
select is(
  (select count(*)::int from public.space_locations l
   join public.spaces s on s.id = l.space_id where s.building_slug = 'test-email-hall'),
  1,
  'anon sees only the listed space''s location'
);

select throws_ok(
  $$select * from public.photos$$,
  '42501',
  null,
  'select * on photos is refused, so code must name columns'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@umich.edu","role":"authenticated"}';

select is(
  (select count(*)::int from public.space_locations l
   where l.space_id in (select id from public.spaces where slug like 'test-email-%')),
  1,
  'a student sees only the listed space''s location'
);

select is(
  (select count(*)::int from public.floor_alignment_authors()),
  0,
  'a student gets no alignment authors'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"tkaslan@umich.edu","role":"authenticated"}';

select is(
  (select aligned_by from public.floor_alignment_authors() where sheet = 'test_email'),
  'someone@umich.edu',
  'an admin can read who saved an alignment'
);

select is(
  (select count(*)::int from public.space_locations l
   where l.space_id in (select id from public.spaces where slug like 'test-email-%')),
  2,
  'an admin sees every location'
);

select * from finish();
rollback;
