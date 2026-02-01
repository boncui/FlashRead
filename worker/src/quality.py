def is_extraction_sufficient(text: str, page_count: int) -> bool:
    """
    Determine if direct text extraction yielded usable content.
    Returns True if PDF has a real text layer, False if it needs OCR.
    
    Quality heuristics:
    - Minimum character count: max(500, 50 * page_count)
    - Non-whitespace ratio: > 0.5 (to filter out garbage)
    
    Args:
        text: Extracted text from PDF
        page_count: Number of pages in PDF
        
    Returns:
        True if extraction is sufficient, False if OCR is needed
    """
    if not text:
        return False
    
    char_count = len(text)
    min_chars = max(500, 50 * page_count)
    
    # Check character count
    if char_count < min_chars:
        return False
    
    # Check non-whitespace ratio (filter out PDFs with only spaces/newlines)
    text_without_ws = text.replace(' ', '').replace('\n', '').replace('\t', '').replace('\r', '')
    if len(text) == 0:
        return False
    
    non_ws_ratio = len(text_without_ws) / len(text)
    
    return non_ws_ratio > 0.5


def generate_version_key(engine: str, engine_ver: str, pipeline_ver: str) -> str:
    """
    Generate a deterministic version key for OCR results.
    
    Format: {engine}_{engine_version}_{pipeline_version}_{timestamp}
    Example: pymupdf_1.23.8_1.0.0_20260131120000
    
    Args:
        engine: Engine name (e.g., 'pymupdf', 'paddleocr', 'tesseract')
        engine_ver: Engine version (e.g., '1.23.8')
        pipeline_ver: Pipeline version (e.g., '1.0.0')
        
    Returns:
        Version key string
    """
    from datetime import datetime
    ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    return f"{engine}_{engine_ver}_{pipeline_ver}_{ts}"
