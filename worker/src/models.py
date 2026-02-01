from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class PageBlock(BaseModel):
    """A block of content within a page"""
    type: str  # 'paragraph', 'header', 'other', etc.
    text: str
    latex: Optional[str] = None
    cells: Optional[List[List[str]]] = None
    confidence: Optional[float] = None
    bbox: Optional[List[float]] = None


class OcrPage(BaseModel):
    """A single page of extracted text"""
    page: int
    blocks: List[PageBlock]
    raw_text: Optional[str] = None
    text: Optional[str] = None
    confidence: Optional[float] = None


class OcrMetrics(BaseModel):
    """Metrics about the extraction process"""
    total_pages: int
    method: str  # 'direct', 'paddle', 'tesseract', 'hybrid'
    char_count: int
    avg_conf: Optional[float] = None
    runtime_ms: int
    # Phase 2b OCR-specific fields
    dpi_initial: Optional[int] = None
    dpi_rerun: Optional[int] = None
    bad_pages: Optional[List[int]] = None
    fallback_pages: Optional[List[int]] = None


class OcrVersion(BaseModel):
    """Complete OCR extraction result"""
    created_at: str
    engine: str  # 'pymupdf', 'paddleocr', 'tesseract'
    engine_version: str
    pipeline_version: str
    pages: List[OcrPage]
    doc_text: Optional[str] = None
    metrics: OcrMetrics
    warnings: Optional[List[str]] = None
    
    # Legacy fields for backward compatibility
    model_name: Optional[str] = None
    model_version: Optional[str] = None


class DocumentJob(BaseModel):
    """Document processing job"""
    id: str
    document_id: str
    job_type: str
    status: str
    priority: int
    attempts: int
    max_attempts: int
    locked_at: Optional[str] = None
    locked_by: Optional[str] = None
    last_error: Optional[str] = None
    result: Optional[dict] = None
    created_at: str
    updated_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
