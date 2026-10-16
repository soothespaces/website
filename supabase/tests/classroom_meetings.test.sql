begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(13);

-- The seed may already hold mguide's rows; test against our own rooms only.
insert into public.buildings (slug, name)
values ('test-classroom-building', 'Test Classroom Building');

-- Wednesday 2026-10-14. TEST-101 has a class 10:00-11:30 and 13:00-14:00 on
-- Mon/Wed; TEST-102 only meets on Fridays.
insert into public.classroom_meetings (
  room_code, building_code, room_number, building_slug, course, section,
  weekdays, starts, ends, first_day, last_day
)
values
  ('TEST-101', 'TEST', '101', 'test-classroom-building', 'TEST 100', 'LEC 001',
   '{1,3}', '10:00', '11:30', '2026-08-31', '2026-12-11'),
  ('TEST-101', 'TEST', '101', 'test-classroom-building', 'TEST 200', 'DIS 001',
   '{1,3}', '13:00', '14:00', '2026-08-31', '2026-12-11'),
  ('TEST-102', 'TEST', '102', null, 'TEST 300', 'SEM 001',
   '{5}', '09:00', '12:00', '2026-08-31', '2026-12-11');

select has_table('public', 'classroom_meetings', 'classroom_meetings exists');
select throws_ok(
  $$insert into public.classroom_meetings (
      room_code, building_code, room_number, course, section,
      weekdays, starts, ends, first_day, last_day
    ) values ('TEST-103', 'TEST', '103', 'X 1', 'LEC 001', '{7}', '09:00', '10:00', '2026-08-31', '2026-12-11')$$,
  '23514', null, 'weekdays run 0 (Sunday) to 6'
);
select throws_ok(
  $$insert into public.classroom_meetings (
      room_code, building_code, room_number, course, section,
      weekdays, starts, ends, first_day, last_day
    ) values ('TEST-103', 'TEST', '103', 'X 1', 'LEC 001', '{1}', '10:00', '09:00', '2026-08-31', '2026-12-11')$$,
  '23514', null, 'a meeting ends after it starts'
);

set local role anon;

select ok(
  (select count(*) from public.classroom_meetings where building_code = 'TEST') = 3,
  'anon can read class meetings'
);
select throws_ok(
  $$delete from public.classroom_meetings where building_code = 'TEST'$$,
  '42501', null, 'anon cannot change class meetings'
);

-- 10:30 Ann Arbor time (EDT, UTC-4) on Wednesday: TEST-101 is in class.
select is(
  (select in_class from public.classroom_availability('2026-10-14 14:30:00+00') where room_code = 'TEST-101'),
  true,
  'a room with a class meeting now is in class'
);
select is(
  (select current_course || ' until ' || busy_until::text from public.classroom_availability('2026-10-14 14:30:00+00') where room_code = 'TEST-101'),
  'TEST 100 until 11:30:00',
  'the current class and when it ends are returned'
);
select is(
  (select free_until from public.classroom_availability('2026-10-14 14:30:00+00') where room_code = 'TEST-101'),
  null::time,
  'free_until is only set when the room is not in class'
);
select is(
  (select free_until from public.classroom_availability('2026-10-14 16:00:00+00') where room_code = 'TEST-101'),
  '13:00'::time,
  'between classes, free_until is the next class today'
);
select is(
  (select free_until is null and not in_class from public.classroom_availability('2026-10-14 19:00:00+00') where room_code = 'TEST-101'),
  true,
  'after the last class there is nothing left today'
);
select is(
  (select not in_class and free_until is null from public.classroom_availability('2026-10-14 14:30:00+00') where room_code = 'TEST-102'),
  true,
  'a room that only meets on other days is free all day'
);
select is(
  (select in_class from public.classroom_availability('2026-10-16 14:30:00+00') where room_code = 'TEST-102'),
  true,
  'weekdays use the Ann Arbor calendar day'
);
select is(
  (select count(*) from public.classroom_availability('2026-12-20 14:30:00+00') where room_code like 'TEST-%' and (in_class or free_until is not null)),
  0::bigint,
  'after the term ends no class is scheduled'
);

select * from finish();

rollback;
