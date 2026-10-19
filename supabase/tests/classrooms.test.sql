begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(5);

insert into public.classroom_characteristics (value, category, label, space_feature, feature_match)
values ('TestBoard', 'Board', 'Test board', 'whiteboards', 'exact');
insert into public.classrooms (mclassrooms_id, room_code, building_official_id, building_name, seats, characteristics, features, page_url, fetched_on)
values (-1, 'TEST101', '9999999', 'Test Building', 30, '{TestBoard}', '{whiteboards}', 'https://example.com/rooms/-1', '2026-10-15');

select throws_ok(
  $$insert into public.classroom_characteristics (value, category, label, space_feature) values ('TestNoMatch', 'Board', 'x', 'whiteboards')$$,
  '23514', null, 'a mapped characteristic says how good the match is'
);
select throws_ok(
  $$insert into public.classrooms (mclassrooms_id, room_code, building_official_id, building_name, photos, page_url, fetched_on) values (-2, 'TEST102', '9999999', 'Test Building', '{}'::jsonb, 'https://example.com', '2026-10-15')$$,
  '23514', null, 'photos is a JSON array'
);

set local role anon;

select is(
  (select seats from public.classrooms where room_code = 'TEST101'),
  30,
  'anon can read classrooms'
);
select is(
  (select label from public.classroom_characteristics where value = 'TestBoard'),
  'Test board',
  'anon can read classroom characteristics'
);
select throws_ok(
  $$delete from public.classrooms where room_code = 'TEST101'$$,
  '42501', null, 'anon cannot change classrooms'
);

select * from finish();

rollback;
