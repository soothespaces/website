begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

-- Checks seed.sql's links between spaces, bookable items and rooms. Skipped
-- when the database wasn't seeded (no Library spaces).
select plan(6);

select ok(
  (select count(*) from public.bookable_items b
    join public.spaces s on s.id = b.space_id
    where s.slug = 'shapiro-bookable-study-rooms') = 14
  or not exists (select 1 from public.spaces where slug = 'shapiro-bookable-study-rooms'),
  'Shapiro''s 14 study rooms link to their space'
);

select ok(
  exists (
    select 1 from public.bookable_items
    where title like 'Carrel 3-03 (3003)%' and room_number = '3003' and floor = 3
  )
  or not exists (select 1 from public.bookable_items where title like 'Carrel 3-03%'),
  'a Hatcher carrel takes its room number from the title'
);

select ok(
  exists (
    select 1 from public.space_locations l
    join public.spaces s on s.id = l.space_id
    where s.slug = 'shapiro-reading-room' and l.floor = 3 and l.room_number = '3100' and l.created_by = 'seed'
  )
  or not exists (select 1 from public.spaces where slug = 'shapiro-reading-room'),
  'the Shapiro Reading Room is seeded in room 3100'
);

select ok(
  (select floor from public.spaces where slug = 'hatcher-north-212a') = 2
  or not exists (select 1 from public.spaces where slug = 'hatcher-north-212a'),
  'a space whose page names its floor gets that floor'
);

-- An admin's location wins: re-running the seed's insert leaves that space alone.
insert into public.spaces (slug, building_slug, name, source, is_listed)
select 'test-seed-links-space', slug, 'Test Space', 'manual', true
from public.buildings limit 1;

insert into public.space_locations (space_id, floor, room_number, created_by)
select id, 1, '1001', 'admin@umich.edu' from public.spaces where slug = 'test-seed-links-space';

insert into public.space_locations (space_id, floor, room_number, created_by)
select s.id, v.floor, v.room_number, 'seed'
from (values ('test-seed-links-space', 1::smallint, '1002')) as v (space_slug, floor, room_number)
join public.spaces s on s.slug = v.space_slug
where not exists (select 1 from public.space_locations l where l.space_id = s.id);

select is(
  (select count(*)::int from public.space_locations l
    join public.spaces s on s.id = l.space_id
    where s.slug = 'test-seed-links-space'),
  1,
  'seeded rows skip a space an admin already placed'
);

select ok(
  not exists (
    select 1 from public.bookable_items b
    join public.spaces s on s.id = b.space_id
    where s.building_slug <> b.building_slug
  ),
  'every linked bookable item is in its space''s building'
);

select * from finish();
rollback;
