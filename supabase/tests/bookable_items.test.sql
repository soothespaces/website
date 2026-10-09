begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(6);

insert into public.buildings (slug, name)
values ('test-shapiro', 'Shapiro Library');

insert into public.bookable_items (
  instance, libcal_item_id, lid, kind, title, building_slug, booking_url, is_listed
)
values
  ('umich.libcal.com', 900001, 2761, 'space', 'Test Room 2122', 'test-shapiro',
   'https://umich.libcal.com/space/900001', true),
  ('umich.libcal.com', 900002, 4004, 'space', 'Test Game Station', 'test-shapiro',
   'https://umich.libcal.com/space/900002', false);

select throws_ok(
  $$insert into public.bookable_items (instance, libcal_item_id, lid, kind, title, booking_url)
    values ('example.libcal.com', 900003, 1, 'space', 'Elsewhere', 'https://example.com')$$,
  '23514',
  null,
  'only the three UM LibCal instances are allowed'
);

select throws_ok(
  $$insert into public.bookable_items (instance, libcal_item_id, lid, kind, title, booking_url)
    values ('umich.libcal.com', 900004, 1, 'room', 'Wrong kind', 'https://umich.libcal.com/space/900004')$$,
  '23514',
  null,
  'kind is space or seat'
);

set local role anon;

select is(
  (select count(*)::int from public.bookable_items where libcal_item_id between 900001 and 900002),
  1,
  'anon sees listed bookable items only'
);

select throws_ok(
  $$insert into public.bookable_items (instance, libcal_item_id, lid, kind, title, booking_url)
    values ('umich.libcal.com', 900005, 1, 'space', 'Anon insert', 'https://umich.libcal.com/space/900005')$$,
  '42501',
  null,
  'anon cannot insert bookable items'
);

reset role;
set local role authenticated;

select is(
  (select count(*)::int from public.bookable_items where libcal_item_id between 900001 and 900002),
  1,
  'authenticated sees listed bookable items only'
);

select throws_ok(
  $$update public.bookable_items set title = 'Changed' where libcal_item_id = 900001$$,
  '42501',
  null,
  'authenticated cannot update bookable items'
);

reset role;

select * from finish();
rollback;
