-- Run once in the Supabase SQL Editor. User data is private by auth.uid().
create table if not exists public.salary_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (payload ? 'employees' and jsonb_typeof(payload->'employees') = 'array'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.salary_snapshots enable row level security;
revoke all on public.salary_snapshots from anon;
grant select, insert, update on public.salary_snapshots to authenticated;
drop policy if exists salary_owner_select on public.salary_snapshots;
create policy salary_owner_select on public.salary_snapshots for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists salary_owner_insert on public.salary_snapshots;
create policy salary_owner_insert on public.salary_snapshots for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists salary_owner_update on public.salary_snapshots;
create policy salary_owner_update on public.salary_snapshots for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Optimistic locking prevents one device from silently replacing another's changes.
create or replace function public.save_salary_snapshot(payload jsonb, expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare current_revision bigint;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if jsonb_typeof(payload->'employees') is distinct from 'array' then
    raise exception 'Invalid employee snapshot' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.salary_snapshots(user_id, payload) values (auth.uid(), payload)
      on conflict (user_id) do nothing returning revision into current_revision;
    if current_revision is null then raise exception 'Snapshot conflict' using errcode = '40001'; end if;
    return jsonb_build_object('revision', current_revision);
  end if;
  select revision into current_revision from public.salary_snapshots where user_id = auth.uid() for update;
  if current_revision is distinct from expected_revision then raise exception 'Snapshot conflict' using errcode = '40001'; end if;
  update public.salary_snapshots set payload = save_salary_snapshot.payload, revision = current_revision + 1, updated_at = now() where user_id = auth.uid();
  return jsonb_build_object('revision', current_revision + 1);
end;
$$;
revoke all on function public.save_salary_snapshot(jsonb, bigint) from public, anon;
grant execute on function public.save_salary_snapshot(jsonb, bigint) to authenticated;
