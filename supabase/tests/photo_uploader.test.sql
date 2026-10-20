begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(4);

select ok(
  not has_column_privilege('anon', 'public.photos', 'uploaded_by', 'select'),
  'anon cannot read who uploaded a photo'
);

select ok(
  has_column_privilege('anon', 'public.photos', 'path_prefix', 'select'),
  'anon can still read the other photo columns'
);

select is(
  (
    select count(*)::int
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'photos'
      and c.column_name <> 'uploaded_by'
      and not has_column_privilege('anon', 'public.photos', c.column_name, 'select')
  ),
  0,
  'anon can read every photo column but uploaded_by'
);

select ok(
  has_column_privilege('authenticated', 'public.photos', 'uploaded_by', 'select'),
  'signed-in users (admins on /admin/photos) can read uploaded_by'
);

select * from finish();
rollback;
