-- Helper that reads the caller's current workspace without triggering RLS recursion on profiles
create or replace function public.current_profile_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.profiles where id = auth.uid()
$$;

revoke execute on function public.current_profile_workspace_id() from anon;
grant execute on function public.current_profile_workspace_id() to authenticated;

-- 1. Prevent users moving themselves into another workspace via profiles update
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and workspace_id = public.current_profile_workspace_id()
);

-- 2. Explicitly deny role self-assignment through the Data API.
-- Grants were already revoked; these restrictive policies make the denial explicit.
drop policy if exists user_roles_deny_insert on public.user_roles;
create policy user_roles_deny_insert
on public.user_roles
for insert
to authenticated
with check (false);

drop policy if exists user_roles_deny_update on public.user_roles;
create policy user_roles_deny_update
on public.user_roles
for update
to authenticated
using (false)
with check (false);

drop policy if exists user_roles_deny_delete on public.user_roles;
create policy user_roles_deny_delete
on public.user_roles
for delete
to authenticated
using (false);