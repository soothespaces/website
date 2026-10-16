begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(16);

insert into public.buildings (slug, name)
values ('test-space-hall', 'Test Space Hall')
on conflict do nothing;

insert into public.spaces (slug, building_slug, name, floor, features, source, is_listed)
values
  ('test-library-space', 'test-space-hall', 'Library Space', 2, '{outlets}', 'um_library', true),
  ('test-hidden-space', 'test-space-hall', 'Hidden Space', 1, '{}', 'mguide', false);

-- A student can't change, add or locate spaces, or see unlisted ones.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@umich.edu","role":"authenticated"}';

update public.spaces set capacity = 5 where slug = 'test-library-space';
reset role;
select is(
  (select capacity from public.spaces where slug = 'test-library-space'),
  null,
  'a student cannot change a space'
);

set local role authenticated;
select throws_ok(
  $$insert into public.spaces (slug, building_slug, name, source)
    values ('manual-student', 'test-space-hall', 'Mine', 'manual')$$,
  '42501',
  null,
  'a student cannot add a space'
);

select is(
  (select count(*)::int from public.spaces where slug = 'test-hidden-space'),
  0,
  'a student cannot see an unlisted space'
);

select throws_ok(
  $$insert into public.space_locations (space_id, floor, room_number)
    select id, 2, '2001' from public.spaces where slug = 'test-library-space'$$,
  '42501',
  null,
  'a student cannot place a space'
);

-- An admin edits a seeded space; the edited columns are remembered.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"tkaslan@umich.edu","role":"authenticated"}';

select is(
  (select count(*)::int from public.spaces where slug = 'test-hidden-space'),
  1,
  'an admin sees unlisted spaces'
);

update public.spaces
set features = '{outlets,external_monitors}', light_level = 'bright', floor = 2
where slug = 'test-library-space';

select is(
  (select edited_fields from public.spaces where slug = 'test-library-space'),
  '{features,light_level}'::text[],
  'an admin edit records the columns that changed, not ones set to the same value'
);

update public.spaces set edited_fields = '{light_level}', capacity = 40 where slug = 'test-library-space';

select is(
  (select edited_fields from public.spaces where slug = 'test-library-space'),
  '{capacity,light_level}'::text[],
  'setting edited_fields unlocks a column, and the same update still records its own changes'
);

select lives_ok(
  $$insert into public.spaces (slug, building_slug, name, floor, source, features)
    values ('manual-caen-lab', 'test-space-hall', 'CAEN Lab', 1, 'manual', '{computers,printing}')$$,
  'an admin can add a manual space'
);

select throws_ok(
  $$insert into public.spaces (slug, building_slug, name, source)
    values ('not-manual', 'test-space-hall', 'Pretend Library', 'um_library')$$,
  '42501',
  null,
  'an admin cannot add a space that claims to come from a source'
);

select lives_ok(
  $$insert into public.space_locations (space_id, floor, room_number)
    select id, 2, '2001' from public.spaces where slug = 'test-library-space'$$,
  'an admin can place a space in a room'
);

select lives_ok(
  $$insert into public.space_locations (space_id, floor, area)
    select id, 3, '{"type":"Polygon","coordinates":[[[-83.7,42.2],[-83.7,42.3],[-83.6,42.3],[-83.7,42.2]]]}'
    from public.spaces where slug = 'test-library-space'$$,
  'an admin can outline an area of a floor'
);

select throws_ok(
  $$insert into public.space_locations (space_id, floor, room_number, area)
    select id, 2, '2002', '{"type":"Polygon","coordinates":[]}' from public.spaces where slug = 'test-library-space'$$,
  '23514',
  null,
  'a location is a room or an area, not both'
);

select is(
  (select created_by from public.space_locations where room_number = '2001'),
  'tkaslan@umich.edu',
  'a location records the admin who placed it'
);

-- Only spaces added by hand can be deleted (the seed would bring the rest back).
delete from public.spaces where slug = 'test-library-space';
delete from public.spaces where slug = 'manual-caen-lab';
reset role;
select is(
  (select array_agg(slug order by slug) from public.spaces where slug in ('test-library-space', 'manual-caen-lab')),
  '{test-library-space}'::text[],
  'an admin can delete a manual space but not a seeded one'
);

-- The seed (no signed-in user) keeps hand-edited columns and updates the rest.
set local request.jwt.claims = '';
insert into public.spaces (slug, building_slug, name, floor, features, capacity, source, is_listed)
values ('test-library-space', 'test-space-hall', 'Library Space (renamed)', 2, '{outlets}', 12, 'um_library', true)
on conflict (slug) do update set
  name = case when 'name' = any(spaces.edited_fields) then spaces.name else excluded.name end,
  features = case when 'features' = any(spaces.edited_fields) then spaces.features else excluded.features end,
  capacity = case when 'capacity' = any(spaces.edited_fields) then spaces.capacity else excluded.capacity end;

select is(
  (select row(name, capacity, edited_fields)::text from public.spaces where slug = 'test-library-space'),
  row('Library Space (renamed)', 40, '{capacity,light_level}'::text[])::text,
  'a re-seed updates unedited columns, keeps edited ones, and adds nothing to edited_fields'
);

select is(
  (select features from public.spaces where slug = 'test-library-space'),
  '{outlets}'::public.space_feature[],
  'an unlocked column takes the seed value again'
);

select * from finish();
rollback;
