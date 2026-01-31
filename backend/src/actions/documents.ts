'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { Document, CreateDocumentInput, UpdateDocumentInput } from '../lib/types';
import { generateUploadUrl, generateDownloadUrl, deleteObject, generateStorageKey } from '../lib/r2/client';

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

  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      name: input.name,
      file_type: input.file_type,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes,
      storage_key: input.storage_key,
      status: 'uploading',
    })
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
 */
export async function requestDocumentUpload(
  name: string,
  fileType: string,
  mimeType: string,
  sizeBytes: number
): Promise<{ uploadUrl: string; document: Document }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Generate storage key
  const storageKey = generateStorageKey(user.id, name);

  // Get presigned upload URL
  const uploadUrl = await generateUploadUrl(storageKey, mimeType);

  // Create document record
  const document = await createDocument({
    name,
    file_type: fileType as any,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    storage_key: storageKey,
  });

  return { uploadUrl, document };
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

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/app/documents');
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
    console.error('Failed to delete from R2:', error);
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
