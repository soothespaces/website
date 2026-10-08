begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(32);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'student@umich.edu'),
  ('22222222-2222-2222-2222-222222222222', 'other@umich.edu'),
  ('99999999-9999-9999-9999-999999999999', 'person@gmail.com');

insert into public.buildings (slug, name)
values ('shapiro', 'Shapiro Library');

insert into public.spaces (
  id,
  slug,
  building_slug,
  name,
  source,
  noise_level,
  features
)
values (
  '33333333-3333-3333-3333-333333333333',
  'shapiro-2',
  'shapiro',
  'Shapiro Floor 2',
  'um_library',
  'quiet',
  '{natural_light,outlets}'
);

insert into public.spaces (id, slug, building_slug, name, source, is_listed)
values (
  '77777777-7777-7777-7777-777777777777',
  'shapiro-3',
  'shapiro',
  'Shapiro Floor 3',
  'um_library',
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
  '44444444-4444-4444-4444-444444444444',
  'shapiro',
  2,
  'ulib',
  'shapiro/2/plan.png',
  'shapiro/2/mask.png',
  1185,
  1854,
  repeat('a', 64)
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
values
  (
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    '2122',
    1,
    10,
    20,
    '{0,0,100,100}'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    '2124',
    2,
    20,
    20,
    '{101,0,200,100}'
  );

select has_table('public', 'buildings', 'buildings exists');
select has_table('public', 'spaces', 'spaces exists');
select has_table('public', 'floor_plans', 'floor_plans exists');
select has_table('public', 'room_zones', 'room_zones exists');
select has_table('private', 'check_ins', 'private.check_ins exists');
select has_table('public', 'user_settings', 'user_settings exists');
select has_table('public', 'photos', 'photos exists');

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon cannot access the private schema'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated cannot access the private schema'
);
select ok(
  has_table_privilege('anon', 'public.spaces', 'select'),
  'anon can read spaces'
);
select ok(
  not has_table_privilege('anon', 'public.spaces', 'insert'),
  'anon cannot insert spaces'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_check_in(text,uuid,public.noise_level,public.light_level,boolean,public.busyness_level,smallint,public.space_feature[],timestamp with time zone)',
    'execute'
  ),
  'anon cannot submit check-ins'
);

-- Postgres grants EXECUTE on new functions to PUBLIC, so every function in
-- public must revoke it explicitly. These fail if one is left callable.
select is(
  array(
    select p.proname::text
    from pg_proc as p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (
        select 1 from pg_depend as d
        where d.objid = p.oid and d.deptype = 'e'
      )
    order by 1
  ),
  array['check_in_overview', 'check_in_summary'],
  'anon can execute only the public aggregate functions'
);
select is(
  array(
    select p.proname::text
    from pg_proc as p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not exists (
        select 1 from pg_depend as d
        where d.objid = p.oid and d.deptype = 'e'
      )
    order by 1
  ),
  array['check_in_overview', 'check_in_summary', 'submit_check_in'],
  'authenticated can execute only the aggregates and submit_check_in'
);

select is(
  public.hook_before_user_created(
    '{"user":{"email":"Student@UMICH.EDU"}}'
  ),
  '{}'::jsonb,
  'the auth hook accepts an exact UM domain'
);
select is(
  public.hook_before_user_created(
    '{"user":{"email":"student@umich.edu.evil.com"}}'
  ) -> 'error' ->> 'http_code',
  '403',
  'the auth hook rejects a lookalike domain'
);
select is(
  public.hook_before_user_created(
    '{"user":{"email":"student@med.umich.edu"}}'
  ) -> 'error' ->> 'http_code',
  '403',
  'the auth hook rejects subdomains'
);

select lives_ok(
  $$update public.room_zones
    set mask_index = 3 - mask_index
    where floor_plan_id = '44444444-4444-4444-4444-444444444444'$$,
  'room mask indexes can swap during a re-export'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@umich.edu","role":"authenticated"}';

select lives_ok(
  $$insert into public.user_settings (user_id, settings)
    values (
      '11111111-1111-1111-1111-111111111111',
      '{"theme":"dark"}'
    )$$,
  'a user can insert their own settings'
);
select throws_ok(
  $$insert into public.user_settings (user_id, settings)
    values (
      '22222222-2222-2222-2222-222222222222',
      '{"theme":"dark"}'
    )$$,
  '42501',
  'new row violates row-level security policy for table "user_settings"',
  'a user cannot insert another user settings'
);
select is(
  (select count(*) from public.user_settings),
  1::bigint,
  'a user sees only their settings'
);

select lives_ok(
  $$select public.submit_check_in(
    target_kind => 'space',
    target_id => '33333333-3333-3333-3333-333333333333',
    noise => 'quiet',
    busyness => 'half_full',
    ease_of_focus => 4::smallint,
    features => '{outlets}'
  )$$,
  'a UM user can submit a check-in'
);
select throws_ok(
  $$select public.submit_check_in(
    target_kind => 'space',
    target_id => '33333333-3333-3333-3333-333333333333',
    noise => 'quiet'
  )$$,
  'PT429',
  'You checked in here in the last hour',
  'the hourly rate limit rejects a second check-in'
);
select throws_ok(
  $$select public.submit_check_in(
    target_kind => 'space',
    target_id => '77777777-7777-7777-7777-777777777777',
    noise => 'quiet'
  )$$,
  'P0002',
  'Unknown or unlisted check-in target',
  'unlisted spaces reject check-ins'
);
select lives_ok(
  $$select public.submit_check_in(
    target_kind => 'room',
    target_id => '55555555-5555-5555-5555-555555555555',
    light => 'bright',
    visited_at => null
  )$$,
  'a null visited_at defaults to now'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"99999999-9999-9999-9999-999999999999","email":"person@gmail.com","role":"authenticated"}';

select throws_ok(
  $$select public.submit_check_in(
    target_kind => 'room',
    target_id => '55555555-5555-5555-5555-555555555555',
    light => 'bright'
  )$$,
  '42501',
  'Sign in with your @umich.edu account to check in',
  'the RPC rejects a non-UM JWT'
);

reset role;
set local role anon;
reset request.jwt.claims;

select is(
  public.check_in_summary(
    'space',
    '33333333-3333-3333-3333-333333333333'
  ) ->> 'count',
  '1',
  'anon can read the aggregate count'
);
select is(
  (
    public.check_in_summary(
      'space',
      '33333333-3333-3333-3333-333333333333'
    ) -> 'noise' ->> 'quiet'
  ),
  '1',
  'anon can read aggregate distributions'
);

reset role;
update public.spaces
set is_listed = false
where id = '33333333-3333-3333-3333-333333333333';
set local role anon;

select is(
  public.check_in_summary(
    'space',
    '33333333-3333-3333-3333-333333333333'
  ) ->> 'count',
  '0',
  'unlisted spaces publish no aggregate'
);
select is(
  (select count(*) from public.check_in_overview('space')),
  0::bigint,
  'the overview omits unlisted spaces'
);

reset role;

select throws_ok(
  $$insert into public.photos (
    building_slug,
    path_prefix,
    widths,
    width,
    height,
    alt,
    credit,
    license,
    source_url
  ) values (
    'shapiro',
    'photos/buildings/shapiro/test',
    '{480}',
    480,
    320,
    ' ',
    'University of Michigan',
    'Used with credit',
    'https://example.com/photo'
  )$$,
  '23514',
  null,
  'photos require non-blank alt text'
);

select is(
  (select count(*) from private.check_ins),
  2::bigint,
  'only the two accepted check-ins were stored'
);

select * from finish();

rollback;

