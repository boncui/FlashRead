"""
OCR module for Phase 2b: Optical Character Recognition fallback pipeline.

This module handles OCR processing for documents that lack usable text layers:
- PaddleOCR as the primary engine (CPU-optimized)
- Tesseract as the fallback engine
- Adaptive DPI rerendering for poor quality pages
- Normalized output conforming to OcrVersion schema
"""

from .renderer import render_page
from .paddle_engine import PaddleEngine
from .tesseract_engine import TesseractEngine
from .router import process_document_ocr
from .normalize import build_ocr_version
from .quality import is_page_quality_ok, is_doc_ocr_sufficient

__all__ = [
    'render_page',
    'PaddleEngine',
    'TesseractEngine',
    'process_document_ocr',
    'build_ocr_version',
    'is_page_quality_ok',
    'is_doc_ocr_sufficient',
]
