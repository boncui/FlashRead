-- Fix auth consistency issues:
-- 1. Change FK references from auth.users to profiles for consistency
-- 2. Add soft-delete checks to RLS policies
-- 3. Fix profile creation trigger with ON CONFLICT handling

-- ============================================
-- 1. Fix ocr_demand_signals FK reference
-- ============================================

-- Drop existing FK constraint
ALTER TABLE ocr_demand_signals 
  DROP CONSTRAINT IF EXISTS ocr_demand_signals_user_id_fkey;

-- Add new FK to profiles (maintains cascade behavior)
ALTER TABLE ocr_demand_signals 
  ADD CONSTRAINT ocr_demand_signals_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can insert own demand signals" ON ocr_demand_signals;
DROP POLICY IF EXISTS "Users can read own demand signals" ON ocr_demand_signals;

-- Recreate with soft-delete check (via profiles join)
CREATE POLICY "Users can insert own demand signals" ON ocr_demand_signals
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_id AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can read own demand signals" ON ocr_demand_signals
  FOR SELECT USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_id AND p.deleted_at IS NULL
    )
  );

-- ============================================
-- 2. Fix user_rsvp_settings FK reference
-- ============================================

-- Drop existing FK constraint
ALTER TABLE user_rsvp_settings 
  DROP CONSTRAINT IF EXISTS user_rsvp_settings_user_id_fkey;

-- Add new FK to profiles
ALTER TABLE user_rsvp_settings 
  ADD CONSTRAINT user_rsvp_settings_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own rsvp settings" ON user_rsvp_settings;
DROP POLICY IF EXISTS "Users can insert own rsvp settings" ON user_rsvp_settings;
DROP POLICY IF EXISTS "Users can update own rsvp settings" ON user_rsvp_settings;
DROP POLICY IF EXISTS "Users can delete own rsvp settings" ON user_rsvp_settings;

-- Recreate with soft-delete check
CREATE POLICY "Users can view own rsvp settings"
  ON user_rsvp_settings
  FOR SELECT
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_id AND p.deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own rsvp settings"
  ON user_rsvp_settings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_id AND p.deleted_at IS NULL)
  );

CREATE POLICY "Users can update own rsvp settings"
  ON user_rsvp_settings
  FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_id AND p.deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_id AND p.deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own rsvp settings"
  ON user_rsvp_settings
  FOR DELETE
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_id AND p.deleted_at IS NULL)
  );

-- ============================================
-- 3. Fix profile creation trigger
-- ============================================

-- Replace trigger function with ON CONFLICT handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    -- Only update if the profile was soft-deleted (reactivate account)
    deleted_at = NULL
  WHERE profiles.deleted_at IS NOT NULL;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger itself doesn't need to be recreated as it references the function

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile on signup with ON CONFLICT handling for idempotency';
