"""
OCR orchestration router with adaptive rerendering.
Implements the Phase 2b pipeline logic.
"""

from typing import List, Optional, Dict
from datetime import datetime
import sys
sys.path.append('..')
from ..models import OcrVersion, OcrPage, PageBlock
from .renderer import render_page, get_page_count
from .paddle_engine import PaddleEngine
from .tesseract_engine import TesseractEngine
from .normalize import normalize_paddle_output, normalize_tesseract_output, build_ocr_version
from .quality import is_page_quality_ok, calculate_page_stats
from ..config import (
    OCR_DPI_INITIAL,
    OCR_DPI_RERUN,
    OCR_MIN_CONFIDENCE,
    OCR_MIN_CHARS_PER_PAGE,
    TESSERACT_LANG,
    PIPELINE_VERSION
)


class PageResult:
    """Holds OCR results for a single page"""
    def __init__(
        self,
        page_num: int,
        blocks: List,
        method: str,
        dpi_used: int,
        needed_rerun: bool = False,
        used_fallback: bool = False
    ):
        self.page_num = page_num
        self.blocks = blocks
        self.method = method
        self.dpi_used = dpi_used
        self.needed_rerun = needed_rerun
        self.used_fallback = used_fallback


def process_document_ocr(
    pdf_bytes: bytes,
    language: str = 'en',
    dpi_initial: Optional[int] = None,
    dpi_rerun: Optional[int] = None
) -> OcrVersion:
    """
    Process a document with OCR using adaptive rerendering pipeline.
    
    Pipeline:
    1. Render all pages at initial DPI (200)
    2. Run PaddleOCR on all pages
    3. Identify bad pages (conf < 0.6 OR chars < 50)
    4. Rerender bad pages at higher DPI (300), retry PaddleOCR
    5. For still-bad pages, use Tesseract fallback
    6. Normalize and return OcrVersion
    
    Args:
        pdf_bytes: PDF file bytes
        language: Language code (default 'en')
        dpi_initial: Initial rendering DPI (default from config)
        dpi_rerun: Rerun rendering DPI (default from config)
        
    Returns:
        Complete OcrVersion object with all pages processed
    """
    start_time = datetime.now()
    
    # Use config defaults if not specified
    dpi_initial = dpi_initial or OCR_DPI_INITIAL
    dpi_rerun = dpi_rerun or OCR_DPI_RERUN
    
    # Initialize engines (reuse for all pages)
    paddle = PaddleEngine(lang=language, use_angle_cls=True)
    tesseract = TesseractEngine(lang='eng' if language == 'en' else language)
    
    print(f"   Initializing OCR engines (Paddle + Tesseract)...")
    
    # Get page count
    page_count = get_page_count(pdf_bytes)
    print(f"   Processing {page_count} pages with OCR...")
    
    # Track results and metadata
    page_results: List[PageResult] = []
    bad_page_nums = []
    fallback_page_nums = []
    
    # Phase 1: Initial pass at DPI_INITIAL with PaddleOCR
    print(f"   Phase 1: PaddleOCR at {dpi_initial} DPI...")
    for page_num in range(page_count):
        img = render_page(pdf_bytes, page_num, dpi=dpi_initial)
        blocks = paddle.ocr_image(img)
        
        stats = calculate_page_stats(blocks)
        is_ok = is_page_quality_ok(blocks, OCR_MIN_CONFIDENCE, OCR_MIN_CHARS_PER_PAGE)
        
        if is_ok:
            page_results.append(PageResult(
                page_num=page_num,
                blocks=blocks,
                method='paddle',
                dpi_used=dpi_initial,
                needed_rerun=False,
                used_fallback=False
            ))
        else:
            # Mark as bad, will reprocess
            bad_page_nums.append(page_num)
            page_results.append(None)  # Placeholder
    
    print(f"   ✓ Phase 1 complete: {len(bad_page_nums)} bad pages found")
    
    # Phase 2: Rerender bad pages at higher DPI
    if bad_page_nums:
        print(f"   Phase 2: Rerendering {len(bad_page_nums)} pages at {dpi_rerun} DPI...")
        still_bad = []
        
        for page_num in bad_page_nums:
            img = render_page(pdf_bytes, page_num, dpi=dpi_rerun)
            blocks = paddle.ocr_image(img)
            
            is_ok = is_page_quality_ok(blocks, OCR_MIN_CONFIDENCE, OCR_MIN_CHARS_PER_PAGE)
            
            if is_ok:
                # Rerun succeeded
                page_results[page_num] = PageResult(
                    page_num=page_num,
                    blocks=blocks,
                    method='paddle',
                    dpi_used=dpi_rerun,
                    needed_rerun=True,
                    used_fallback=False
                )
            else:
                # Still bad, needs Tesseract
                still_bad.append(page_num)
        
        print(f"   ✓ Phase 2 complete: {len(still_bad)} pages still need fallback")
        
        # Phase 3: Tesseract fallback for still-bad pages
        if still_bad:
            print(f"   Phase 3: Tesseract fallback for {len(still_bad)} pages...")
            for page_num in still_bad:
                # Use the higher DPI image already rendered
                img = render_page(pdf_bytes, page_num, dpi=dpi_rerun)
                blocks = tesseract.ocr_image(img)
                
                fallback_page_nums.append(page_num)
                page_results[page_num] = PageResult(
                    page_num=page_num,
                    blocks=blocks,
                    method='tesseract',
                    dpi_used=dpi_rerun,
                    needed_rerun=True,
                    used_fallback=True
                )
            
            print(f"   ✓ Phase 3 complete: Tesseract processed {len(still_bad)} pages")
    
    # Normalize results to OcrPage objects
    ocr_pages: List[OcrPage] = []
    for result in page_results:
        if result.method == 'paddle':
            page_blocks = normalize_paddle_output(result.blocks)
        else:
            page_blocks = normalize_tesseract_output(result.blocks)
        
        # Calculate page text and confidence
        page_text = '\n'.join(b.text for b in page_blocks)
        confidences = [b.confidence for b in page_blocks if b.confidence is not None]
        page_conf = sum(confidences) / len(confidences) if confidences else None
        
        ocr_pages.append(OcrPage(
            page=result.page_num + 1,  # 1-indexed
            blocks=page_blocks,
            text=page_text,
            raw_text=page_text,
            confidence=page_conf
        ))
    
    # Determine engine and method
    if not fallback_page_nums:
        engine = 'paddle'
        engine_version = paddle.get_version()
        method = 'paddle'
    elif len(fallback_page_nums) == page_count:
        engine = 'tesseract'
        engine_version = tesseract.get_version()
        method = 'tesseract'
    else:
        engine = 'hybrid'
        engine_version = f"paddle{paddle.get_version()}+tess{tesseract.get_version()}"
        method = 'hybrid'
    
    # Calculate runtime
    end_time = datetime.now()
    runtime_ms = int((end_time - start_time).total_seconds() * 1000)
    
    # Build final OcrVersion
    ocr_version = build_ocr_version(
        pages=ocr_pages,
        engine=engine,
        engine_version=engine_version,
        pipeline_version=PIPELINE_VERSION,
        method=method,
        runtime_ms=runtime_ms,
        dpi_initial=dpi_initial,
        dpi_rerun=dpi_rerun if bad_page_nums else None,
        bad_pages=bad_page_nums,
        fallback_pages=fallback_page_nums,
        warnings=[]
    )
    
    return ocr_version
