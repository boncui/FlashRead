-- RSVP User Settings
-- Stores per-user timing preferences for the RSVP reader
-- Settings are saved as JSONB to allow flexible schema evolution

CREATE TABLE IF NOT EXISTS user_rsvp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One settings row per user
  CONSTRAINT user_rsvp_settings_user_id_unique UNIQUE(user_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_rsvp_settings_user_id ON user_rsvp_settings(user_id);

-- RLS policies
ALTER TABLE user_rsvp_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own settings
CREATE POLICY "Users can view own rsvp settings"
  ON user_rsvp_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own rsvp settings"
  ON user_rsvp_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own rsvp settings"
  ON user_rsvp_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own settings (for reset to factory)
CREATE POLICY "Users can delete own rsvp settings"
  ON user_rsvp_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_rsvp_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_user_rsvp_settings_updated_at ON user_rsvp_settings;
CREATE TRIGGER trigger_user_rsvp_settings_updated_at
  BEFORE UPDATE ON user_rsvp_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_rsvp_settings_updated_at();

-- Comment on table
COMMENT ON TABLE user_rsvp_settings IS 'Per-user RSVP reader timing preferences (WPM, punctuation pauses, etc.)';
