-- Fix missing RLS on document_jobs table
-- Jobs should only be accessible to users who own the associated document

-- Enable RLS
ALTER TABLE public.document_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view jobs for their own documents
CREATE POLICY "Users can view jobs for own documents"
  ON public.document_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.user_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- Users can insert jobs for their own documents
CREATE POLICY "Users can insert jobs for own documents"
  ON public.document_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.user_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- Users can update jobs for their own documents
CREATE POLICY "Users can update jobs for own documents"
  ON public.document_jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.user_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- Note: DELETE is handled via CASCADE from documents table
-- No explicit delete policy needed as jobs are deleted when document is deleted
