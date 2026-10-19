begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(6);

insert into public.printers (mprint_name, display_name, building_record_number, floor_label, floor, room_number, color, price, price_unit)
values ('m-test-101-bw-1', 'Test Building Rm 101', '9999999', 'Floor 1', 1, '101', false, 0.09, 'page');

select has_table('public', 'printers', 'printers exists');
select throws_ok(
  $$insert into public.printers (mprint_name, display_name) values ('m-test-101-bw-1', 'Duplicate')$$,
  '23505', null, 'MPrint queue names are unique'
);
select throws_ok(
  $$insert into public.printers (mprint_name, display_name, price) values ('m-test-102-bw-1', 'No unit', 0.09)$$,
  '23514', null, 'a price needs a unit'
);
select throws_ok(
  $$insert into public.printers (mprint_name, display_name, price, price_unit) values ('m-test-103-bw-1', 'Bad unit', 0.09, 'impression')$$,
  '23514', null, 'price units are page or foot'
);

set local role anon;

select is(
  (select display_name from public.printers where mprint_name = 'm-test-101-bw-1'),
  'Test Building Rm 101',
  'anon can read printers'
);
select throws_ok(
  $$delete from public.printers where mprint_name = 'm-test-101-bw-1'$$,
  '42501', null, 'anon cannot change printers'
);

select * from finish();

rollback;
