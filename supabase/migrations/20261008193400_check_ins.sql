-- WP4: raw check-ins. The private schema is not exposed through PostgREST and
-- client roles have no schema or table privileges.

create table private.check_ins (
  id bigint generated always as identity primary key,
  user_id uuid
    references auth.users (id)
    on delete set null,
  space_id uuid
    references public.spaces (id),
  room_zone_id uuid
    references public.room_zones (id),
  visited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  noise public.noise_level,
  light public.light_level,
  natural_light boolean,
  busyness public.busyness_level,
  -- 1 = very hard; 5 = very easy.
  ease_of_focus smallint check (ease_of_focus between 1 and 5),
  features public.space_feature[] not null default '{}',
  constraint check_in_has_one_target check (
    num_nonnulls(space_id, room_zone_id) = 1
  ),
  constraint check_in_has_an_answer check (
    num_nonnulls(
      noise,
      light,
      natural_light,
      busyness,
      ease_of_focus
    ) > 0
    or cardinality(features) > 0
  )
);

alter table private.check_ins enable row level security;

create index check_ins_space_visited_idx
  on private.check_ins (space_id, visited_at desc)
  where space_id is not null;
create index check_ins_room_visited_idx
  on private.check_ins (room_zone_id, visited_at desc)
  where room_zone_id is not null;
create index check_ins_user_created_idx
  on private.check_ins (user_id, created_at desc)
  where user_id is not null;

revoke all on private.check_ins from public, anon, authenticated;
revoke all on sequence private.check_ins_id_seq from public, anon, authenticated;

create function public.submit_check_in(
  target_kind text,
  target_id uuid,
  noise public.noise_level default null,
  light public.light_level default null,
  natural_light boolean default null,
  busyness public.busyness_level default null,
  ease_of_focus smallint default null,
  features public.space_feature[] default '{}',
  visited_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user uuid := auth.uid();
  target_space uuid :=
    case when target_kind = 'space' then target_id end;
  target_room uuid :=
    case when target_kind = 'room' then target_id end;
  visit_time timestamptz := coalesce(submit_check_in.visited_at, now());
begin
  if requesting_user is null
    or lower(coalesce(auth.jwt() ->> 'email', ''))
      !~ '^[^@]+@umich\.edu$'
  then
    raise exception 'Sign in with your @umich.edu account to check in'
      using errcode = '42501';
  end if;

  if target_space is null and target_room is null then
    raise exception 'target_kind must be space or room'
      using errcode = '22023';
  end if;

  -- Only listed spaces, and rooms on listed floor plans, accept check-ins.
  if not (
    exists (
      select 1
      from public.spaces
      where spaces.id = target_space
        and spaces.is_listed
    )
    or exists (
      select 1
      from public.room_zones
      join public.floor_plans
        on floor_plans.id = room_zones.floor_plan_id
      where room_zones.id = target_room
        and floor_plans.is_listed
    )
  ) then
    raise exception 'Unknown or unlisted check-in target'
      using errcode = 'P0002';
  end if;

  if visit_time > now() + interval '5 minutes'
    or visit_time < now() - interval '24 hours'
  then
    raise exception 'visited_at must be within the last 24 hours'
      using errcode = '22023';
  end if;

  -- Serialize concurrent submissions to the same target by one user so two
  -- requests cannot both pass the rate-limit check.
  perform pg_advisory_xact_lock(
    hashtextextended(
      requesting_user::text || ':' || target_kind || ':' || target_id::text,
      0
    )
  );

  if exists (
    select 1
    from private.check_ins
    where check_ins.user_id = requesting_user
      and check_ins.space_id is not distinct from target_space
      and check_ins.room_zone_id is not distinct from target_room
      and check_ins.created_at > now() - interval '1 hour'
  ) then
    raise exception 'You checked in here in the last hour'
      using errcode = 'PT429';
  end if;

  insert into private.check_ins (
    user_id,
    space_id,
    room_zone_id,
    visited_at,
    noise,
    light,
    natural_light,
    busyness,
    ease_of_focus,
    features
  )
  values (
    requesting_user,
    target_space,
    target_room,
    visit_time,
    submit_check_in.noise,
    submit_check_in.light,
    submit_check_in.natural_light,
    submit_check_in.busyness,
    submit_check_in.ease_of_focus,
    coalesce(submit_check_in.features, '{}')
  );
end;
$$;

revoke execute on function public.submit_check_in(
  text,
  uuid,
  public.noise_level,
  public.light_level,
  boolean,
  public.busyness_level,
  smallint,
  public.space_feature[],
  timestamptz
) from public, anon;

grant execute on function public.submit_check_in(
  text,
  uuid,
  public.noise_level,
  public.light_level,
  boolean,
  public.busyness_level,
  smallint,
  public.space_feature[],
  timestamptz
) to authenticated;

