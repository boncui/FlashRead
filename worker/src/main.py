import time
import sys
from .config import (
    validate_config, 
    WORKER_ID, 
    POLL_INTERVAL_SECONDS,
    PIPELINE_VERSION
)
from .db import claim_job, complete_job, fail_job, download_pdf
from .extractor import extract_text_from_pdf
from .quality import is_extraction_sufficient


def handle_extraction_job(job, pdf_bytes):
    """Handle text extraction job (Phase 2a)"""
    print("   Extracting text with PyMuPDF...")
    result = extract_text_from_pdf(pdf_bytes)
    result.pipeline_version = PIPELINE_VERSION
    
    print(f"   ✓ Extracted {result.metrics.char_count} characters from {result.metrics.total_pages} pages")
    print(f"   ✓ Runtime: {result.metrics.runtime_ms}ms")
    
    # Check quality
    doc_text = result.doc_text or ''
    is_sufficient = is_extraction_sufficient(doc_text, result.metrics.total_pages)
    
    if is_sufficient:
        final_status = 'ready'
        print("   ✓ Text extraction successful - document ready")
    else:
        final_status = 'pending_ocr'
        print("   ⚠ Text extraction insufficient - needs OCR (Phase 2b)")
        if not result.warnings:
            result.warnings = []
        result.warnings.append(
            f"Insufficient text extracted ({result.metrics.char_count} chars). "
            f"Document likely scanned or image-based. Needs OCR processing."
        )
    
    complete_job(job.id, job.document_id, result, final_status)
    
    # Auto-enqueue OCR if needed
    if final_status == 'pending_ocr':
        print("   → Auto-enqueuing OCR job...")
        # Trigger OCR job enqueue via backend function
        # Note: This will be handled by the backend's autoEnqueueOcrIfNeeded


def handle_ocr_job(job, pdf_bytes):
    """Handle OCR job (Phase 2b)"""
    from .ocr.router import process_document_ocr
    from .ocr.quality import is_doc_ocr_sufficient
    
    print("   Processing with OCR pipeline...")
    
    # Get options from job result field
    options = job.result or {}
    language = options.get('language', 'en')
    
    # Run OCR pipeline
    result = process_document_ocr(pdf_bytes, language=language)
    result.pipeline_version = PIPELINE_VERSION
    
    print(f"   ✓ OCR completed: {result.metrics.char_count} characters from {result.metrics.total_pages} pages")
    print(f"   ✓ Method: {result.metrics.method}")
    print(f"   ✓ Runtime: {result.metrics.runtime_ms}ms")
    
    if result.metrics.bad_pages:
        print(f"   ⚠ {len(result.metrics.bad_pages)} pages needed reprocessing")
    if result.metrics.fallback_pages:
        print(f"   ⚠ {len(result.metrics.fallback_pages)} pages used Tesseract fallback")
    
    # Check quality
    doc_text = result.doc_text or ''
    is_sufficient = is_doc_ocr_sufficient(doc_text, result.metrics.total_pages)
    
    if is_sufficient:
        final_status = 'ready'
        print("   ✓ OCR successful - document ready")
    else:
        final_status = 'ocr_failed'
        print("   ✗ OCR insufficient - marking as failed")
        if not result.warnings:
            result.warnings = []
        result.warnings.append(
            f"OCR produced insufficient text ({result.metrics.char_count} chars). "
            f"Document may be damaged, very low quality, or in an unsupported format."
        )
    
    complete_job(job.id, job.document_id, result, final_status)


def main():
    """Main worker loop"""
    print("=" * 60)
    print("FlashRead Document Processing Worker")
    print("=" * 60)
    
    # Validate configuration
    try:
        validate_config()
    except ValueError as e:
        print(f"✗ Configuration error: {e}")
        sys.exit(1)
    
    print(f"\n🚀 Worker started. Polling every {POLL_INTERVAL_SECONDS}s...")
    print("   Supports: extraction (Phase 2a), OCR (Phase 2b)")
    print("   Press Ctrl+C to stop\n")
    
    job_count = 0
    
    try:
        while True:
            try:
                # Try to claim any job type (extraction or OCR)
                job = claim_job(WORKER_ID, job_types=None)
                
                if not job:
                    # No jobs available, wait and retry
                    time.sleep(POLL_INTERVAL_SECONDS)
                    continue
                
                job_count += 1
                print(f"\n📄 Processing job {job.id} (#{job_count})")
                print(f"   Document: {job.document_id}")
                print(f"   Type: {job.job_type}")
                
                # Download PDF
                try:
                    pdf_bytes = download_pdf(job.document_id)
                except Exception as e:
                    fail_job(job.id, job.document_id, f"Failed to download PDF: {str(e)}")
                    continue
                
                # Route to appropriate handler based on job type
                try:
                    if job.job_type == 'extraction':
                        handle_extraction_job(job, pdf_bytes)
                    elif job.job_type == 'ocr':
                        handle_ocr_job(job, pdf_bytes)
                    else:
                        fail_job(job.id, job.document_id, f"Unknown job type: {job.job_type}")
                        continue
                        
                except Exception as e:
                    fail_job(job.id, job.document_id, f"Processing failed: {str(e)}")
                    continue
                
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print(f"\n✗ Unexpected error: {e}")
                import traceback
                traceback.print_exc()
                # Continue processing next job
                time.sleep(POLL_INTERVAL_SECONDS)
    
    except KeyboardInterrupt:
        print(f"\n\n⏹ Worker stopped after processing {job_count} jobs")
        sys.exit(0)


if __name__ == '__main__':
    main()
