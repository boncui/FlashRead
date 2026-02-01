"""
PDF page rendering to images for OCR processing.
Uses PyMuPDF (fitz) to render pages at specified DPI.
"""

import fitz  # PyMuPDF
import numpy as np
from typing import Optional
from PIL import Image


def render_page(pdf_bytes: bytes, page_num: int, dpi: int = 200) -> np.ndarray:
    """
    Render a PDF page to an image array for OCR processing.
    
    Args:
        pdf_bytes: PDF file bytes
        page_num: Page number (0-indexed)
        dpi: Rendering resolution (default 200)
        
    Returns:
        numpy array in RGB format (H x W x 3)
        
    Raises:
        ValueError: If page number is invalid
    """
    # Open PDF from bytes
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    try:
        if page_num < 0 or page_num >= len(doc):
            raise ValueError(f"Invalid page number {page_num}. Document has {len(doc)} pages.")
        
        page = doc[page_num]
        
        # Calculate zoom factor for desired DPI
        # PyMuPDF default is 72 DPI, so zoom = target_dpi / 72
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        
        # Render page to pixmap
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # Convert pixmap to numpy array
        # PyMuPDF returns RGB by default when alpha=False
        img_data = np.frombuffer(pix.samples, dtype=np.uint8)
        img_array = img_data.reshape(pix.height, pix.width, 3)
        
        return img_array
        
    finally:
        doc.close()


def render_all_pages(pdf_bytes: bytes, dpi: int = 200) -> list[np.ndarray]:
    """
    Render all pages of a PDF to image arrays.
    
    Args:
        pdf_bytes: PDF file bytes
        dpi: Rendering resolution (default 200)
        
    Returns:
        List of numpy arrays (one per page) in RGB format
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    try:
        page_count = len(doc)
        images = []
        
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        
        for page_num in range(page_count):
            page = doc[page_num]
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            img_data = np.frombuffer(pix.samples, dtype=np.uint8)
            img_array = img_data.reshape(pix.height, pix.width, 3)
            images.append(img_array)
        
        return images
        
    finally:
        doc.close()


def get_page_count(pdf_bytes: bytes) -> int:
    """
    Get the number of pages in a PDF.
    
    Args:
        pdf_bytes: PDF file bytes
        
    Returns:
        Number of pages
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return len(doc)
    finally:
        doc.close()
