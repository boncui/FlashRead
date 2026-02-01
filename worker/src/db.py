import httpx
import boto3
from typing import Optional
from supabase import create_client, Client
from .config import (
    SUPABASE_URL, 
    SUPABASE_SERVICE_KEY,
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME
)
from .models import DocumentJob, OcrVersion


# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Initialize R2 client
r2_client = boto3.client(
    's3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto'
)


def claim_job(worker_id: str, job_types: list[str] = None) -> Optional[DocumentJob]:
    """
    Claim a pending job for processing.
    Uses optimistic locking to prevent double-processing.
    
    Args:
        worker_id: Unique worker identifier
        job_types: Optional list of job types to claim (e.g., ['extraction', 'ocr'])
                  If None, claims any job type
        
    Returns:
        DocumentJob if claimed, None if no jobs available
    """
    from datetime import datetime
    
    # Find oldest pending job, optionally filtered by job type
    query = supabase.table('document_jobs')\
        .select('*')\
        .eq('status', 'pending')
    
    if job_types:
        query = query.in_('job_type', job_types)
    
    response = query\
        .order('priority', desc=True)\
        .order('created_at', desc=False)\
        .limit(1)\
        .execute()
    
    if not response.data or len(response.data) == 0:
        return None
    
    job_data = response.data[0]
    
    # Try to claim it atomically
    now = datetime.utcnow().isoformat() + 'Z'
    claim_response = supabase.table('document_jobs')\
        .update({
            'status': 'processing',
            'locked_at': now,
            'locked_by': worker_id,
            'started_at': now,
            'updated_at': now
        })\
        .eq('id', job_data['id'])\
        .eq('status', 'pending')\
        .execute()
    
    if not claim_response.data or len(claim_response.data) == 0:
        # Job was claimed by another worker
        return None
    
    # Update document status to processing
    supabase.table('documents')\
        .update({'status': 'processing', 'updated_at': now})\
        .eq('id', job_data['document_id'])\
        .execute()
    
    return DocumentJob(**claim_response.data[0])


def complete_job(job_id: str, document_id: str, result: OcrVersion, final_status: str):
    """
    Mark a job as completed and update the document.
    
    Args:
        job_id: Job ID
        document_id: Document ID
        result: Extraction result
        final_status: 'ready' or 'pending_ocr'
    """
    from datetime import datetime
    now = datetime.utcnow().isoformat() + 'Z'
    
    # Update job
    supabase.table('document_jobs')\
        .update({
            'status': 'completed',
            'completed_at': now,
            'updated_at': now,
            'result': result.dict()
        })\
        .eq('id', job_id)\
        .execute()
    
    # Generate version key
    version_key = f"{result.engine}_{result.engine_version}_{result.pipeline_version}_{int(datetime.utcnow().timestamp() * 1000)}"
    
    # Get current ocr_versions
    doc_response = supabase.table('documents')\
        .select('ocr_versions')\
        .eq('id', document_id)\
        .single()\
        .execute()
    
    current_versions = doc_response.data.get('ocr_versions', {}) if doc_response.data else {}
    updated_versions = {**current_versions, version_key: result.dict()}
    
    # Update document
    supabase.table('documents')\
        .update({
            'status': final_status,
            'ocr_versions': updated_versions,
            'page_count': result.metrics.total_pages,
            'updated_at': now
        })\
        .eq('id', document_id)\
        .execute()
    
    print(f"✓ Completed job {job_id} for document {document_id} with status {final_status}")


def fail_job(job_id: str, document_id: str, error_msg: str):
    """
    Mark a job as failed and update attempt count.
    
    Args:
        job_id: Job ID
        document_id: Document ID
        error_msg: Error message
    """
    from datetime import datetime
    now = datetime.utcnow().isoformat() + 'Z'
    
    # Get current job info
    job_response = supabase.table('document_jobs')\
        .select('attempts, max_attempts')\
        .eq('id', job_id)\
        .single()\
        .execute()
    
    if not job_response.data:
        print(f"✗ Job {job_id} not found")
        return
    
    job = job_response.data
    new_attempts = job['attempts'] + 1
    is_final_failure = new_attempts >= job['max_attempts']
    
    # Update job
    supabase.table('document_jobs')\
        .update({
            'status': 'failed' if is_final_failure else 'pending',
            'attempts': new_attempts,
            'last_error': error_msg,
            'updated_at': now,
            'locked_at': None,
            'locked_by': None
        })\
        .eq('id', job_id)\
        .execute()
    
    # If final failure, mark document as error
    if is_final_failure:
        supabase.table('documents')\
            .update({
                'status': 'error',
                'error_message': f"Processing failed after {new_attempts} attempts: {error_msg}",
                'updated_at': now
            })\
            .eq('id', document_id)\
            .execute()
        
        print(f"✗ Job {job_id} failed permanently: {error_msg}")
    else:
        print(f"⚠ Job {job_id} failed (attempt {new_attempts}/{job['max_attempts']}): {error_msg}")


def download_pdf(document_id: str) -> bytes:
    """
    Download PDF from R2 using the document's storage key.
    
    Args:
        document_id: Document ID
        
    Returns:
        PDF bytes
    """
    # Get storage key from document
    doc_response = supabase.table('documents')\
        .select('storage_key')\
        .eq('id', document_id)\
        .single()\
        .execute()
    
    if not doc_response.data:
        raise ValueError(f"Document {document_id} not found")
    
    storage_key = doc_response.data['storage_key']
    
    # Download from R2
    response = r2_client.get_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
    pdf_bytes = response['Body'].read()
    
    print(f"✓ Downloaded PDF for document {document_id} ({len(pdf_bytes)} bytes)")
    return pdf_bytes
