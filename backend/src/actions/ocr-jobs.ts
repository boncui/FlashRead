'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '../lib/supabase/service';
import { createClient } from '../lib/supabase/server';
import { OcrVersion } from '../lib/types';

interface DocumentJob {
  id: string;
  document_id: string;
  job_type: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  result: any;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Enqueue a text extraction job for a document
 * This is called after a document is uploaded
 */
export async function enqueueExtractionJob(documentId: string): Promise<void> {
  const supabase = createServiceClient();

  // Check if a job already exists for this document (dedup)
  const { data: existingJobs } = await supabase
    .from('document_jobs')
    .select('id, status')
    .eq('document_id', documentId)
    .eq('job_type', 'extraction')
    .in('status', ['pending', 'processing']);

  if (existingJobs && existingJobs.length > 0) {
    console.log(`Extraction job already exists for document ${documentId}, skipping enqueue`);
    return;
  }

  // Create new extraction job
  const { error } = await supabase
    .from('document_jobs')
    .insert({
      document_id: documentId,
      job_type: 'extraction',
      status: 'pending',
      priority: 0,
    });

  if (error) {
    throw new Error(`Failed to enqueue extraction job: ${error.message}`);
  }

  console.log(`Enqueued extraction job for document ${documentId}`);
}

/**
 * Enqueue an OCR job for a document that needs OCR processing
 * This is called when direct extraction fails or returns insufficient text
 */
export async function enqueueOcrJob(
  documentId: string,
  options?: { language?: string; dpi?: number }
): Promise<void> {
  const supabase = createServiceClient();

  // Check if an OCR job already exists for this document (dedup)
  const { data: existingJobs } = await supabase
    .from('document_jobs')
    .select('id, status')
    .eq('document_id', documentId)
    .eq('job_type', 'ocr')
    .in('status', ['pending', 'processing']);

  if (existingJobs && existingJobs.length > 0) {
    console.log(`OCR job already exists for document ${documentId}, skipping enqueue`);
    return;
  }

  // Create new OCR job
  const { error } = await supabase
    .from('document_jobs')
    .insert({
      document_id: documentId,
      job_type: 'ocr',
      status: 'pending',
      priority: 0,
      result: options || {},
    });

  if (error) {
    throw new Error(`Failed to enqueue OCR job: ${error.message}`);
  }

  console.log(`Enqueued OCR job for document ${documentId}`);
}

/**
 * Claim a pending job for processing (worker use only)
 * This atomically locks the job to prevent double-processing
 */
export async function claimJob(
  workerId: string,
  jobTypes?: string[]
): Promise<DocumentJob | null> {
  const supabase = createServiceClient();

  // Find oldest pending job, optionally filtered by job type
  let query = supabase
    .from('document_jobs')
    .select('*')
    .eq('status', 'pending');

  if (jobTypes && jobTypes.length > 0) {
    query = query.in('job_type', jobTypes);
  }

  const { data: pendingJobs, error: fetchError } = await query
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    throw new Error(`Failed to fetch pending jobs: ${fetchError.message}`);
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    return null;
  }

  const job = pendingJobs[0];

  // Atomically claim the job with optimistic locking
  const { data: claimedJob, error: claimError } = await supabase
    .from('document_jobs')
    .update({
      status: 'processing',
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'pending') // Only update if still pending (prevents race conditions)
    .select()
    .single();

  if (claimError) {
    // Job was claimed by another worker or no longer pending
    if (claimError.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to claim job: ${claimError.message}`);
  }

  // Update document status to processing
  await supabase
    .from('documents')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', job.document_id);

  return claimedJob as DocumentJob;
}

/**
 * Mark a job as completed and update the document
 */
export async function completeJob(
  jobId: string,
  result: OcrVersion,
  finalStatus: 'ready' | 'pending_ocr' | 'ocr_failed'
): Promise<void> {
  const supabase = createServiceClient();

  // Get the job to find document_id
  const { data: job, error: jobError } = await supabase
    .from('document_jobs')
    .select('document_id')
    .eq('id', jobId)
    .single();

  if (jobError) {
    throw new Error(`Failed to fetch job: ${jobError.message}`);
  }

  // Update job status
  const { error: updateError } = await supabase
    .from('document_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result: result,
    })
    .eq('id', jobId);

  if (updateError) {
    throw new Error(`Failed to complete job: ${updateError.message}`);
  }

  // Update document with OCR version and final status
  const versionKey = `${result.engine}_${result.engine_version}_${result.pipeline_version}_${new Date().getTime()}`;
  
  // Get current ocr_versions
  const { data: doc } = await supabase
    .from('documents')
    .select('ocr_versions')
    .eq('id', job.document_id)
    .single();

  const currentVersions = doc?.ocr_versions || {};
  const updatedVersions = {
    ...currentVersions,
    [versionKey]: result,
  };

  // Update document
  const { error: docError } = await supabase
    .from('documents')
    .update({
      status: finalStatus,
      ocr_versions: updatedVersions,
      page_count: result.metrics.total_pages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.document_id);

  if (docError) {
    throw new Error(`Failed to update document: ${docError.message}`);
  }

  revalidatePath('/app/documents');
  revalidatePath(`/app/documents/${job.document_id}`);

  console.log(`Completed job ${jobId} for document ${job.document_id} with status ${finalStatus}`);
}

/**
 * Mark a job as failed
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  const supabase = createServiceClient();

  // Get the job to find document_id and attempts
  const { data: job, error: jobError } = await supabase
    .from('document_jobs')
    .select('document_id, attempts, max_attempts')
    .eq('id', jobId)
    .single();

  if (jobError) {
    throw new Error(`Failed to fetch job: ${jobError.message}`);
  }

  const newAttempts = job.attempts + 1;
  const isFinalFailure = newAttempts >= job.max_attempts;

  // Update job
  const { error: updateError } = await supabase
    .from('document_jobs')
    .update({
      status: isFinalFailure ? 'failed' : 'pending',
      attempts: newAttempts,
      last_error: error,
      updated_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq('id', jobId);

  if (updateError) {
    throw new Error(`Failed to update job: ${updateError.message}`);
  }

  // If final failure, mark document as error
  if (isFinalFailure) {
    await supabase
      .from('documents')
      .update({
        status: 'error',
        error_message: `Processing failed after ${newAttempts} attempts: ${error}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.document_id);

    revalidatePath('/app/documents');
    revalidatePath(`/app/documents/${job.document_id}`);
  }

  console.log(`Failed job ${jobId} (attempt ${newAttempts}/${job.max_attempts}): ${error}`);
}

/**
 * Get the job status for a document
 */
export async function getJobForDocument(documentId: string): Promise<DocumentJob | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('document_jobs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch job: ${error.message}`);
  }

  return data as DocumentJob;
}

/**
 * Log OCR demand signal when a user clicks the OCR button multiple times.
 * This tracks demand for the OCR feature (for analytics/prioritization).
 * Only logs for authenticated users.
 */
export async function logOcrDemand(
  documentId: string,
  clickCount: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Insert the demand signal
  const { error } = await supabase.from('ocr_demand_signals').insert({
    user_id: user.id,
    document_id: documentId,
    click_count: clickCount,
  });

  if (error) {
    console.error('Failed to log OCR demand:', error.message);
    return { success: false, error: error.message };
  }

  console.log(`Logged OCR demand signal: user=${user.id}, doc=${documentId}, clicks=${clickCount}`);
  return { success: true };
}
