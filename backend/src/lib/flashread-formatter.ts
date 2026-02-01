import { RenderedBlock } from './types';

// ============================================================
// Configuration
// ============================================================

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

const DEFAULT_FILTER_OPTIONS: ContentFilterOptions = {
  removePageMarkers: true,
  removePageNumbers: true,
  removeCaptions: true,
  removeFootnotes: true,
  removeReferences: true,
  removeRunningHeaders: true,
};

const COMMON_HEADINGS = [
  'abstract',
  'introduction',
  'methods',
  'methodology',
  'results',
  'discussion',
  'conclusion',
  'references',
  'background',
  'related work',
  'implementation',
  'evaluation',
  'future work',
  'acknowledgments',
  'acknowledgements',
  'summary',
  'overview',
];

// ============================================================
// Content Filter Patterns
// ============================================================

/** Page separator pattern: "--- Page 1 ---", "—— Page 12 ——", etc. */
const PAGE_SEPARATOR_PATTERN = /^[-—–]{2,}\s*Page\s+\d+\s*[-—–]{2,}$/i;

/** Standalone page numbers */
const PAGE_NUMBER_PATTERNS = [
  /^Page\s+\d{1,4}$/i,                    // "Page 1", "Page 123"
  /^-\s*\d{1,4}\s*-$/,                    // "- 1 -", "-23-"
  /^\(\s*\d{1,4}\s*\)$/,                  // "(1)", "( 23 )"
  /^\[\s*\d{1,4}\s*\]$/,                  // "[1]", "[ 23 ]"
  /^\d{1,3}$/,                            // "1", "23", "123" (short numbers only)
];

/** Figure/table caption patterns */
const CAPTION_PATTERNS = [
  /^Figure\s+\d+[.:]/i,
  /^Fig\.\s*\d+[.:]/i,
  /^Table\s+\d+[.:]/i,
  /^Tbl\.\s*\d+[.:]/i,
  /^Chart\s+\d+[.:]/i,
  /^Graph\s+\d+[.:]/i,
  /^Exhibit\s+\d+[.:]/i,
  /^Plate\s+\d+[.:]/i,
  /^Diagram\s+\d+[.:]/i,
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

/** Footnote patterns */
const FOOTNOTE_PATTERNS = [
  /^[¹²³⁴⁵⁶⁷⁸⁹⁰]+\s+\S/,
  /^\[\d{1,2}\]\s+\S/,
  /^†\s+\S/,
  /^‡\s+\S/,
  /^§\s+\S/,
  /^\*\s+\S/,
];

// ============================================================
// Filter Functions
// ============================================================

function isPageMarker(text: string): boolean {
  return PAGE_SEPARATOR_PATTERN.test(text.trim());
}

function isPageNumber(text: string): boolean {
  const trimmed = text.trim();
  return PAGE_NUMBER_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isCaption(text: string): boolean {
  const trimmed = text.trim();
  return CAPTION_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isFootnote(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 500) return false;
  return FOOTNOTE_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isReferencesHeader(text: string): boolean {
  const trimmed = text.trim();
  return REFERENCES_HEADER_PATTERNS.some(pattern => pattern.test(trimmed));
}

function shouldFilterParagraph(
  text: string,
  options: ContentFilterOptions
): boolean {
  const trimmed = text.trim();
  
  if (!trimmed) return true;
  
  if (options.removePageMarkers && isPageMarker(trimmed)) {
    return true;
  }
  
  if (options.removePageNumbers && trimmed.length < 15 && isPageNumber(trimmed)) {
    return true;
  }
  
  if (options.removeCaptions && isCaption(trimmed)) {
    return true;
  }
  
  if (options.removeFootnotes && isFootnote(trimmed)) {
    return true;
  }
  
  return false;
}

function removeRunningHeaders(
  paragraphs: string[],
  minOccurrences: number = 3
): string[] {
  const counts = new Map<string, number>();
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 100 && trimmed.length > 0) {
      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  
  const repeatedHeaders = new Set<string>();
  for (const [normalized, count] of counts) {
    if (count >= minOccurrences) {
      repeatedHeaders.add(normalized);
    }
  }
  
  if (repeatedHeaders.size === 0) {
    return paragraphs;
  }
  
  return paragraphs.filter(para => {
    const normalized = para.trim().toLowerCase().replace(/\s+/g, ' ');
    return !repeatedHeaders.has(normalized);
  });
}

// ============================================================
// Main Functions
// ============================================================

export interface FormatOptions {
  /** Enable content filtering (default: true) */
  filterContent?: boolean;
  /** Content filter options */
  filterOptions?: ContentFilterOptions;
}

export function formatTextToBlocks(
  text: string,
  options: FormatOptions = {}
): RenderedBlock[] {
  const blocks: RenderedBlock[] = [];
  const shouldFilter = options.filterContent !== false;
  const filterOptions = { ...DEFAULT_FILTER_OPTIONS, ...options.filterOptions };
  
  // Split by blank lines (paragraphs)
  let paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Apply running header removal first (requires full scan)
  if (shouldFilter && filterOptions.removeRunningHeaders) {
    paragraphs = removeRunningHeaders(paragraphs);
  }

  let inReferencesSection = false;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    
    // Content filtering
    if (shouldFilter) {
      // Check for references section start
      if (filterOptions.removeReferences && isReferencesHeader(trimmed)) {
        inReferencesSection = true;
        continue;
      }
      
      // Skip everything after references header
      if (inReferencesSection) {
        continue;
      }
      
      // Apply paragraph-level filters
      if (shouldFilterParagraph(trimmed, filterOptions)) {
        continue;
      }
    }
    
    // Check if it's a heading
    if (isHeading(trimmed)) {
      blocks.push({
        type: 'heading',
        text: trimmed,
      });
    } else {
      // Regular paragraph
      blocks.push({
        type: 'p',
        text: trimmed,
      });
    }
  }

  return blocks;
}

/**
 * Format text to blocks without any content filtering.
 * Use this when you need the raw content.
 */
export function formatTextToBlocksUnfiltered(text: string): RenderedBlock[] {
  return formatTextToBlocks(text, { filterContent: false });
}

function isHeading(text: string): boolean {
  // Remove common punctuation for checking
  const cleaned = text.replace(/[:.]/g, '').trim();
  
  // Check if ALL CAPS (at least 3 characters)
  if (cleaned.length >= 3 && cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) {
    return true;
  }
  
  // Check if ends with colon
  if (text.endsWith(':')) {
    return true;
  }
  
  // Check if matches common section headings
  const lower = cleaned.toLowerCase();
  if (COMMON_HEADINGS.includes(lower)) {
    return true;
  }
  
  // Check if it's a short line (likely a heading)
  // Headings are typically < 60 characters and single line
  if (text.length < 60 && !text.includes('\n')) {
    // Check if it starts with a number (e.g., "1. Introduction")
    if (/^\d+\.?\s+[A-Z]/.test(text)) {
      return true;
    }
    
    // Check if it's title case (most words capitalized)
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
    if (words.length > 1 && capitalizedWords.length / words.length > 0.6) {
      return true;
    }
  }
  
  return false;
}
