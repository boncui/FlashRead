/**
 * Content filtering utilities for RSVP reader.
 * Removes non-core content like page markers, footnotes, captions, and references.
 */

export interface ContentFilterOptions {
  /** Remove page separator markers like "--- Page 1 ---" */
  removePageMarkers?: boolean;
  /** Remove standalone page numbers like "Page 1", "1", "-1-" */
  removePageNumbers?: boolean;
  /** Remove figure/table captions like "Figure 1:", "Table 2." */
  removeCaptions?: boolean;
  /** Remove footnote markers and short footnote-like lines */
  removeFootnotes?: boolean;
  /** Remove everything after References/Bibliography section */
  removeReferences?: boolean;
  /** Remove running headers (short repeated lines) */
  removeRunningHeaders?: boolean;
}

const DEFAULT_OPTIONS: ContentFilterOptions = {
  removePageMarkers: true,
  removePageNumbers: true,
  removeCaptions: true,
  removeFootnotes: true,
  removeReferences: true,
  removeRunningHeaders: true,
};

// ============================================================
// Pattern Definitions
// ============================================================

/** Page separator pattern: "--- Page 1 ---", "—— Page 12 ——", etc. */
const PAGE_SEPARATOR_PATTERN = /^[-—–]{2,}\s*Page\s+\d+\s*[-—–]{2,}$/i;

/** Standalone page numbers: "Page 1", "page 23", "1", "- 1 -", "(1)", "[1]" */
const PAGE_NUMBER_PATTERNS = [
  /^Page\s+\d{1,4}$/i,                    // "Page 1", "Page 123"
  /^-\s*\d{1,4}\s*-$/,                    // "- 1 -", "-23-"
  /^\(\s*\d{1,4}\s*\)$/,                  // "(1)", "( 23 )"
  /^\[\s*\d{1,4}\s*\]$/,                  // "[1]", "[ 23 ]"
  /^\d{1,3}$/,                            // "1", "23", "123" (short numbers only)
];

/** Figure/table caption patterns */
const CAPTION_PATTERNS = [
  /^Figure\s+\d+[.:]/i,                   // "Figure 1:", "Figure 12."
  /^Fig\.\s*\d+[.:]/i,                    // "Fig. 1:", "Fig.12."
  /^Table\s+\d+[.:]/i,                    // "Table 1:", "Table 12."
  /^Tbl\.\s*\d+[.:]/i,                    // "Tbl. 1:", "Tbl.12."
  /^Chart\s+\d+[.:]/i,                    // "Chart 1:"
  /^Graph\s+\d+[.:]/i,                    // "Graph 1:"
  /^Exhibit\s+\d+[.:]/i,                  // "Exhibit 1:"
  /^Plate\s+\d+[.:]/i,                    // "Plate 1:"
  /^Diagram\s+\d+[.:]/i,                  // "Diagram 1:"
];

/** References section header patterns */
const REFERENCES_HEADER_PATTERNS = [
  /^References$/i,
  /^Bibliography$/i,
  /^Works\s+Cited$/i,
  /^Literature\s+Cited$/i,
  /^Citations$/i,
  /^Sources$/i,
  /^Notes\s+and\s+References$/i,
];

/** Footnote patterns - lines starting with superscript-like numbers */
const FOOTNOTE_PATTERNS = [
  /^[¹²³⁴⁵⁶⁷⁸⁹⁰]+\s+\S/,                  // Superscript numbers: "¹ Text..."
  /^\[\d{1,2}\]\s+\S/,                    // Bracketed: "[1] Text..."
  /^†\s+\S/,                              // Dagger: "† Text..."
  /^‡\s+\S/,                              // Double dagger: "‡ Text..."
  /^§\s+\S/,                              // Section: "§ Text..."
  /^\*\s+\S/,                             // Asterisk: "* Text..."
];

// ============================================================
// Filter Functions
// ============================================================

/**
 * Check if a line is a page separator marker
 */
export function isPageMarker(text: string): boolean {
  return PAGE_SEPARATOR_PATTERN.test(text.trim());
}

/**
 * Check if a line is a standalone page number
 */
