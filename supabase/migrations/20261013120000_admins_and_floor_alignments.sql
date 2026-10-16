-- Team admins, and floor-plan alignments saved from the /admin/floors editor.
--
-- private.admins is the one list of admin accounts. public.is_admin() reads
-- it for the signed-in user; RLS policies below and the app's /admin guard
-- (src/lib/auth/admin.ts) both go through that function. Add or remove an
-- admin with a new migration.

create table private.admins (
  email text primary key check (email = lower(email) and email ~ '^[^@]+@umich\.edu$'),
  name text not null
);

insert into private.admins (email, name)
values
  ('tkaslan@umich.edu', 'Tanner Aslan'),
  ('gjonpjer@umich.edu', 'Gjonpjer Kola'),
  ('markzhu@umich.edu', 'Mark Zhu'),
  ('calvinyi@umich.edu', 'Calvin Yi');

-- Keyed on the JWT's email claim, which Supabase Auth sets from auth.users
-- (not user-editable metadata). Sign-up only admits @umich.edu Google
-- accounts (hook_before_user_created), so an admin's email is theirs.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admins
    where admins.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- One row per MPrint sheet: the corners an admin set by hand. The MPrint fit
-- workflow (scripts/mprint/pipeline.py) reads these and uses them instead of
-- the automatic fit, the same way it uses scripts/mprint/manual/<sheet>.json.
create table public.floor_alignments (
  sheet text primary key check (sheet ~ '^[a-z0-9_]+$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- MapLibre image-source order: top-left, top-right, bottom-right,
  -- bottom-left. Each coordinate is [longitude, latitude].
  corners jsonb not null check (
    jsonb_typeof(corners) = 'array'
    and jsonb_array_length(corners) = 4
  ),
  aligned_by text not null,
  aligned_at timestamptz not null default now()
);

-- Every write records who saved it and when. Writes from a signed-in user
-- always take that user's email; writes without one (the dashboard, service
-- role) keep what they set.
create function private.stamp_alignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aligned_by = coalesce(lower(auth.jwt() ->> 'email'), new.aligned_by);
  new.aligned_at = now();
  return new;
end;
$$;

revoke execute on function private.stamp_alignment() from public, anon, authenticated;

create trigger floor_alignments_stamp
before insert or update on public.floor_alignments
for each row
execute function private.stamp_alignment();

alter table public.floor_alignments enable row level security;

-- Corners aren't sensitive, and the pipeline reads them with the publishable
-- key, so anyone may read them. Only admins may write.
create policy "floor alignments are publicly readable"
on public.floor_alignments
for select
to anon, authenticated
using (true);

create policy "admins can add floor alignments"
on public.floor_alignments
for insert
to authenticated
with check ((select public.is_admin()));

create policy "admins can change floor alignments"
on public.floor_alignments
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "admins can remove floor alignments"
on public.floor_alignments
for delete
to authenticated
using ((select public.is_admin()));

revoke all on public.floor_alignments from anon, authenticated;
grant select on public.floor_alignments to anon, authenticated;
grant insert, update, delete on public.floor_alignments to authenticated;
