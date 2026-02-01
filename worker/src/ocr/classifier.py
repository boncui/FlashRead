"""
Block classification based on position and content.
Uses bounding box data and text patterns to classify OCR blocks.
"""

import re
from typing import Optional, Tuple
from dataclasses import dataclass


# ============================================================
# Block Type Constants
# ============================================================

class BlockType:
    """Standard block types matching the frontend schema"""
    TITLE = 'title'
    SECTION_HEADER = 'section_header'
    HEADER = 'header'  # Page running header
    PARAGRAPH = 'paragraph'
    EQUATION = 'equation'
    TABLE = 'table'
    FIGURE = 'figure'
    CAPTION = 'caption'
    LIST = 'list'
    CODE = 'code'
    CITATION = 'citation'
    FOOTNOTE = 'footnote'
    PAGE_NUMBER = 'page_number'
    OTHER = 'other'
    UNKNOWN = 'unknown'


# ============================================================
# Position Thresholds (as percentage of page dimensions)
# ============================================================

@dataclass
class PositionThresholds:
    """Thresholds for position-based classification"""
    # Vertical thresholds (percentage of page height)
    header_zone: float = 0.08      # Top 8% of page
    footer_zone: float = 0.92     # Bottom 8% of page
    footnote_zone: float = 0.80   # Bottom 20% of page
    
    # Horizontal thresholds (percentage of page width)  
    margin_left: float = 0.15     # Left 15% is margin
    margin_right: float = 0.85    # Right 15% is margin
    center_tolerance: float = 0.15  # Within 15% of center is "centered"


DEFAULT_THRESHOLDS = PositionThresholds()


# ============================================================
# Content Patterns
# ============================================================

# Page number patterns
PAGE_NUMBER_PATTERNS = [
    re.compile(r'^-?\s*\d{1,4}\s*-?$'),           # "1", "-1-", "- 23 -"
    re.compile(r'^Page\s+\d{1,4}$', re.I),        # "Page 1"
    re.compile(r'^\[\s*\d{1,4}\s*\]$'),           # "[1]"
    re.compile(r'^\(\s*\d{1,4}\s*\)$'),           # "(1)"
]

# Caption patterns
CAPTION_PATTERNS = [
    re.compile(r'^Figure\s+\d+', re.I),
    re.compile(r'^Fig\.\s*\d+', re.I),
    re.compile(r'^Table\s+\d+', re.I),
    re.compile(r'^Tbl\.\s*\d+', re.I),
    re.compile(r'^Chart\s+\d+', re.I),
    re.compile(r'^Graph\s+\d+', re.I),
    re.compile(r'^Exhibit\s+\d+', re.I),
    re.compile(r'^Plate\s+\d+', re.I),
    re.compile(r'^Diagram\s+\d+', re.I),
]

# Section header patterns (academic papers)
SECTION_HEADER_PATTERNS = [
    re.compile(r'^(Abstract|Introduction|Methods?|Methodology|Results?|Discussion|Conclusion|References|Bibliography|Acknowledgment)s?$', re.I),
    re.compile(r'^\d+\.?\s+[A-Z]'),  # "1. Introduction", "2 Methods"
    re.compile(r'^[IVXLCDM]+\.?\s+[A-Z]'),  # "I. Introduction" (Roman numerals)
]

# Footnote marker patterns
FOOTNOTE_MARKER_PATTERNS = [
    re.compile(r'^[¹²³⁴⁵⁶⁷⁸⁹⁰]+\s'),  # Superscript numbers
    re.compile(r'^\[\d{1,2}\]\s'),      # [1] style
    re.compile(r'^[†‡§\*]\s'),          # Dagger, etc.
]

# Running header patterns (short repeated text at page edges)
RUNNING_HEADER_MAX_LENGTH = 80


# ============================================================
# Classification Functions
# ============================================================

def get_block_position(
    bbox: Optional[Tuple[float, float, float, float]],
    page_height: float,
    page_width: float
) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    """
    Get normalized block position (0-1 range).
    
    Args:
        bbox: Bounding box [x, y, width, height] in page coordinates
        page_height: Total page height
        page_width: Total page width
        
    Returns:
        Tuple of (y_start, y_end, x_center, width_ratio) or (None, None, None, None)
    """
    if not bbox or page_height <= 0 or page_width <= 0:
        return None, None, None, None
    
    x, y, w, h = bbox
    
    y_start = y / page_height
    y_end = (y + h) / page_height
    x_center = (x + w / 2) / page_width
    width_ratio = w / page_width
    
    return y_start, y_end, x_center, width_ratio


def is_page_number(text: str) -> bool:
    """Check if text is a page number"""
    trimmed = text.strip()
    if len(trimmed) > 20:
        return False
    return any(p.match(trimmed) for p in PAGE_NUMBER_PATTERNS)


def is_caption(text: str) -> bool:
    """Check if text is a figure/table caption"""
    trimmed = text.strip()
    return any(p.match(trimmed) for p in CAPTION_PATTERNS)


def is_section_header(text: str) -> bool:
    """Check if text is a section header"""
    trimmed = text.strip()
    if len(trimmed) > 100:
        return False
    return any(p.match(trimmed) for p in SECTION_HEADER_PATTERNS)


def is_footnote_marker(text: str) -> bool:
    """Check if text starts with a footnote marker"""
    trimmed = text.strip()
    return any(p.match(trimmed) for p in FOOTNOTE_MARKER_PATTERNS)


