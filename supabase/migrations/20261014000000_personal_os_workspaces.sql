create table if not exists public.personal_os_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  revision bigint not null default 1
);

alter table public.personal_os_workspaces enable row level security;
revoke all on public.personal_os_workspaces from anon;
grant select, insert, update on public.personal_os_workspaces to authenticated;

drop policy if exists "Users can read their own workspace" on public.personal_os_workspaces;
create policy "Users can read their own workspace"
  on public.personal_os_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own workspace" on public.personal_os_workspaces;
create policy "Users can insert their own workspace"
  on public.personal_os_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own workspace" on public.personal_os_workspaces;
create policy "Users can update their own workspace"
  on public.personal_os_workspaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.save_my_workspace(workspace_data jsonb, expected_revision bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if expected_revision is null then
    insert into public.personal_os_workspaces (user_id, data)
    values (current_user_id, workspace_data)
    on conflict (user_id) do nothing;
    return found;
  end if;
  update public.personal_os_workspaces
    set data = workspace_data, updated_at = clock_timestamp(), revision = revision + 1
    where user_id = current_user_id and revision = expected_revision;
  return found;
end;
$$;

revoke all on function public.save_my_workspace(jsonb, bigint) from public, anon;
grant execute on function public.save_my_workspace(jsonb, bigint) to authenticated;
