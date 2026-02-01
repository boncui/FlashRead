'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { createServiceClient } from '../lib/supabase/service';
import { Document, CreateDocumentInput, UpdateDocumentInput, OcrVersion, DerivedContent } from '../lib/types';
import { generateUploadUrl, generateDownloadUrl, deleteObject, generateStorageKey } from '../lib/r2/client';
import { logger } from '../lib/logger';

/**
 * Get all documents for the authenticated user
 */
export async function getDocuments(): Promise<Document[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data as Document[];
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string): Promise<Document | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  return data as Document;
}

/**
 * Check if a document with the given content hash already exists
 * Returns the document if found, null otherwise
 */
export async function checkDocumentByHash(contentHash: string): Promise<Document | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Only consider documents that have been successfully uploaded as duplicates
  // Ignore documents stuck in 'uploading' status (failed uploads)
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('content_hash', contentHash)
    .eq('user_id', user.id)
    .neq('status', 'uploading') // Exclude failed/incomplete uploads
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No document found with this hash
      return null;
    }
    throw new Error(error.message);
  }

  return data as Document;
}

/**
 * Create a new document record in the database
 * Call this after getting an upload URL but before the actual upload
 */
export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const insertData: any = {
    user_id: user.id,
    name: input.name,
    file_type: input.file_type,
    mime_type: input.mime_type,
    size_bytes: input.size_bytes,
    storage_key: input.storage_key,
    status: 'uploading',
    ocr_versions: {},
    derived_content: {},
  };

  // Add content_hash if provided
  if (input.content_hash) {
    insertData.content_hash = input.content_hash;
  }

  const { data, error } = await supabase
    .from('documents')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
  return data as Document;
}

/**
 * Request an upload URL for a new document
 * This generates a presigned URL and creates the document record
 * @param contentHash - SHA-256 hash of file bytes for deduplication
 */
export async function requestDocumentUpload(
  name: string,
  fileType: string,
  mimeType: string,
  sizeBytes: number,
  contentHash?: string
): Promise<{ uploadUrl: string; document: Document }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Generate storage key using content hash for content-addressable storage
  // Format: userId/contentHash-filename or userId/timestamp-randomId-filename for non-hashed
  const storageKey = contentHash 
    ? `${user.id}/${contentHash}-${sanitizeFilename(name)}`
    : generateStorageKey(user.id, name);

  // Clean up any failed uploads with the same hash (stuck in 'uploading' status)
  if (contentHash) {
    const { error: cleanupError } = await supabase
      .from('documents')
      .delete()
      .eq('content_hash', contentHash)
      .eq('user_id', user.id)
      .eq('status', 'uploading');
    
    if (cleanupError) {
      logger.warn('[requestDocumentUpload] Failed to cleanup stuck uploads:', cleanupError.message);
      // Continue anyway - the new insert may succeed or fail with unique constraint
    }
  }

  // Clean up any soft-deleted documents with the same storage_key
  // This provides defense-in-depth in case the partial index migration hasn't been applied
  // Note: Uses service client since RLS policy may restrict access to soft-deleted docs
  const serviceSupabase = createServiceClient();
  const { error: softDeleteCleanupError } = await serviceSupabase
    .from('documents')
    .delete()
    .eq('storage_key', storageKey)
    .not('deleted_at', 'is', null);

  if (softDeleteCleanupError) {
    logger.warn('[requestDocumentUpload] Failed to cleanup soft-deleted docs:', softDeleteCleanupError.message);
    // Continue anyway - the partial index should handle this if migration was applied
  }

  // Get presigned upload URL
  const uploadUrl = await generateUploadUrl(storageKey, mimeType);

  // Create document record
  const document = await createDocument({
    name,
    file_type: fileType as any,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    storage_key: storageKey,
    content_hash: contentHash,
  });

  return { uploadUrl, document };
}

/**
 * Mark a document as uploaded (file successfully stored in R2)
 * This transitions status from 'uploading' to 'uploaded' and enqueues text extraction
 */
