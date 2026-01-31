-- Documents table for user uploaded files (PDFs, DOCX, etc.)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  
  -- File info
  name text not null,                    -- Original filename
  file_type text not null,               -- 'pdf', 'docx', 'doc', 'pptx', 'ppt'
  mime_type text not null,               -- 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', etc.
  size_bytes bigint not null,            -- File size in bytes
  
  -- Storage
  storage_key text not null unique,      -- R2 object key (path in bucket)
  
  -- Processing
  status text not null default 'uploading',  -- 'uploading', 'processing', 'ready', 'error'
  page_count integer,                    -- Number of pages (if applicable)
  extracted_text text,                   -- Full extracted text for search/FlashRead generation
  error_message text,                    -- Error details if processing failed
  
  -- Flexible metadata (thumbnails, word count, etc.)
  metadata jsonb not null default '{}',
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                 -- Soft delete
);

-- RLS policies (same pattern as flashreads)
alter table public.documents enable row level security;

create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id and deleted_at is null);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- Indexes for efficient queries
create index documents_user_id_idx on public.documents(user_id) where deleted_at is null;
create index documents_status_idx on public.documents(status) where deleted_at is null;
create index documents_created_at_idx on public.documents(created_at desc) where deleted_at is null;
