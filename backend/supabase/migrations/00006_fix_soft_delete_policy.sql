-- Fix the UPDATE policy to allow soft deletes
-- The issue: USING clause without WITH CHECK means the new row must also satisfy USING
-- When soft-deleting, deleted_at becomes non-null, failing the "deleted_at is null" check

-- Drop the existing policy
drop policy if exists "Users can update own documents" on public.documents;

-- Create a new policy that:
-- 1. USING: Only allows updating non-deleted documents owned by the user
-- 2. WITH CHECK: Only requires user ownership (allows setting deleted_at)
create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id and deleted_at is null)
  with check (auth.uid() = user_id);
