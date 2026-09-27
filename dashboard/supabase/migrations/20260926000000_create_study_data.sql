create table if not exists public.study_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.study_data enable row level security;

drop policy if exists "Users can read their own study data" on public.study_data;
create policy "Users can read their own study data"
  on public.study_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own study data" on public.study_data;
create policy "Users can create their own study data"
  on public.study_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own study data" on public.study_data;
create policy "Users can update their own study data"
  on public.study_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own study data" on public.study_data;
create policy "Users can delete their own study data"
  on public.study_data for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.study_data to authenticated;

create or replace function public.set_study_data_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_study_data_updated_at on public.study_data;
create trigger set_study_data_updated_at
  before update on public.study_data
  for each row execute function public.set_study_data_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'study_data'
  ) then
    execute 'alter publication supabase_realtime add table public.study_data';
  end if;
end;
$$;
