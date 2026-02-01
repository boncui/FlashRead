# FlashRead Document Extraction Worker

Phase 2a text extraction worker using PyMuPDF for direct text extraction from PDFs.

## Overview

This worker processes uploaded PDFs by:
1. Claiming pending extraction jobs from the database queue
2. Downloading PDFs from Cloudflare R2 storage
3. Extracting text using PyMuPDF (fast path for PDFs with text layers)
4. Evaluating extraction quality
5. Marking documents as `ready` (if successful) or `pending_ocr` (if needs OCR in Phase 2b)

## Architecture

- **Language**: Python 3.11
- **Text Extraction**: PyMuPDF (fitz) 1.23.8
- **Storage**: Cloudflare R2 (S3-compatible)
- **Database**: Supabase (PostgreSQL)
- **Job Queue**: Database-backed with optimistic locking

## Prerequisites

- Docker (recommended) OR Python 3.11+
- Access to Supabase project (service role key required)
- Access to Cloudflare R2 bucket

## Setup

### 1. Environment Variables

Create a `.env.local` file in the `worker/` directory:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=flashread-documents

# Worker Configuration
WORKER_ID=worker-1
POLL_INTERVAL_SECONDS=5
```

**Important Security Notes:**
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Keep it secret!
- Never commit `.env` to version control

### 2. Database Migration

Ensure the database migration `00005_document_jobs.sql` has been applied:

```bash
# From the project root
cd backend
# Apply migration using your Supabase CLI or dashboard
```

## Running the Worker

### Option A: Using Docker Compose (Recommended)

```bash
cd worker

# Start worker (foreground with logs)
docker compose up --build

# Start worker (background)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop worker
docker compose down

# Restart worker
docker compose restart
```

The `docker-compose.yml` file handles:
- Named container (`flashread-worker`) - reusable, no clutter
- Auto-restart policy
- Environment variables from `.env.local`
- Unbuffered Python output for real-time logs

### Option B: Using Docker Directly

```bash
cd worker

# Build the image
docker build -t flashread-worker .

# Run the container
docker run --env-file .env.local flashread-worker

# For production with auto-restart
docker run -d \
  --name flashread-worker \
  --restart unless-stopped \
  --env-file .env.local \
  flashread-worker
```

### Option C: Using Python Directly

```bash
cd worker

# Install dependencies
pip install -r requirements.txt

# Run the worker
python -m src.main
```

## How It Works

### Job Flow

1. **Upload** → User uploads PDF via frontend
2. **Enqueue** → `markDocumentUploaded()` creates extraction job
3. **Claim** → Worker polls database, claims job with lock
4. **Download** → Worker downloads PDF from R2 using storage key
5. **Extract** → PyMuPDF extracts text from PDF
6. **Evaluate** → Quality heuristics determine if extraction is sufficient
7. **Complete** → Update document status and store results

### Quality Heuristics

A PDF extraction is considered "sufficient" if:
- Character count ≥ max(500, 50 × page_count)
- Non-whitespace ratio > 0.5

If extraction is insufficient (likely scanned/image PDF):
- Document status → `pending_ocr`
- Stored in `ocr_versions` with warnings
- Waits for Phase 2b OCR implementation

### Data Storage

Results are stored in the `documents` table:

```typescript
{
  ocr_versions: {
    "pymupdf_1.23.8_1.0.0_20260131120000": {
      engine: "pymupdf",
      engine_version: "1.23.8",
      pipeline_version: "1.0.0",
      pages: [...],
      doc_text: "...",
      metrics: {
        total_pages: 10,
        method: "direct",
        char_count: 15234,
        runtime_ms: 245
      }
    }
  }
}
```

## Monitoring

### Logs

The worker outputs structured logs:

```
✓ Configuration validated
  Worker ID: worker-1
  Poll interval: 5s
  Pipeline version: 1.0.0

🚀 Worker started. Polling every 5s...

📄 Processing job abc-123-def (#1)
   Document: doc-456-xyz
   Type: extraction
✓ Downloaded PDF for document doc-456-xyz (245678 bytes)
   Extracting text with PyMuPDF...
   ✓ Extracted 15234 characters from 10 pages
   ✓ Runtime: 245ms
   ✓ Text extraction successful - document ready
✓ Completed job abc-123-def for document doc-456-xyz with status ready
```

### Job Status

Check job status in the database:

```sql
SELECT id, document_id, status, attempts, last_error, created_at
FROM document_jobs
WHERE status != 'completed'
ORDER BY created_at DESC;
```

### Failed Jobs

Failed jobs are automatically retried up to 3 times. After max attempts:
- Job status → `failed`
- Document status → `error`
- Error message stored in `documents.error_message`

## Troubleshooting

### Worker Not Processing Jobs

1. Check if worker is running: `docker ps` or check process
2. Verify environment variables are set correctly
3. Check database connectivity: worker logs should show "Configuration validated"
4. Verify jobs exist: `SELECT * FROM document_jobs WHERE status = 'pending'`

### Extraction Fails for Valid PDFs

1. Check PDF is not corrupted
2. Verify R2 download succeeds (check worker logs)
3. Check PyMuPDF version compatibility

### Documents Stuck in "Processing"

This indicates the worker crashed while processing. To recover:

1. Find orphaned jobs:
```sql
UPDATE document_jobs 
SET status = 'pending', locked_at = NULL, locked_by = NULL
WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes';
```

2. Restart worker

## Development

### Running Tests

```bash
cd worker
python -m pytest tests/
```

### Adding New Extraction Methods (Phase 2b)

When adding OCR fallbacks:

1. Create `src/ocr_paddle.py` or `src/ocr_tesseract.py`
2. Update `src/main.py` to call OCR when extraction is insufficient
3. Update Dockerfile with OCR dependencies
4. Use same `OcrVersion` structure for consistency

## Performance

- **Text Extraction**: ~100-500ms per document (depends on page count)
- **Throughput**: Single worker can process ~100-200 docs/min
- **Scaling**: Run multiple workers with unique `WORKER_ID`s

## Phase 2b Preview

Future OCR support will:
- Process `pending_ocr` documents
- Try PaddleOCR (CPU-based)
- Fallback to Tesseract if needed
- Store OCR results under different version keys
- Reuse same job queue infrastructure

## Support

For issues or questions, check:
- Worker logs for error messages
- Database `document_jobs.last_error` for job failures
- Document status on frontend detail page
