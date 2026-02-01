import fitz  # PyMuPDF
from typing import List
from datetime import datetime
from .models import OcrVersion, OcrPage, PageBlock, OcrMetrics


def get_pymupdf_version() -> str:
    """Get PyMuPDF version"""
    return fitz.__version__


def extract_text_from_pdf(pdf_bytes: bytes) -> OcrVersion:
    """
    Extract text directly from PDF using PyMuPDF (fast path).
    Works well for PDFs with embedded text layers.
    
    Args:
        pdf_bytes: PDF file bytes
        
    Returns:
        OcrVersion with extracted text and metadata
    """
    start_time = datetime.now()
    
    # Open PDF from bytes
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    pages: List[OcrPage] = []
    all_text_parts: List[str] = []
    total_chars = 0
    
    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Extract text from page
            page_text = page.get_text()
            
            # Create a single block for the entire page
            # (PyMuPDF doesn't provide block-level structure easily in Phase 2a)
            blocks: List[PageBlock] = []
            if page_text.strip():
                blocks.append(PageBlock(
                    type='paragraph',
                    text=page_text,
                    confidence=None,  # Direct extraction has no confidence score
                    bbox=None
                ))
            
            pages.append(OcrPage(
                page=page_num + 1,  # 1-indexed
                blocks=blocks,
                text=page_text,
                raw_text=page_text,
                confidence=None
            ))
            
            all_text_parts.append(f"\n\n--- Page {page_num + 1} ---\n\n")
            all_text_parts.append(page_text)
            total_chars += len(page_text)
    
    finally:
        doc.close()
    
    end_time = datetime.now()
    runtime_ms = int((end_time - start_time).total_seconds() * 1000)
    
    # Combine all text with page separators
    doc_text = ''.join(all_text_parts)
    
    return OcrVersion(
        created_at=start_time.isoformat() + 'Z',
        engine='pymupdf',
        engine_version=get_pymupdf_version(),
        pipeline_version='',  # Will be set by caller
        pages=pages,
        doc_text=doc_text,
        metrics=OcrMetrics(
            total_pages=len(pages),
            method='direct',
            char_count=total_chars,
            avg_conf=None,  # Direct extraction has no confidence
            runtime_ms=runtime_ms
        ),
        warnings=[],
        # Legacy fields
        model_name='pymupdf',
        model_version=get_pymupdf_version()
    )
