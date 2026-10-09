-- Shared schemas and vocabularies used by every MVP package.

create schema private;

revoke all on schema private from public, anon, authenticated;

-- Supabase grants access to new public objects by default. Migrations opt in to
-- client access explicitly instead.
--
-- Caveat for functions: Postgres grants EXECUTE to PUBLIC globally, and a
-- schema-scoped default can't take a global grant away, so the `from public`
-- below is a no-op and anon can still execute new functions in public. Every
-- function must `revoke execute ... from public, anon, authenticated` itself;
-- supabase/tests/mvp_backend.test.sql fails if one is left callable by
-- accident. (A global `alter default privileges revoke execute on functions
-- from public` would also strip EXECUTE from extensions installed later.)
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

create type public.noise_level as enum (
  'quiet',
  'low_noise',
  'conversational',
  'loud'
);

create type public.light_level as enum (
  'dim',
  'moderate',
  'bright'
);

create type public.busyness_level as enum (
  'empty',
  'some_seats',
  'half_full',
  'mostly_full',
  'packed'
);

create type public.space_feature as enum (
  'natural_light',
  'wheelchair_accessible',
  'all_gender_restroom_on_floor',
  'whiteboards',
  'bookable',
  'external_monitors',
  'outlets',
  'computers',
  'printing',
  'scanners',
  'group_rooms'
);

create type public.space_source as enum (
  'um_library',
  'mguide',
  'manual'
);

-- Reused by tables with an updated_at column. This function is deliberately in
-- the non-exposed schema.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

