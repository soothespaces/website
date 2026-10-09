begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(5);

insert into public.buildings (slug, name)
values ('test-league', 'Michigan League');

insert into public.building_entrances (
  id, building_record_number, building_slug, lat, lng, accessible, automatic
)
values ('00000000-0000-4000-8000-000000000001', '1000191', 'test-league', 42.2788, -83.7393, true, true);

select throws_ok(
  $$insert into public.building_entrances (id, lat, lng, accessible, automatic, source)
    values ('00000000-0000-4000-8000-000000000002', 42.27, -83.74, true, false, 'google')$$,
  '23514',
  null,
  'source is fo_campus_map or manual'
);

select throws_ok(
  $$insert into public.building_entrances (id, lat, lng, accessible, automatic)
    values ('00000000-0000-4000-8000-000000000003', 142.27, -83.74, true, false)$$,
  '23514',
  null,
  'lat must be a latitude'
);

delete from public.buildings where slug = 'test-league';

select is(
  (select building_slug from public.building_entrances
   where id = '00000000-0000-4000-8000-000000000001'),
  null,
  'deleting a building keeps its entrances, unlinked'
);

set local role anon;

select is(
  (select count(*)::int from public.building_entrances
   where id = '00000000-0000-4000-8000-000000000001'),
  1,
  'anon can read entrances'
);

select throws_ok(
  $$insert into public.building_entrances (id, lat, lng, accessible, automatic)
    values ('00000000-0000-4000-8000-000000000004', 42.27, -83.74, true, false)$$,
  '42501',
  null,
  'anon cannot insert entrances'
);

select * from finish();
rollback;
