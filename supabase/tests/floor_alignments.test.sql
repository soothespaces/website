begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(13);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@umich.edu","role":"authenticated"}';

select is(public.is_admin(), false, 'a student is not an admin');

select throws_ok(
  $$insert into public.floor_alignments (sheet, sha256, width, height, corners, aligned_by)
    values ('test_1', repeat('a', 64), 10, 10, '[[0,0],[1,0],[1,1],[0,1]]', 'student@umich.edu')$$,
  '42501',
  null,
  'a student cannot save an alignment'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"TKaslan@umich.edu","role":"authenticated"}';

select is(public.is_admin(), true, 'an admin is an admin, whatever the email case');

select lives_ok(
  $$insert into public.floor_alignments (sheet, sha256, width, height, corners, aligned_by)
    values ('test_1', repeat('a', 64), 10, 10, '[[0,0],[1,0],[1,1],[0,1]]', 'someone@umich.edu')$$,
  'an admin can save an alignment'
);

select is(
  (select aligned_by from public.floor_alignment_authors() where sheet = 'test_1'),
  'tkaslan@umich.edu',
  'aligned_by is the signed-in admin, not what the client sent'
);

select lives_ok(
  $$update public.floor_alignments set corners = '[[0,0],[2,0],[2,2],[0,2]]' where sheet = 'test_1'$$,
  'an admin can change an alignment'
);

-- The editor's Save is a PostgREST upsert. Its DO UPDATE reads EXCLUDED for
-- every column it sends, which needs SELECT on that column, and aligned_by
-- is no longer selectable. The app leaves aligned_by out; the stamp trigger
-- fills it (Tanner hit "permission denied for table floor_alignments").
select lives_ok(
  $$insert into public.floor_alignments (sheet, sha256, width, height, corners)
    values ('test_1', repeat('a', 64), 10, 10, '[[0,0],[3,0],[3,3],[0,3]]')
    on conflict (sheet) do update set
      sha256 = excluded.sha256, width = excluded.width, height = excluded.height, corners = excluded.corners
    returning aligned_at$$,
  'an admin can save over an alignment the way the editor does'
);

select throws_ok(
  $$insert into public.floor_alignments (sheet, sha256, width, height, corners, aligned_by)
    values ('test_1', repeat('a', 64), 10, 10, '[[0,0],[3,0],[3,3],[0,3]]', '')
    on conflict (sheet) do update set corners = excluded.corners, aligned_by = excluded.aligned_by$$,
  '42501',
  null,
  'an upsert that sends aligned_by is refused, so the app must not send it'
);

select throws_ok(
  $$insert into public.floor_alignments (sheet, sha256, width, height, corners, aligned_by)
    values ('test_2', repeat('a', 64), 10, 10, '[[0,0],[1,0]]', '')$$,
  '23514',
  null,
  'corners must be four points'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"student@umich.edu","role":"authenticated"}';

update public.floor_alignments set corners = '[]' where sheet = 'test_1';
delete from public.floor_alignments where sheet = 'test_1';

select is(
  (select corners from public.floor_alignments where sheet = 'test_1'),
  '[[0,0],[3,0],[3,3],[0,3]]'::jsonb,
  'a student cannot change or remove an alignment'
);

select throws_ok(
  $$select count(*) from private.admins$$,
  '42501',
  null,
  'the admin list is not readable from the API'
);

reset role;
set local role anon;
reset request.jwt.claims;

select is(
  (select count(*)::int from public.floor_alignments where sheet = 'test_1'),
  1,
  'anon can read alignments'
);

select ok(
  not has_function_privilege('anon', 'public.is_admin()', 'execute'),
  'anon cannot call is_admin'
);

select * from finish();

rollback;
