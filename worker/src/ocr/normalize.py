"""
Output normalization for OCR results.
Converts PaddleOCR and Tesseract outputs into the OcrVersion schema.
"""

from typing import List, Optional
from datetime import datetime
import sys
sys.path.append('..')
from ..models import OcrVersion, OcrPage, PageBlock, OcrMetrics
from .paddle_engine import OcrBlock
from .classifier import classify_block, is_core_content


def normalize_paddle_output(
    blocks: List[OcrBlock],
    page_height: float = 0,
    page_width: float = 0,
    classify: bool = True
) -> List[PageBlock]:
    """
    Normalize PaddleOCR blocks to PageBlock schema.
    
    Args:
        blocks: List of OcrBlock objects from PaddleOCR
        page_height: Page height for position-based classification
        page_width: Page width for position-based classification
        classify: Whether to classify blocks (default True)
        
    Returns:
        List of PageBlock objects conforming to schema
    """
    page_blocks = []
    
    for block in blocks:
        # Determine block type
        if classify:
            block_type = classify_block(
                text=block.text,
                bbox=tuple(block.bbox) if block.bbox else None,
                page_height=page_height,
                page_width=page_width
            )
        else:
            block_type = 'paragraph'
        
        page_blocks.append(PageBlock(
            type=block_type,
            text=block.text,
            confidence=block.confidence,
            bbox=block.bbox
        ))
    
    return page_blocks


def normalize_tesseract_output(
    blocks: List[OcrBlock],
    page_height: float = 0,
    page_width: float = 0,
    classify: bool = True
) -> List[PageBlock]:
    """
    Normalize Tesseract blocks to PageBlock schema.
    
    Args:
        blocks: List of OcrBlock objects from Tesseract
        page_height: Page height for position-based classification
        page_width: Page width for position-based classification
        classify: Whether to classify blocks (default True)
        
    Returns:
        List of PageBlock objects conforming to schema
    """
    page_blocks = []
    
    for block in blocks:
        # Determine block type
        if classify:
            block_type = classify_block(
                text=block.text,
                bbox=tuple(block.bbox) if block.bbox else None,
                page_height=page_height,
                page_width=page_width
            )
        else:
            block_type = 'paragraph'
        
        page_blocks.append(PageBlock(
            type=block_type,
            text=block.text,
            confidence=block.confidence,
            bbox=block.bbox
        ))
    
    return page_blocks


def build_ocr_version(
    pages: List[OcrPage],
    engine: str,
    engine_version: str,
    pipeline_version: str,
    method: str,
    runtime_ms: int,
    dpi_initial: int,
    dpi_rerun: Optional[int] = None,
    bad_pages: Optional[List[int]] = None,
    fallback_pages: Optional[List[int]] = None,
    warnings: Optional[List[str]] = None,
    filter_doc_text: bool = True
) -> OcrVersion:
    """
    Build a complete OcrVersion object from processed pages.
    
    Args:
        pages: List of OcrPage objects
        engine: Engine name ('paddle', 'tesseract', 'hybrid')
        engine_version: Engine version string
        pipeline_version: Pipeline version (e.g., '1.0.0')
        method: OCR method ('paddle', 'tesseract', 'hybrid')
        runtime_ms: Total processing time in milliseconds
        dpi_initial: Initial rendering DPI
        dpi_rerun: Rerun rendering DPI (if used)
        bad_pages: List of page numbers that needed reprocessing
        fallback_pages: List of page numbers that used Tesseract
        warnings: List of warning messages
        filter_doc_text: If True, exclude non-core content from doc_text
        
    Returns:
        Complete OcrVersion object
    """
    # Calculate total characters
    char_count = 0
    all_confidences = []
    
    for page in pages:
        for block in page.blocks:
            char_count += len(block.text)
            if block.confidence is not None:
                all_confidences.append(block.confidence)
    
    # Calculate average confidence
    avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else None
    
    # Build doc_text - optionally filter to core content only
    # Note: We don't include page separators anymore as they pollute RSVP reading
    doc_text_parts = []
    for page in pages:
        page_blocks = []
        for block in page.blocks:
            # If filtering, only include core content types
            if filter_doc_text:
                if is_core_content(block.type):
                    page_blocks.append(block.text)
            else:
                page_blocks.append(block.text)
        
        if page_blocks:
            page_text = '\n'.join(page_blocks)
            doc_text_parts.append(page_text)
    
    # Join pages with double newline (paragraph break)
    doc_text = '\n\n'.join(doc_text_parts)
    
    # Build metrics
    metrics = OcrMetrics(
        total_pages=len(pages),
        method=method,
        char_count=char_count,
        avg_conf=avg_conf,
        runtime_ms=runtime_ms,
        dpi_initial=dpi_initial,
        dpi_rerun=dpi_rerun,
        bad_pages=bad_pages or [],
        fallback_pages=fallback_pages or []
    )
    
    # Create OcrVersion
    return OcrVersion(
        created_at=datetime.utcnow().isoformat() + 'Z',
        engine=engine,
        engine_version=engine_version,
        pipeline_version=pipeline_version,
        pages=pages,
        doc_text=doc_text,
        metrics=metrics,
        warnings=warnings or [],
        # Legacy fields for backward compat
        model_name=engine,
        model_version=engine_version
    )


def merge_blocks_to_text(
    blocks: List[PageBlock],
    core_only: bool = False
) -> str:
    """
    Merge page blocks into a single text string.
    
    Args:
        blocks: List of PageBlock objects
        core_only: If True, only include core content blocks
        
    Returns:
        Merged text
    """
    if core_only:
        filtered = [b for b in blocks if is_core_content(b.type)]
        return '\n'.join(block.text for block in filtered)
    return '\n'.join(block.text for block in blocks)
