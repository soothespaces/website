-- WP3: metadata for pre-resized building and study-space photos.
-- The bucket remains empty until the photo import is run.

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  building_slug text
    references public.buildings (slug)
    on update cascade,
  space_id uuid
    references public.spaces (id),
  path_prefix text not null unique
    check (length(trim(path_prefix)) > 0),
  widths smallint[] not null check (
    cardinality(widths) > 0
    and array_position(widths, null) is null
    and 0 < all(widths)
  ),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt text not null check (length(trim(alt)) > 0),
  credit text not null check (length(trim(credit)) > 0),
  license text not null check (length(trim(license)) > 0),
  source_url text not null check (length(trim(source_url)) > 0),
  sort_order smallint not null default 0,
  is_listed boolean not null default true,
  constraint photo_has_one_subject check (
    num_nonnulls(building_slug, space_id) = 1
  )
);

create index photos_building_order_idx
  on public.photos (building_slug, sort_order)
  where building_slug is not null and is_listed;
create index photos_space_order_idx
  on public.photos (space_id, sort_order)
  where space_id is not null and is_listed;

alter table public.photos enable row level security;

create policy "listed photos are publicly readable"
on public.photos
for select
to anon, authenticated
using (is_listed);

revoke all on public.photos from anon, authenticated;
grant select on public.photos to anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'photos',
  'photos',
  true,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

