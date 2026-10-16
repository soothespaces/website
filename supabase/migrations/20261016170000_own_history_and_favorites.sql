-- "Your spots" and "Your rotation" in the side panel.
-- ADR 0011 amends ADR 0007: a signed-in user can read their own check-in
-- counts and last-visit days. Raw rows stay in private.check_ins.

-- One row per space or room the caller has checked in to. No raw rows, ids,
-- user_id, exact times or answers. check_ins_user_created_idx covers the filter.
create function public.my_check_in_history()
returns table (
  target_kind text,
  target_id uuid,
  check_in_count bigint,
  last_visited_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when ci.space_id is not null then 'space' else 'room' end,
    coalesce(ci.space_id, ci.room_zone_id),
    count(*),
    max((ci.visited_at at time zone 'America/Detroit')::date)
  from private.check_ins as ci
  where ci.user_id = (select auth.uid())
    and (
      exists (
        select 1
        from public.spaces as s
        where s.id = ci.space_id
          and s.is_listed
      )
      or exists (
        select 1
        from public.room_zones as rz
        join public.floor_plans as fp on fp.id = rz.floor_plan_id
        where rz.id = ci.room_zone_id
          and fp.is_listed
      )
    )
  group by 1, 2
  order by 4 desc, 3 desc;
$$;

revoke execute on function public.my_check_in_history()
  from public, anon, authenticated;
grant execute on function public.my_check_in_history() to authenticated;

-- Saved places, in the user's own order. Not check-ins, so ADR 0007 doesn't
-- apply; owner-only RLS like user_settings.
create table public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid()
    references auth.users (id)
    on delete cascade,
  space_id uuid
    references public.spaces (id)
    on delete cascade,
  building_slug text
    references public.buildings (slug)
    on delete cascade
    on update cascade,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint favorites_one_target
    check (num_nonnulls(space_id, building_slug) = 1),
  constraint favorites_user_space_key unique (user_id, space_id),
  constraint favorites_user_building_key unique (user_id, building_slug)
);

create index favorites_user_position_idx
  on public.favorites (user_id, position);
create index favorites_space_id_idx
  on public.favorites (space_id)
  where space_id is not null;
create index favorites_building_slug_idx
  on public.favorites (building_slug)
  where building_slug is not null;

alter table public.favorites enable row level security;

create policy "users can read their own favorites"
on public.favorites
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can insert their own favorites"
on public.favorites
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update their own favorites"
on public.favorites
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can delete their own favorites"
on public.favorites
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.favorites from anon, authenticated;
grant select, insert, update, delete
  on public.favorites
  to authenticated;
