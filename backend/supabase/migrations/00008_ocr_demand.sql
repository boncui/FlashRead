-- Migration: Add OCR demand tracking table
-- Purpose: Track user demand for OCR feature (for analytics on feature requests)

CREATE TABLE ocr_demand_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  click_count INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX idx_ocr_demand_user ON ocr_demand_signals(user_id);
CREATE INDEX idx_ocr_demand_created ON ocr_demand_signals(created_at);

-- RLS: users can only insert their own records
ALTER TABLE ocr_demand_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own demand signals" ON ocr_demand_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own signals (optional, for potential UI display)
CREATE POLICY "Users can read own demand signals" ON ocr_demand_signals
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE ocr_demand_signals IS 'Tracks user demand for OCR feature when they click the OCR button multiple times';
COMMENT ON COLUMN ocr_demand_signals.click_count IS 'Number of times user clicked OCR button in a single session before seeing coming soon message';
