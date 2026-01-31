-- Add deleted_at column for soft delete
alter table public.profiles add column deleted_at timestamptz;

-- Update RLS policies to exclude soft-deleted profiles
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id and deleted_at is null);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id and deleted_at is null);

-- Update flashreads policies to exclude soft-deleted users
drop policy if exists "Users can view own flashreads" on public.flashreads;
drop policy if exists "Users can insert own flashreads" on public.flashreads;
drop policy if exists "Users can update own flashreads" on public.flashreads;
drop policy if exists "Users can delete own flashreads" on public.flashreads;

create policy "Users can view own flashreads"
  on public.flashreads for select
  using (
    auth.uid() = user_id 
    and exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and deleted_at is null
    )
  );

create policy "Users can insert own flashreads"
  on public.flashreads for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and deleted_at is null
    )
  );

create policy "Users can update own flashreads"
  on public.flashreads for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and deleted_at is null
    )
  );

create policy "Users can delete own flashreads"
  on public.flashreads for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and deleted_at is null
    )
  );