def is_short_centered_text(
    text: str,
    x_center: Optional[float],
    width_ratio: Optional[float],
    thresholds: PositionThresholds = DEFAULT_THRESHOLDS
) -> bool:
    """Check if text is short and horizontally centered"""
    if len(text.strip()) > RUNNING_HEADER_MAX_LENGTH:
        return False
    
    if x_center is None or width_ratio is None:
        return False
    
    # Check if centered (center is around 0.5)
    is_centered = abs(x_center - 0.5) < thresholds.center_tolerance
    
    # Check if narrow (doesn't span most of the page)
    is_narrow = width_ratio < 0.5
    
    return is_centered and is_narrow


def classify_block(
    text: str,
    bbox: Optional[Tuple[float, float, float, float]] = None,
    page_height: float = 0,
    page_width: float = 0,
    thresholds: PositionThresholds = DEFAULT_THRESHOLDS
) -> str:
    """
    Classify a text block based on content and position.
    
    Args:
        text: The block text content
        bbox: Bounding box [x, y, width, height] in page coordinates
        page_height: Total page height in same units as bbox
        page_width: Total page width in same units as bbox
        thresholds: Position thresholds for classification
        
    Returns:
        BlockType string
    """
    trimmed = text.strip()
    
    if not trimmed:
        return BlockType.OTHER
    
    # Get normalized position
    y_start, y_end, x_center, width_ratio = get_block_position(
        bbox, page_height, page_width
    )
    
    # ---- Content-based classification (high confidence) ----
    
    # Check for page numbers
    if is_page_number(trimmed):
        return BlockType.PAGE_NUMBER
    
    # Check for captions
    if is_caption(trimmed):
        return BlockType.CAPTION
    
    # Check for section headers
    if is_section_header(trimmed):
        return BlockType.SECTION_HEADER
    
    # Check for footnote markers
    if is_footnote_marker(trimmed):
        return BlockType.FOOTNOTE
    
    # ---- Position-based classification ----
    
    if y_start is not None:
        # Header zone (top of page)
        if y_start < thresholds.header_zone:
            # Short text at top is likely running header
            if len(trimmed) < RUNNING_HEADER_MAX_LENGTH:
                return BlockType.HEADER
        
        # Footer zone (bottom of page)
        if y_end > thresholds.footer_zone:
            # Short text at bottom is likely page number or running footer
            if len(trimmed) < 30 and is_page_number(trimmed):
                return BlockType.PAGE_NUMBER
            if len(trimmed) < RUNNING_HEADER_MAX_LENGTH:
                return BlockType.HEADER  # Running footer treated as header
        
        # Footnote zone (lower portion but not absolute bottom)
        if y_start > thresholds.footnote_zone and y_end < thresholds.footer_zone:
            # Small text in footnote area with markers
            if is_footnote_marker(trimmed) or trimmed[0].isdigit():
                return BlockType.FOOTNOTE
    
    # ---- Check for centered short text (titles, headers) ----
    
    if is_short_centered_text(trimmed, x_center, width_ratio, thresholds):
        # Could be a title or header
        if len(trimmed) < 60:
            return BlockType.SECTION_HEADER
    
    # Default to paragraph
    return BlockType.PARAGRAPH


def classify_blocks_for_page(
    blocks: list,
    page_height: float = 0,
    page_width: float = 0,
    thresholds: PositionThresholds = DEFAULT_THRESHOLDS
) -> list:
    """
    Classify all blocks on a page.
    
    Args:
        blocks: List of PageBlock objects (or dicts with text and bbox)
        page_height: Total page height
        page_width: Total page width
        thresholds: Position thresholds
        
    Returns:
        List of blocks with updated 'type' field
    """
    classified = []
    
    for block in blocks:
        # Handle both dict and object access
        if hasattr(block, 'text'):
            text = block.text
            bbox = tuple(block.bbox) if block.bbox else None
        else:
            text = block.get('text', '')
            bbox_val = block.get('bbox')
            bbox = tuple(bbox_val) if bbox_val else None
        
        block_type = classify_block(
            text=text,
            bbox=bbox,
            page_height=page_height,
            page_width=page_width,
            thresholds=thresholds
        )
        
        # Update the block type
        if hasattr(block, 'type'):
            block.type = block_type
        else:
            block['type'] = block_type
        
        classified.append(block)
    
    return classified


# ============================================================
# Utility Functions
# ============================================================

def is_core_content(block_type: str) -> bool:
    """
    Check if a block type represents core readable content.
    
    Args:
        block_type: The block type string
        
    Returns:
        True if the block should be included in reading content
    """
    core_types = {
        BlockType.TITLE,
        BlockType.SECTION_HEADER,
        BlockType.PARAGRAPH,
        BlockType.LIST,
    }
    return block_type in core_types


def filter_core_content(blocks: list) -> list:
    """
    Filter blocks to only include core readable content.
    
    Args:
        blocks: List of classified blocks
        
    Returns:
        Filtered list containing only core content blocks
    """
    result = []
    
    for block in blocks:
        if hasattr(block, 'type'):
            block_type = block.type
        else:
            block_type = block.get('type', BlockType.PARAGRAPH)
        
        if is_core_content(block_type):
            result.append(block)
    
    return result
