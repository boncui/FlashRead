"""
Tesseract OCR engine wrapper for fallback OCR processing.
Used when PaddleOCR produces poor results.
"""

import numpy as np
from typing import Optional, List
import pytesseract
from PIL import Image


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


class TesseractEngine:
    """
    Tesseract OCR wrapper for CPU-based fallback OCR.
    
    Used for pages where PaddleOCR produces poor results.
    """
    
    def __init__(self, lang: str = 'eng', oem: int = 1, psm: int = 6):
        """
        Initialize Tesseract engine.
        
        Args:
            lang: Language code (default 'eng')
            oem: OCR Engine Mode (default 1 = LSTM only)
            psm: Page Segmentation Mode (default 6 = single uniform block)
        """
        self.lang = lang
        self.oem = oem
        self.psm = psm
        self.config = f'--oem {oem} --psm {psm}'
    
    def ocr_image(self, img: np.ndarray) -> List[OcrBlock]:
        """
        Run OCR on an image.
        
        Args:
            img: Image as numpy array (H x W x 3, RGB)
            
        Returns:
            List of OcrBlock objects with text (confidence may be None)
        """
        try:
            # Convert numpy array to PIL Image
            pil_img = Image.fromarray(img)
            
            # Get detailed data with bounding boxes and confidence
            data = pytesseract.image_to_data(
                pil_img,
                lang=self.lang,
                config=self.config,
                output_type=pytesseract.Output.DICT
            )
            
            blocks = []
            n_boxes = len(data['text'])
            
            for i in range(n_boxes):
                text = data['text'][i].strip()
                conf = data['conf'][i]
                
                # Skip empty text or very low confidence
                if not text or conf < 0:
                    continue
                
                # Extract bbox
                x = data['left'][i]
                y = data['top'][i]
                width = data['width'][i]
                height = data['height'][i]
                
                # Normalize confidence to 0-1 range (Tesseract uses 0-100)
                confidence = float(conf) / 100.0 if conf >= 0 else None
                
                blocks.append(OcrBlock(
                    text=text,
                    confidence=confidence,
                    bbox=[x, y, width, height]
                ))
            
            return blocks
            
        except Exception as e:
            print(f"Tesseract error: {e}")
            # Fallback to simple text extraction without bbox
            try:
                pil_img = Image.fromarray(img)
                text = pytesseract.image_to_string(
                    pil_img,
                    lang=self.lang,
                    config=self.config
                ).strip()
                
                if text:
                    return [OcrBlock(text=text, confidence=None, bbox=None)]
                return []
                
            except Exception as e2:
                print(f"Tesseract fallback error: {e2}")
                return []
    
    def get_version(self) -> str:
        """Get Tesseract version"""
        try:
            version = pytesseract.get_tesseract_version()
            return str(version)
        except:
            return "5.0.0"  # Default version
    
    def calculate_page_confidence(self, blocks: List[OcrBlock]) -> Optional[float]:
        """
        Calculate average confidence for a page.
        
        Args:
            blocks: List of OcrBlock objects
            
        Returns:
            Average confidence (0-1) or None if no confidence data
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
