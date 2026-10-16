begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(19);

insert into auth.users (id, email)
values
  ('a1111111-1111-1111-1111-111111111111', 'history-a@umich.edu'),
  ('b2222222-2222-2222-2222-222222222222', 'history-b@umich.edu');

insert into public.buildings (slug, name)
values ('test-history-building', 'Test History Building');

insert into public.spaces (id, slug, building_slug, name, source, is_listed)
values
  (
    'c3333333-3333-3333-3333-333333333333',
    'test-history-listed',
    'test-history-building',
    'Listed Space',
    'manual',
    true
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    'test-history-unlisted',
    'test-history-building',
    'Unlisted Space',
    'manual',
    false
  );

insert into public.floor_plans (
  id,
  building_slug,
  floor_number,
  mprint_tag,
  image_path,
  mask_path,
  width,
  height,
  source_sha256
)
values (
  'e5555555-5555-5555-5555-555555555555',
  'test-history-building',
  1,
  'test',
  'test-history/1/plan.png',
  'test-history/1/mask.png',
  100,
  100,
  repeat('b', 64)
);

insert into public.room_zones (
  id,
  floor_plan_id,
  room_number,
  mask_index,
  centroid_x,
  centroid_y,
  bbox
)
values (
  'f6666666-6666-6666-6666-666666666666',
  'e5555555-5555-5555-5555-555555555555',
  '101',
  1,
  10,
  10,
  '{0,0,20,20}'
);

-- 02:30 UTC on Oct 14 is 22:30 on Oct 13 in Ann Arbor (EDT).
insert into private.check_ins (user_id, space_id, room_zone_id, visited_at, noise)
values
  ('a1111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', null, '2026-10-10 15:00:00+00', 'quiet'),
  ('a1111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', null, '2026-10-14 02:30:00+00', 'quiet'),
  ('a1111111-1111-1111-1111-111111111111', null, 'f6666666-6666-6666-6666-666666666666', '2026-10-12 16:00:00+00', 'loud'),
  ('a1111111-1111-1111-1111-111111111111', 'd4444444-4444-4444-4444-444444444444', null, '2026-10-12 16:00:00+00', 'quiet'),
  ('b2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333', null, '2026-10-15 15:00:00+00', 'loud');

select has_table('public', 'favorites', 'favorites exists');
select ok(
  not has_function_privilege(
    'anon',
    'public.my_check_in_history()',
    'execute'
  ),
  'anon cannot read check-in history'
);
select ok(
  not has_table_privilege('anon', 'public.favorites', 'select'),
  'anon cannot read favorites'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a1111111-1111-1111-1111-111111111111","email":"history-a@umich.edu","role":"authenticated"}';

select is(
  (select count(*) from public.my_check_in_history()),
  2::bigint,
  'a user sees one row per listed target they checked in to'
);
select is(
  (
    select check_in_count from public.my_check_in_history()
    where target_kind = 'space'
      and target_id = 'c3333333-3333-3333-3333-333333333333'
  ),
  2::bigint,
  'the count includes only the user''s own check-ins'
);
select is(
  (
    select last_visited_on from public.my_check_in_history()
    where target_kind = 'space'
      and target_id = 'c3333333-3333-3333-3333-333333333333'
  ),
  '2026-10-13'::date,
  'the last visit is the Ann Arbor calendar day'
);
select is(
  (
    select check_in_count from public.my_check_in_history()
    where target_kind = 'room'
      and target_id = 'f6666666-6666-6666-6666-666666666666'
  ),
  1::bigint,
  'room check-ins are returned as rooms'
);
select is(
  (
    select count(*) from public.my_check_in_history()
    where target_id = 'd4444444-4444-4444-4444-444444444444'
  ),
  0::bigint,
  'unlisted spaces are left out'
);

select lives_ok(
  $$insert into public.favorites (space_id, position)
    values ('c3333333-3333-3333-3333-333333333333', 0)$$,
  'a user can save a space without sending user_id'
);
select lives_ok(
  $$insert into public.favorites (building_slug, position)
    values ('test-history-building', 1)$$,
  'a user can save a building'
);
select throws_ok(
  $$insert into public.favorites (user_id, space_id)
    values (
      'b2222222-2222-2222-2222-222222222222',
      'c3333333-3333-3333-3333-333333333333'
    )$$,
  '42501',
  'new row violates row-level security policy for table "favorites"',
  'a user cannot save a favorite for someone else'
);
select throws_ok(
  $$insert into public.favorites (space_id, building_slug)
    values ('c3333333-3333-3333-3333-333333333333', 'test-history-building')$$,
  '23514',
  null,
  'a favorite is a space or a building, not both'
);
select throws_ok(
  $$insert into public.favorites (space_id)
    values ('c3333333-3333-3333-3333-333333333333')$$,
  '23505',
  null,
  'a space can be saved once per user'
);
select lives_ok(
  $$update public.favorites
    set position = 5
    where building_slug = 'test-history-building'$$,
  'a user can reorder their favorites'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b2222222-2222-2222-2222-222222222222","email":"history-b@umich.edu","role":"authenticated"}';

select is(
  (select count(*) from public.my_check_in_history()),
  1::bigint,
  'another user sees only their own history'
);
select is(
  (select count(*) from public.favorites),
  0::bigint,
  'another user cannot see someone else''s favorites'
);
select lives_ok(
  $$update public.favorites set position = 9;
    delete from public.favorites$$,
  'updates and deletes on someone else''s favorites are no-ops'
);
select lives_ok(
  $$insert into public.favorites (space_id)
    values ('c3333333-3333-3333-3333-333333333333')$$,
  'two users can save the same space'
);

reset role;

select is(
  (
    select array_agg(position order by position)
    from public.favorites
    where user_id = 'a1111111-1111-1111-1111-111111111111'
  ),
  array[0, 5],
  'the first user''s favorites are unchanged by the second user'
);

select * from finish();

rollback;
