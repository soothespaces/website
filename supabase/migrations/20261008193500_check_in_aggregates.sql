-- Public, privacy-preserving summaries of private check-ins.

create function public.check_in_summary(
  target_kind text,
  target_id uuid,
  since interval default interval '90 days'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with matching_check_ins as (
    select check_ins.*
    from private.check_ins
    where case check_in_summary.target_kind
      when 'space' then check_ins.space_id = check_in_summary.target_id
      when 'room' then check_ins.room_zone_id = check_in_summary.target_id
      else false
    end
    and check_ins.visited_at > now() - least(
      greatest(
        coalesce(check_in_summary.since, interval '90 days'),
        interval '1 hour'
      ),
      interval '365 days'
    )
  )
  select jsonb_build_object(
    'count',
    (select count(*) from matching_check_ins),
    'last_at',
    (
      select date_bin(
        interval '15 minutes',
        max(visited_at),
        timestamptz 'epoch'
      )
      from matching_check_ins
    ),
    'noise',
    (
      select coalesce(jsonb_object_agg(value, answer_count), '{}'::jsonb)
      from (
        select noise as value, count(*) as answer_count
        from matching_check_ins
        where noise is not null
        group by noise
      ) as noise_counts
    ),
    'light',
    (
      select coalesce(jsonb_object_agg(value, answer_count), '{}'::jsonb)
      from (
        select light as value, count(*) as answer_count
        from matching_check_ins
        where light is not null
        group by light
      ) as light_counts
    ),
    'busyness',
    (
      select coalesce(jsonb_object_agg(value, answer_count), '{}'::jsonb)
      from (
        select busyness as value, count(*) as answer_count
        from matching_check_ins
        where busyness is not null
        group by busyness
      ) as busyness_counts
    ),
    'natural_light',
    (select count(*) from matching_check_ins where natural_light),
    'ease_of_focus_median',
    (
      select percentile_disc(0.5) within group (order by ease_of_focus)
      from matching_check_ins
    ),
    'features',
    (
      select coalesce(jsonb_object_agg(value, answer_count), '{}'::jsonb)
      from (
        select feature as value, count(*) as answer_count
        from matching_check_ins,
          unnest(matching_check_ins.features) as feature
        group by feature
      ) as feature_counts
    )
  );
$$;

create function public.check_in_overview(
  target_kind text,
  since interval default interval '90 days'
)
returns table (
  target_id uuid,
  check_in_count bigint,
  last_at timestamptz,
  typical_noise public.noise_level,
  typical_light public.light_level,
  ease_of_focus_median smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(check_ins.space_id, check_ins.room_zone_id) as target_id,
    count(*) as check_in_count,
    date_bin(
      interval '15 minutes',
      max(check_ins.visited_at),
      timestamptz 'epoch'
    ) as last_at,
    mode() within group (order by check_ins.noise) as typical_noise,
    mode() within group (order by check_ins.light) as typical_light,
    percentile_disc(0.5)
      within group (order by check_ins.ease_of_focus)
      as ease_of_focus_median
  from private.check_ins
  where check_ins.visited_at > now() - least(
    greatest(
      coalesce(check_in_overview.since, interval '90 days'),
      interval '1 hour'
    ),
    interval '365 days'
  )
  and case check_in_overview.target_kind
    when 'space' then check_ins.space_id is not null
    when 'room' then check_ins.room_zone_id is not null
    else false
  end
  group by coalesce(check_ins.space_id, check_ins.room_zone_id);
$$;

revoke execute on function public.check_in_summary(text, uuid, interval)
  from public, anon, authenticated;
revoke execute on function public.check_in_overview(text, interval)
  from public, anon, authenticated;

grant execute on function public.check_in_summary(text, uuid, interval)
  to anon, authenticated;
grant execute on function public.check_in_overview(text, interval)
  to anon, authenticated;

