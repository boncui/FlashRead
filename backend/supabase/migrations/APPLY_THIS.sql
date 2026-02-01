-- Combined migrations for FlashRead
-- Apply this SQL in Supabase Dashboard > SQL Editor
-- Project: https://supabase.com/dashboard/project/iqspeaeuxpeijyncoiua/sql/new

-- ============================================================
-- Migration 00004: Document OCR Schema
-- ============================================================

-- Add content_hash for content-addressing and deduplication
-- SHA-256 hash of the PDF file bytes
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add unique index on content_hash for deduplication
-- (allows NULL values - old documents won't have hashes)
CREATE UNIQUE INDEX IF NOT EXISTS documents_content_hash_idx 
  ON public.documents(content_hash) 
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

-- Add ocr_versions JSONB to store multiple OCR outputs
-- Structure: { "nougat_v1": { "created_at": "...", "model_version": "...", "pages": [...] }, ... }
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ocr_versions JSONB NOT NULL DEFAULT '{}';

-- Add derived_content JSONB to store processed/derived representations
-- Structure: { "markdown_v1": { "content": "...", "created_at": "..." }, "flashread_v1": { ... }, ... }
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS derived_content JSONB NOT NULL DEFAULT '{}';

-- Update status values to include new states for OCR pipeline
-- Current: 'uploading', 'processing', 'ready', 'error'
-- New states: 'pending_ocr' (uploaded, waiting for OCR), 'uploaded' (file in R2, ready for processing)
-- Note: Using text type, no constraint needed. Document the valid values:
-- - 'uploading': File upload in progress
-- - 'uploaded': File successfully uploaded to R2, pending OCR
-- - 'pending_ocr': Queued for OCR processing
-- - 'processing': OCR in progress
-- - 'ready': OCR complete, content available
-- - 'error': Processing failed

COMMENT ON COLUMN public.documents.status IS 'Document processing status: uploading, uploaded, pending_ocr, processing, ready, error';
COMMENT ON COLUMN public.documents.content_hash IS 'SHA-256 hash of file bytes for content-addressing and deduplication';
COMMENT ON COLUMN public.documents.ocr_versions IS 'Versioned OCR outputs: { "nougat_v1": { pages: [...], created_at, model_version }, ... }';
COMMENT ON COLUMN public.documents.derived_content IS 'Derived content representations: { "markdown_v1": {...}, "flashread_v1": {...}, ... }';

-- ============================================================
-- Migration 00005: Document Jobs Queue
-- ============================================================

-- Add document_jobs table for async job queue
-- Phase 2a: Text extraction with job queue infrastructure

CREATE TABLE IF NOT EXISTS public.document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'extraction',
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for efficient job claiming (pending jobs sorted by priority and creation time)
CREATE INDEX IF NOT EXISTS document_jobs_pending_idx ON public.document_jobs(status, priority DESC, created_at)
  WHERE status = 'pending';

-- Index for looking up jobs by document
CREATE INDEX IF NOT EXISTS document_jobs_document_idx ON public.document_jobs(document_id);

-- Comments for documentation
COMMENT ON TABLE public.document_jobs IS 'Async job queue for document processing (extraction, OCR)';
COMMENT ON COLUMN public.document_jobs.job_type IS 'Type of job: extraction (Phase 2a), ocr (Phase 2b)';
COMMENT ON COLUMN public.document_jobs.status IS 'Job status: pending, processing, completed, failed';
COMMENT ON COLUMN public.document_jobs.locked_at IS 'Timestamp when job was claimed by a worker';
COMMENT ON COLUMN public.document_jobs.locked_by IS 'Worker ID that claimed this job';
COMMENT ON COLUMN public.document_jobs.result IS 'Job result payload (OcrVersion structure)';

-- ============================================================
-- Migration 00007: Fix storage_key Unique Constraint
-- ============================================================
-- Problem: The unconditional UNIQUE constraint on storage_key blocks re-uploads
-- of files that were previously soft-deleted (deleted_at is set but row remains).
--
-- Solution: Convert to a partial unique index that excludes soft-deleted documents.

-- Drop the existing unique constraint (if it exists)
-- Note: This may fail if already converted to an index - that's OK
DO $$
BEGIN
  ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_storage_key_key;
EXCEPTION
  WHEN undefined_object THEN
    -- Constraint doesn't exist, that's fine
    NULL;
END $$;

-- Drop old index if it exists (in case this is re-run)
DROP INDEX IF EXISTS documents_storage_key_idx;

-- Create partial unique index (excludes soft-deleted docs)
CREATE UNIQUE INDEX documents_storage_key_idx 
  ON public.documents(storage_key) 
  WHERE deleted_at IS NULL;

COMMENT ON INDEX documents_storage_key_idx IS 'Partial unique index on storage_key, excludes soft-deleted documents to allow re-uploads';
