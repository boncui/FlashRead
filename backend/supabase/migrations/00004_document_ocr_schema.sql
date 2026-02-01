-- Add columns to support OCR pipeline and versioned content extraction
-- Phase 1: Schema preparation for future OCR processing

-- Add content_hash for content-addressing and deduplication
-- SHA-256 hash of the PDF file bytes
ALTER TABLE public.documents
  ADD COLUMN content_hash TEXT;

-- Add unique index on content_hash for deduplication
-- (allows NULL values - old documents won't have hashes)
CREATE UNIQUE INDEX documents_content_hash_idx 
  ON public.documents(content_hash) 
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

-- Add ocr_versions JSONB to store multiple OCR outputs
-- Structure: { "nougat_v1": { "created_at": "...", "model_version": "...", "pages": [...] }, ... }
ALTER TABLE public.documents
  ADD COLUMN ocr_versions JSONB NOT NULL DEFAULT '{}';

-- Add derived_content JSONB to store processed/derived representations
-- Structure: { "markdown_v1": { "content": "...", "created_at": "..." }, "flashread_v1": { ... }, ... }
ALTER TABLE public.documents
  ADD COLUMN derived_content JSONB NOT NULL DEFAULT '{}';

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