export async function markDocumentUploaded(id: string): Promise<void> {
  await updateDocument(id, { status: 'uploaded' });
  
  // Auto-enqueue extraction job (import at runtime to avoid circular deps)
  const { enqueueExtractionJob } = await import('./ocr-jobs');
  await enqueueExtractionJob(id);
}

/**
 * Auto-enqueue OCR job when extraction marks document as pending_ocr
 * This is called by the worker after extraction completes with insufficient text
 * FOR WORKER USE ONLY (service-level)
 */
export async function autoEnqueueOcrIfNeeded(documentId: string, status: string): Promise<void> {
  if (status === 'pending_ocr') {
    // Import at runtime to avoid circular deps
    const { enqueueOcrJob } = await import('./ocr-jobs');
    await enqueueOcrJob(documentId);
  }
}

/**
 * Helper to sanitize filename for storage key
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
}

/**
 * Update a document's metadata or status
 */
export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  if (input.page_count !== undefined) {
    updateData.page_count = input.page_count;
  }
  if (input.extracted_text !== undefined) {
    updateData.extracted_text = input.extracted_text;
  }
  if (input.error_message !== undefined) {
    updateData.error_message = input.error_message;
  }
  if (input.metadata !== undefined) {
    updateData.metadata = input.metadata;
  }

  const { error } = await supabase
    .from('documents')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
  revalidatePath(`/app/documents/${id}`);
}

/**
 * Soft delete a document (sets deleted_at timestamp)
 */
export async function deleteDocument(id: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Verify ownership first using authenticated client
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !document) {
    throw new Error('Document not found');
  }

  // Use service client for soft delete to bypass RLS UPDATE policy
  // (RLS policy requires deleted_at IS NULL, but we're setting it to non-null)
  const serviceSupabase = createServiceClient();
  const { error } = await serviceSupabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
  revalidatePath('/app');
}

/**
 * Delete a stuck upload (document in "uploading" status that never completed)
 * This is less destructive than hard delete since the file was never uploaded to R2
 */
export async function deleteStuckUpload(id: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Verify the document is actually stuck in uploading status
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (document.status !== 'uploading') {
    throw new Error('Document is not in uploading status');
  }

  // Hard delete since no file was uploaded to R2
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath('/app/documents');
  revalidatePath('/app');
}

/**
 * Permanently delete a document and its file from R2
 * WARNING: This is irreversible
 */
export async function hardDeleteDocument(id: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // First get the document to retrieve the storage key
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('storage_key')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!document) {
    throw new Error('Document not found');
  }

  // Delete from R2
  try {
    await deleteObject(document.storage_key);
  } catch (error) {
    logger.error('Failed to delete from R2:', error);
    // Continue with database deletion even if R2 delete fails
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath('/app/documents');
}

/**
 * Get a presigned download URL for a document
 */
export async function getDocumentDownloadUrl(id: string): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get the document to verify ownership and retrieve storage key
  const { data: document, error } = await supabase
    .from('documents')
    .select('storage_key')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Document not found');
    }
    throw new Error(error.message);
  }

  // Generate presigned download URL
  return await generateDownloadUrl(document.storage_key);
}

/**
 * Cleanup stuck uploads (documents in "uploading" status for more than specified time)
 * This is a maintenance function that can be called periodically
 * @param olderThanHours - Delete uploads stuck for more than this many hours (default: 1)
 * @returns Number of documents cleaned up
 */
export async function cleanupStuckUploads(olderThanHours: number = 1): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Calculate cutoff time
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

  // Find stuck uploads
  const { data: stuckUploads, error: fetchError } = await supabase
    .from('documents')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'uploading')
    .lt('created_at', cutoffTime.toISOString());

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!stuckUploads || stuckUploads.length === 0) {
    return 0;
  }

  // Delete stuck uploads (no R2 cleanup needed since file was never uploaded)
  const ids = stuckUploads.map((doc) => doc.id);
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .in('id', ids);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath('/app/documents');
  revalidatePath('/app');

  return ids.length;
}

/**
 * Update OCR version data for a document (Phase 2)
 * This adds or updates a specific OCR version
 */
