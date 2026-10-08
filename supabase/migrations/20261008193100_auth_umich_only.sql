-- Reject non-UM accounts before Supabase Auth creates auth.users rows.
-- Production must also enable this function under Authentication -> Hooks.

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if lower(coalesce(event -> 'user' ->> 'email', ''))
    !~ '^[^@]+@umich\.edu$'
  then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'Use your @umich.edu Google account'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb)
  from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb)
  to supabase_auth_admin;

