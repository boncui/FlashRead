-- Add document_jobs table for async job queue
-- Phase 2a: Text extraction with job queue infrastructure

CREATE TABLE public.document_jobs (
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
CREATE INDEX document_jobs_pending_idx ON public.document_jobs(status, priority DESC, created_at)
  WHERE status = 'pending';

-- Index for looking up jobs by document
CREATE INDEX document_jobs_document_idx ON public.document_jobs(document_id);

-- Comments for documentation
COMMENT ON TABLE public.document_jobs IS 'Async job queue for document processing (extraction, OCR)';
COMMENT ON COLUMN public.document_jobs.job_type IS 'Type of job: extraction (Phase 2a), ocr (Phase 2b)';
COMMENT ON COLUMN public.document_jobs.status IS 'Job status: pending, processing, completed, failed';
COMMENT ON COLUMN public.document_jobs.locked_at IS 'Timestamp when job was claimed by a worker';
COMMENT ON COLUMN public.document_jobs.locked_by IS 'Worker ID that claimed this job';
COMMENT ON COLUMN public.document_jobs.result IS 'Job result payload (OcrVersion structure)';