export async function updateOcrVersion(
  id: string,
  versionKey: string,
  ocrData: OcrVersion
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get current document to merge OCR versions
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('ocr_versions')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const currentVersions = document.ocr_versions || {};
  const updatedVersions = {
    ...currentVersions,
    [versionKey]: ocrData,
  };

  const { error } = await supabase
    .from('documents')
    .update({
      ocr_versions: updatedVersions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
  revalidatePath(`/app/documents/${id}`);
}

/**
 * Update derived content for a document (Phase 2)
 * This adds or updates derived content like markdown, flashread, summary
 */
export async function updateDerivedContent(
  id: string,
  contentKey: string,
  content: DerivedContent[keyof DerivedContent]
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get current document to merge derived content
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('derived_content')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const currentContent = document.derived_content || {};
  const updatedContent = {
    ...currentContent,
    [contentKey]: content,
  };

  const { error } = await supabase
    .from('documents')
    .update({
      derived_content: updatedContent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
  revalidatePath(`/app/documents/${id}`);
}

// ============================================================
// Reading Progress Functions
// ============================================================

/**
 * Save reading progress for a document
 * Stores the current token index and optionally the WPM setting
 */
export async function saveReadingProgress(
  documentId: string,
  tokenIndex: number,
  wpm?: number
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get current document to merge derived content
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('derived_content')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      throw new Error('Document not found');
    }
    throw new Error(fetchError.message);
  }

  const currentContent = document.derived_content || {};
  const updatedContent = {
    ...currentContent,
    reading_progress_v1: {
      token_index: tokenIndex,
      updated_at: new Date().toISOString(),
      ...(wpm !== undefined && { wpm }),
    },
  };

  const { error } = await supabase
    .from('documents')
    .update({
      derived_content: updatedContent,
      // Don't update updated_at for reading progress saves to avoid
      // changing the document's "last modified" timestamp
    })
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  // Don't revalidate paths for reading progress saves (too frequent)
}

/**
 * Get reading progress for a document
 * Returns the saved progress or null if none exists
 */
export async function getReadingProgress(
  documentId: string
): Promise<{ token_index: number; wpm?: number } | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: document, error } = await supabase
    .from('documents')
    .select('derived_content')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  const progress = document.derived_content?.reading_progress_v1;
  if (!progress || typeof progress.token_index !== 'number') {
    return null;
  }

  return {
    token_index: progress.token_index,
    wpm: progress.wpm,
  };
}

// ============================================================
// Service-level functions (no auth check, for worker use)
// ============================================================

/**
 * Service-level: Update a document directly (bypasses RLS)
 * FOR WORKER USE ONLY
 */
export async function serviceUpdateDocument(id: string, input: UpdateDocumentInput): Promise<void> {
  const supabase = createServiceClient();

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  if (input.page_count !== undefined) {
    updateData.page_count = input.page_count;
  }
  if (input.extracted_text !== undefined) {
    updateData.extracted_text = input.extracted_text;
  }
  if (input.error_message !== undefined) {
    updateData.error_message = input.error_message;
  }
  if (input.metadata !== undefined) {
    updateData.metadata = input.metadata;
  }

  const { error } = await supabase
    .from('documents')
    .update(updateData)
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
  revalidatePath(`/app/documents/${id}`);
}

/**
 * Service-level: Update OCR version data for a document (bypasses RLS)
 * FOR WORKER USE ONLY
 */
export async function serviceUpdateOcrVersion(
  id: string,
  versionKey: string,
  ocrData: OcrVersion
): Promise<void> {
  const supabase = createServiceClient();

  // Get current document to merge OCR versions
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('ocr_versions')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const currentVersions = document.ocr_versions || {};
  const updatedVersions = {
    ...currentVersions,
    [versionKey]: ocrData,
  };

  const { error } = await supabase
    .from('documents')
    .update({
      ocr_versions: updatedVersions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
  revalidatePath(`/app/documents/${id}`);
}

/**
 * Service-level: Get document storage key (bypasses RLS)
 * FOR WORKER USE ONLY
 */
export async function serviceGetDocumentStorageKey(id: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: document, error } = await supabase
    .from('documents')
    .select('storage_key')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Document not found');
    }
    throw new Error(error.message);
  }

  return document.storage_key;
}