export function isPageNumber(text: string): boolean {
  const trimmed = text.trim();
  return PAGE_NUMBER_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a line is a figure/table caption
 */
export function isCaption(text: string): boolean {
  const trimmed = text.trim();
  return CAPTION_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a line is a footnote
 */
export function isFootnote(text: string): boolean {
  const trimmed = text.trim();
  // Footnotes are typically short-ish lines starting with markers
  if (trimmed.length > 500) return false;
  return FOOTNOTE_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a line is a references section header
 */
export function isReferencesHeader(text: string): boolean {
  const trimmed = text.trim();
  return REFERENCES_HEADER_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Filter a single paragraph/block and return null if it should be removed
 */
export function filterParagraph(
  text: string,
  options: ContentFilterOptions = DEFAULT_OPTIONS
): string | null {
  const trimmed = text.trim();
  
  // Empty text
  if (!trimmed) return null;
  
  // Page markers
  if (options.removePageMarkers && isPageMarker(trimmed)) {
    return null;
  }
  
  // Page numbers (only filter very short lines)
  if (options.removePageNumbers && trimmed.length < 15 && isPageNumber(trimmed)) {
    return null;
  }
  
  // Captions
  if (options.removeCaptions && isCaption(trimmed)) {
    return null;
  }
  
  // Footnotes
  if (options.removeFootnotes && isFootnote(trimmed)) {
    return null;
  }
  
  return text;
}

/**
 * Filter an array of text blocks, removing non-core content
 */
export function filterBlocks<T extends { text: string }>(
  blocks: T[],
  options: ContentFilterOptions = DEFAULT_OPTIONS
): T[] {
  const result: T[] = [];
  let inReferencesSection = false;
  
  for (const block of blocks) {
    const text = block.text.trim();
    
    // Check for references section start
    if (options.removeReferences && isReferencesHeader(text)) {
      inReferencesSection = true;
      continue;
    }
    
    // Skip everything after references header
    if (inReferencesSection) {
      continue;
    }
    
    // Apply paragraph-level filters
    const filtered = filterParagraph(text, options);
    if (filtered !== null) {
      result.push(block);
    }
  }
  
  return result;
}

/**
 * Filter raw text by splitting into paragraphs, filtering, and rejoining
 */
export function filterText(
  text: string,
  options: ContentFilterOptions = DEFAULT_OPTIONS
): string {
  // Split by paragraph breaks (blank lines)
  const paragraphs = text.split(/\n\s*\n/);
  const filteredParagraphs: string[] = [];
  let inReferencesSection = false;
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    
    // Skip empty paragraphs
    if (!trimmed) continue;
    
    // Check for references section start
    if (options.removeReferences && isReferencesHeader(trimmed)) {
      inReferencesSection = true;
      continue;
    }
    
    // Skip everything after references header
    if (inReferencesSection) {
      continue;
    }
    
    // Apply paragraph-level filters
    const filtered = filterParagraph(trimmed, options);
    if (filtered !== null) {
      filteredParagraphs.push(trimmed);
    }
  }
  
  return filteredParagraphs.join('\n\n');
}

/**
 * Detect and remove running headers (short lines that repeat across the text)
 * This is more expensive as it requires scanning the full text first
 */
export function removeRunningHeaders(
  paragraphs: string[],
  minOccurrences: number = 3
): string[] {
  // Count occurrences of short lines (potential headers)
  const counts = new Map<string, number>();
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    // Running headers are typically short
    if (trimmed.length < 100 && trimmed.length > 0) {
      // Normalize for comparison (lowercase, collapse whitespace)
      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  
  // Find repeated short lines
  const repeatedHeaders = new Set<string>();
  for (const [normalized, count] of counts) {
    if (count >= minOccurrences) {
      repeatedHeaders.add(normalized);
    }
  }
  
  // Filter out the repeated headers
  if (repeatedHeaders.size === 0) {
    return paragraphs;
  }
  
  return paragraphs.filter(para => {
    const normalized = para.trim().toLowerCase().replace(/\s+/g, ' ');
    return !repeatedHeaders.has(normalized);
  });
}

/**
 * Full content filtering pipeline
 */
export function filterContent(
  text: string,
  options: ContentFilterOptions = DEFAULT_OPTIONS
): string {
  // Split into paragraphs
  let paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  // Remove running headers first (requires full scan)
  if (options.removeRunningHeaders) {
    paragraphs = removeRunningHeaders(paragraphs);
  }
  
  // Apply other filters
  const filteredParagraphs: string[] = [];
  let inReferencesSection = false;
  
  for (const para of paragraphs) {
    // Check for references section start
    if (options.removeReferences && isReferencesHeader(para)) {
      inReferencesSection = true;
      continue;
    }
    
    // Skip everything after references header
    if (inReferencesSection) {
      continue;
    }
    
    // Apply paragraph-level filters
    const filtered = filterParagraph(para, options);
    if (filtered !== null) {
      filteredParagraphs.push(para);
    }
  }
  
  return filteredParagraphs.join('\n\n');
}

export { DEFAULT_OPTIONS as defaultFilterOptions };
