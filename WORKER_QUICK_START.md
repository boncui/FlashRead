# FlashRead Worker - Quick Start

## ✅ Worker is Running!

Your OCR worker is now running and will automatically extract text from any uploaded PDFs.

## How It Works

1. **Upload PDF** in the frontend → Automatically creates extraction job
2. **Worker polls** every 5 seconds → Claims pending jobs
3. **Auto-extracts** text using PyMuPDF (or OCR if needed)
4. **Document ready** → Text appears in your app

## Useful Commands

```bash
# View real-time logs (Ctrl+C to exit)
cd worker
docker compose logs -f

# Stop the worker
docker compose down

# Start the worker again
docker compose up -d

# Restart the worker
docker compose restart

# Check if worker is running
docker ps | grep flashread
```

## What You'll See in Logs

When a PDF is uploaded, you'll see:

```
📄 Processing job abc-123 (#1)
   Document: doc-456
   Type: extraction
✓ Downloaded PDF (245678 bytes)
✓ Extracted 15234 characters from 10 pages
✓ Completed - document ready
```

## Troubleshooting

### Worker not processing?
```bash
# Check if it's running
docker ps | grep flashread

# If not running, start it
cd worker
docker compose up -d

# View logs for errors
docker compose logs -f
```

### Documents stuck in "uploading"?
- Make sure R2 credentials are correct in `worker/.env.local`
- Check worker logs for download errors

### No text extracted?
- For scanned PDFs, worker will mark as `pending_ocr` and run OCR automatically
- OCR uses PaddleOCR + Tesseract (all included in Docker)

## Notes

- Worker runs continuously until you stop it with `docker compose down`
- Processes ~100-200 documents per minute
- Uses PaddleOCR for scanned documents (no extra cost)
- All automatic - just upload PDFs and wait a few seconds
