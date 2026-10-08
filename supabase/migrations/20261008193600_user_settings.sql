-- WP2: settings are local-first in the MVP; this table enables later sync.

create table public.user_settings (
  user_id uuid primary key
    references auth.users (id)
    on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

alter table public.user_settings enable row level security;

create policy "users can read their own settings"
on public.user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can insert their own settings"
on public.user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update their own settings"
on public.user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can delete their own settings"
on public.user_settings
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.user_settings from anon, authenticated;
grant select, insert, update, delete
  on public.user_settings
  to authenticated;

