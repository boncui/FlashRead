-- Fix missing user profiles
-- Run this in Supabase SQL Editor if you get "violates foreign key constraint documents_user_id_fkey"

-- This creates profile records for any auth users that don't have profiles yet
INSERT INTO public.profiles (id, email)
SELECT 
  u.id,
  u.email
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Verify: Check how many profiles were created
SELECT 
  COUNT(*) as profile_count,
  (SELECT COUNT(*) FROM auth.users) as user_count
FROM public.profiles;
