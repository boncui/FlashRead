"""
PaddleOCR engine wrapper for OCR processing.
Uses PaddleOCR in CPU mode as the primary OCR engine.
"""

import numpy as np
from typing import Optional, List, Tuple
from paddleocr import PaddleOCR
import logging

# Suppress PaddleOCR verbose logging
logging.getLogger('ppocr').setLevel(logging.ERROR)


class OcrBlock:
    """Represents a text block detected by OCR"""
    def __init__(
        self,
        text: str,
        confidence: Optional[float] = None,
        bbox: Optional[List[float]] = None
    ):
        self.text = text
        self.confidence = confidence
        self.bbox = bbox  # [x, y, width, height]


class PaddleEngine:
    """
    PaddleOCR wrapper for CPU-based OCR processing.
    
    Initializes once and reuses the model for all pages to amortize
    the initialization cost.
    """
    
    def __init__(self, lang: str = 'en', use_angle_cls: bool = True):
        """
        Initialize PaddleOCR engine.
        
        Args:
            lang: Language code (default 'en')
            use_angle_cls: Enable angle classification for rotated text
        """
        self.lang = lang
        self.use_angle_cls = use_angle_cls
        
        # Initialize PaddleOCR in CPU mode
        self.ocr = PaddleOCR(
            use_angle_cls=use_angle_cls,
            lang=lang,
            use_gpu=False,
            show_log=False,
            use_mp=False,  # Disable multiprocessing for simpler deployment
        )
    
    def ocr_image(self, img: np.ndarray) -> List[OcrBlock]:
        """
        Run OCR on an image.
        
        Args:
            img: Image as numpy array (H x W x 3, RGB)
            
        Returns:
            List of OcrBlock objects with text, confidence, and bbox
        """
        try:
            # PaddleOCR expects RGB numpy array
            result = self.ocr.ocr(img, cls=self.use_angle_cls)
            
            if not result or not result[0]:
                return []
            
            blocks = []
            for line in result[0]:
                # PaddleOCR returns: [bbox_coords, (text, confidence)]
                bbox_coords = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                text, confidence = line[1]
                
                # Convert bbox to [x, y, width, height] format
                x_coords = [pt[0] for pt in bbox_coords]
                y_coords = [pt[1] for pt in bbox_coords]
                x = min(x_coords)
                y = min(y_coords)
                width = max(x_coords) - x
                height = max(y_coords) - y
                
                bbox = [x, y, width, height]
                
                blocks.append(OcrBlock(
                    text=text.strip(),
                    confidence=float(confidence),
                    bbox=bbox
                ))
            
            return blocks
            
        except Exception as e:
            print(f"PaddleOCR error: {e}")
            return []
    
    def get_version(self) -> str:
        """Get PaddleOCR version"""
        try:
            import paddleocr
            return paddleocr.__version__
        except:
            return "2.7.3"  # Default version
    
    def calculate_page_confidence(self, blocks: List[OcrBlock]) -> Optional[float]:
        """
        Calculate average confidence for a page.
        
        Args:
            blocks: List of OcrBlock objects
            
        Returns:
            Average confidence (0-1) or None if no blocks
        """
        if not blocks:
            return None
        
        confidences = [b.confidence for b in blocks if b.confidence is not None]
        if not confidences:
            return None
        
        return sum(confidences) / len(confidences)
    
    def calculate_page_char_count(self, blocks: List[OcrBlock]) -> int:
        """
        Calculate total character count for a page.
        
        Args:
            blocks: List of OcrBlock objects
            
        Returns:
            Total character count
        """
        return sum(len(b.text) for b in blocks)
