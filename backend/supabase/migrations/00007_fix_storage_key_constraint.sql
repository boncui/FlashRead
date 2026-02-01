-- Fix storage_key unique constraint to support soft-deletes
-- Problem: The unconditional UNIQUE constraint on storage_key blocks re-uploads
-- of files that were previously soft-deleted (deleted_at is set but row remains).
--
-- Solution: Convert to a partial unique index that excludes soft-deleted documents,
-- matching the pattern used for content_hash in 00004_document_ocr_schema.sql.

-- Drop the existing unique constraint
ALTER TABLE public.documents DROP CONSTRAINT documents_storage_key_key;

-- Create partial unique index (excludes soft-deleted docs)
-- This allows the same storage_key to exist for soft-deleted + active document
CREATE UNIQUE INDEX documents_storage_key_idx 
  ON public.documents(storage_key) 
  WHERE deleted_at IS NULL;

COMMENT ON INDEX documents_storage_key_idx IS 'Partial unique index on storage_key, excludes soft-deleted documents to allow re-uploads';
