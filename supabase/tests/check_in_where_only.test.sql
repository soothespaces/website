begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(2);

insert into auth.users (id, email)
values ('f6666666-6666-6666-6666-666666666666', 'where-only@umich.edu');

insert into public.buildings (slug, name)
values ('test-where-building', 'Test Where Building');

insert into public.spaces (id, slug, building_slug, name, source, is_listed)
values (
  'f7777777-7777-7777-7777-777777777777',
  'test-where-space',
  'test-where-building',
  'Where Space',
  'manual',
  true
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"f6666666-6666-6666-6666-666666666666","email":"where-only@umich.edu","role":"authenticated"}';

select lives_ok(
  $$select public.submit_check_in(
    target_kind => 'space',
    target_id => 'f7777777-7777-7777-7777-777777777777'
  )$$,
  'a check-in with only Where is accepted'
);

reset role;

select is(
  (
    select count(*)::int
    from private.check_ins
    where space_id = 'f7777777-7777-7777-7777-777777777777'
  ),
  1,
  'the Where-only check-in is stored'
);

select * from finish();
rollback;
