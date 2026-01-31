-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

-- Flashreads table
create table public.flashreads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled',
  source_text text not null,
  render_config jsonb not null default '{}'::jsonb,
  rendered_blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.flashreads enable row level security;

-- Profiles policies (select/update own row only)
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Flashreads policies (full CRUD on own rows only)
create policy "Users can view own flashreads"
  on public.flashreads for select
  using (auth.uid() = user_id);

create policy "Users can insert own flashreads"
  on public.flashreads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own flashreads"
  on public.flashreads for update
  using (auth.uid() = user_id);

create policy "Users can delete own flashreads"
  on public.flashreads for delete
  using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
