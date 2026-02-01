import os
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')

# R2 configuration
R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'flashread-documents')

# Worker configuration
WORKER_ID = os.getenv('WORKER_ID', 'worker-1')
POLL_INTERVAL_SECONDS = int(os.getenv('POLL_INTERVAL_SECONDS', '5'))
PIPELINE_VERSION = '1.0.0'

# OCR configuration (Phase 2b)
OCR_DPI_INITIAL = int(os.getenv('OCR_DPI_INITIAL', '200'))
OCR_DPI_RERUN = int(os.getenv('OCR_DPI_RERUN', '300'))
OCR_MIN_CONFIDENCE = float(os.getenv('OCR_MIN_CONFIDENCE', '0.6'))
OCR_MIN_CHARS_PER_PAGE = int(os.getenv('OCR_MIN_CHARS_PER_PAGE', '50'))
TESSERACT_LANG = os.getenv('TESSERACT_LANG', 'eng')

# Validate required configuration
def validate_config():
    """Ensure all required environment variables are set"""
    required_vars = {
        'SUPABASE_URL': SUPABASE_URL,
        'SUPABASE_SERVICE_KEY': SUPABASE_SERVICE_KEY,
        'R2_ACCOUNT_ID': R2_ACCOUNT_ID,
        'R2_ACCESS_KEY_ID': R2_ACCESS_KEY_ID,
        'R2_SECRET_ACCESS_KEY': R2_SECRET_ACCESS_KEY,
    }
    
    missing = [name for name, value in required_vars.items() if not value]
    
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
    
    print(f"✓ Configuration validated")
    print(f"  Worker ID: {WORKER_ID}")
    print(f"  Poll interval: {POLL_INTERVAL_SECONDS}s")
    print(f"  Pipeline version: {PIPELINE_VERSION}")
    print(f"  OCR DPI: {OCR_DPI_INITIAL} (initial), {OCR_DPI_RERUN} (rerun)")
