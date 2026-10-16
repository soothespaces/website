-- Class meetings per classroom for the current term, from mguide's
-- room-schedules.json (which mguide builds from the Registrar's schedule).
-- Seeded by scripts/seed/build.mjs. classroom_availability() turns them into
-- "no class scheduled until …" for each room.

create table public.classroom_meetings (
  id bigint generated always as identity primary key,
  -- The Registrar's room code, e.g. 'EQ-B804' or 'MLB-AUD 4'.
  room_code text not null check (length(trim(room_code)) > 0),
  building_code text not null check (length(trim(building_code)) > 0),
  room_number text not null check (length(trim(room_number)) > 0),
  building_slug text
    references public.buildings (slug)
    on update cascade
    on delete set null,
  course text not null,
  section text not null,
  title text,
  cross_listed text[] not null default '{}',
  -- 0 = Sunday, as in building_popular_times and extract(dow).
  weekdays smallint[] not null check (
    cardinality(weekdays) > 0
    and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]
  ),
  starts time not null,
  ends time not null,
  first_day date not null,
  last_day date not null,
  source text not null default 'mguide'
    check (source in ('mguide', 'manual')),
  constraint classroom_meeting_times check (ends > starts),
  constraint classroom_meeting_dates check (last_day >= first_day)
);

create index classroom_meetings_room_code_idx
  on public.classroom_meetings (room_code);
create index classroom_meetings_building_slug_idx
  on public.classroom_meetings (building_slug)
  where building_slug is not null;

alter table public.classroom_meetings enable row level security;

create policy "classroom meetings are publicly readable"
on public.classroom_meetings
for select
to anon, authenticated
using (true);

revoke all on public.classroom_meetings from anon, authenticated;
grant select on public.classroom_meetings to anon, authenticated;

-- One row per room with a class this term, as of `as_of` in Ann Arbor time.
-- in_class: a class is meeting now. busy_until is when it ends (another class
-- may start right after). free_until: when the room isn't in class, the start
-- of its next class today, or null if none is left today. An empty classroom
-- isn't necessarily open, so the app should say "no class scheduled", not
-- "open".
create function public.classroom_availability(as_of timestamptz default now())
returns table (
  room_code text,
  building_slug text,
  room_number text,
  in_class boolean,
  current_course text,
  busy_until time,
  free_until time
)
language sql
stable
set search_path = ''
as $$
  with local_now as (
    select
      (classroom_availability.as_of at time zone 'America/Detroit')::date as day,
      (classroom_availability.as_of at time zone 'America/Detroit')::time as clock
  ),
  today as (
    select m.room_code, m.course, m.starts, m.ends, n.clock
    from public.classroom_meetings as m, local_now as n
    where n.day between m.first_day and m.last_day
      and extract(dow from n.day)::smallint = any (m.weekdays)
  ),
  current_class as (
    select distinct on (t.room_code) t.room_code, t.course, t.ends
    from today as t
    where t.starts <= t.clock and t.ends > t.clock
    order by t.room_code, t.ends desc
  ),
  next_class as (
    select t.room_code, min(t.starts) as starts
    from today as t
    where t.starts > t.clock
    group by t.room_code
  ),
  rooms as (
    select distinct on (m.room_code) m.room_code, m.building_slug, m.room_number
    from public.classroom_meetings as m
    order by m.room_code, m.building_slug nulls last
  )
  select
    r.room_code,
    r.building_slug,
    r.room_number,
    c.room_code is not null,
    c.course,
    c.ends,
    case when c.room_code is null then nc.starts end
  from rooms as r
  left join current_class as c on c.room_code = r.room_code
  left join next_class as nc on nc.room_code = r.room_code
  order by r.room_code;
$$;

revoke execute on function public.classroom_availability(timestamptz)
  from public, anon, authenticated;
grant execute on function public.classroom_availability(timestamptz)
  to anon, authenticated;
