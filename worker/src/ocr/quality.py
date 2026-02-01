"""
OCR quality checks and heuristics for Phase 2b.
Determines when pages need reprocessing or fallback engines.
"""

from typing import List, Optional
import sys
sys.path.append('..')
from .paddle_engine import OcrBlock


def is_page_quality_ok(
    blocks: List[OcrBlock],
    min_conf: float = 0.6,
    min_chars: int = 50
) -> bool:
    """
    Determine if a page's OCR quality is acceptable.
    
    A page is considered "bad" if:
    - Average confidence < min_conf (0.6 default)
    - OR total character count < min_chars (50 default)
    
    Args:
        blocks: List of OcrBlock objects from page
        min_conf: Minimum acceptable confidence (0-1)
        min_chars: Minimum acceptable character count
        
    Returns:
        True if quality is OK, False if page needs reprocessing
    """
    if not blocks:
        return False
    
    # Calculate total character count
    char_count = sum(len(b.text) for b in blocks)
    if char_count < min_chars:
        return False
    
    # Calculate average confidence (if available)
    confidences = [b.confidence for b in blocks if b.confidence is not None]
    if confidences:
        avg_conf = sum(confidences) / len(confidences)
        if avg_conf < min_conf:
            return False
    
    return True


def is_doc_ocr_sufficient(text: str, page_count: int) -> bool:
    """
    Determine if OCR extraction yielded sufficient content for the document.
    
    Quality heuristics:
    - Minimum character count: max(500, 50 * page_count)
    - Non-whitespace ratio: > 0.5 (to filter out garbage)
    
    Args:
        text: Full document text from OCR
        page_count: Number of pages in document
        
    Returns:
        True if OCR is sufficient, False if document should be marked ocr_failed
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


def calculate_page_stats(blocks: List[OcrBlock]) -> dict:
    """
    Calculate statistics for a page.
    
    Args:
        blocks: List of OcrBlock objects
        
    Returns:
        Dictionary with char_count, avg_conf, block_count
    """
    char_count = sum(len(b.text) for b in blocks)
    
    confidences = [b.confidence for b in blocks if b.confidence is not None]
    avg_conf = sum(confidences) / len(confidences) if confidences else None
    
    return {
        'char_count': char_count,
        'avg_conf': avg_conf,
        'block_count': len(blocks)
    }


def should_use_tesseract_fallback(
    paddle_blocks: List[OcrBlock],
    min_conf: float = 0.6,
    min_chars: int = 50
) -> bool:
    """
    Determine if Tesseract fallback should be used for this page.
    
    This is the same check as is_page_quality_ok but with explicit naming
    to clarify when fallback is triggered.
    
    Args:
        paddle_blocks: Blocks from PaddleOCR attempt
        min_conf: Minimum acceptable confidence
        min_chars: Minimum acceptable character count
        
    Returns:
        True if Tesseract fallback should be used, False otherwise
    """
    return not is_page_quality_ok(paddle_blocks, min_conf, min_chars)
