/**
 * RSVP Tokenizer - Converts source text into tokens for RSVP display.
 * 
 * Features:
 * - Preserves punctuation attached to words
 * - Handles em-dashes, parentheses, smart quotes
 * - Tracks paragraph breaks for pause timing
 * - Normalizes whitespace
 * - Detects abbreviations to prevent false sentence pauses
 * - Handles numbers, citations, and special content types
 * - Estimates syllable count for timing
 * - Computes token complexity for adaptive timing
 */

import { COMMON_WORDS_5K, COMMON_WORDS_20K } from './wordFrequency';

/**
 * Boundary type classification for timing pauses
 */
export type BoundaryType = 
  | 'none'       // No boundary
  | 'micro'      // Phrase boundary without punctuation
  | 'clause'     // Clause boundary (comma, semicolon)
  | 'sentence'   // Sentence boundary (period, ?, !)
  | 'paragraph'  // Paragraph break
  | 'heading'    // Heading/title boundary
  | 'listItem'   // List item boundary
  | 'codeLine'   // Code line boundary
  | 'mathChunk'; // Math expression boundary

/**
 * Number type classification
 */
export type NumberType = 
  | 'decimal'    // 3.14, 3,000.50
  | 'range'      // 10-12, pp. 10-15
  | 'percent'    // 50%, 3.5%
  | 'currency'   // $19.99, €50
  | 'unit'       // 12kg, 37°C
  | 'citation'   // [12], (Smith, 2020)
  | 'plain';     // 123

export interface RsvpToken {
  /** The display text for this token */
  text: string;
  /** Whether this token represents a paragraph break */
  isParagraphBreak: boolean;
  /** Index of this token in the overall sequence */
  index: number;
  /** Punctuation type at end of token for timing adjustment */
  endPunctuation: 'none' | 'comma' | 'period' | 'question' | 'exclamation' | 'semicolon' | 'colon';
  /** Whether this is a "short" word (1-2 chars, common words) */
  isShortWord: boolean;
  /** Whether this token ends a sentence (for wrap-up timing) */
  isSentenceEnd: boolean;
  /** Whether this token ends a clause (comma before conjunction, etc.) */
  isClauseEnd: boolean;
  /** Word length without punctuation (for length-based timing) */
  wordLength: number;
  /** Index within the current paragraph (0-based, resets after each paragraph break) */
  paragraphIndex: number;
  /** Natural phrase boundary for micro-pause (before conjunctions/transitions) */
  isPhraseBoundary: boolean;
  /** Words since last pause (punctuation, phrase boundary, or paragraph start) */
  wordsSinceLastPause: number;
  
  // === NEW CADENCE MODEL FIELDS ===
  
  /** Boundary type classification for timing pauses */
  boundaryType: BoundaryType;
  /** Token complexity score (0.0 - 1.0) for adaptive timing */
  tokenComplexity: number;
  /** Estimated syllable count for length-based timing */
  estimatedSyllables: number;
  /** Whether this is an abbreviation (Dr., U.S., etc.) */
  isAbbreviation: boolean;
  /** Whether this token is a number */
  isNumber: boolean;
  /** Number type classification if isNumber is true */
  numberType: NumberType | null;
  /** Whether this is a citation [12], (Smith, 2020) */
  isCitation: boolean;
  /** Whether this looks like code (camelCase, snake_case, etc.) */
  isCodeLike: boolean;
  /** Whether this contains math symbols */
  hasMathSymbols: boolean;
  /** Whether this has opening punctuation ( [ " ' */
  hasOpeningPunctuation: boolean;
  /** Whether this has closing punctuation ) ] " ' */
  hasClosingPunctuation: boolean;
  /** Whether this contains a dash — – */
  hasDash: boolean;
  
  // === ADAPTIVE FLOW TIMING ===
  
  /** Whether this is an "easy" word for momentum building (common, short, simple) */
  isEasyWord: boolean;
}

/**
 * Mapping from a token back to its source position in the original blocks.
 * Used to highlight the current word in the full text panel and handle click-to-jump.
 */
export interface TokenSourceMapping {
  /** Index of the block this token came from (-1 for paragraph breaks) */
  blockIndex: number;
  /** Index of the word within the block's text (0-based) */
  wordIndexInBlock: number;
}

// Common short words that readers recognize instantly
const SHORT_WORDS = new Set([
  'a', 'i', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is',
  'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
  'am', 'are', 'the', 'and', 'but', 'for', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out',
]);

/**
 * Common abbreviations that should NOT trigger sentence-end pauses
 */
const COMMON_ABBREVIATIONS = new Set([
  // Titles
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'rev', 'hon', 'gen', 'col', 'lt', 'sgt',
  // Academic
  'phd', 'md', 'ba', 'bs', 'ma', 'mba', 'jd', 'esq', 'dds', 'rn',
  // Latin abbreviations
  'etc', 'eg', 'ie', 'vs', 'viz', 'cf', 'al', 'ca', 'et', 'nb', 'ps', 'ibid',
  // Geographic
  'st', 'ave', 'blvd', 'rd', 'apt', 'no', 'mt', 'ft',
  // Units (common ones that might have periods)
  'ft', 'in', 'lb', 'oz', 'hr', 'min', 'sec', 'yr', 'mo', 'wk',
  // Organizations
  'inc', 'corp', 'ltd', 'co', 'llc', 'plc',
  // Time
  'am', 'pm', 'ad', 'bc', 'ce', 'bce',
  // Other common
  'approx', 'dept', 'est', 'govt', 'misc', 'natl', 'orig', 'pp', 'vol', 'fig', 'ch', 'sec',
]);

// Pattern: Capital letters with periods (U.S., A.M., N.A.S.A.)
const INITIALISM_PATTERN = /^([A-Z]\.){2,}$/;

// Pattern: Mixed case initialisms (Ph.D., B.Sc., M.A.)
const MIXED_INITIALISM_PATTERN = /^[A-Z][a-z]?\.[A-Z]\.$/;

// Pattern: Single capital letter with period (J. Smith)
const SINGLE_INITIAL_PATTERN = /^[A-Z]\.$/;

// Pattern: Lowercase abbreviations with periods (e.g., i.e., etc.)
const LOWERCASE_ABBREV_WITH_PERIODS_PATTERN = /^[a-z]\.[a-z]\.$/i;

/**
 * Number detection patterns
 */
// Decimal numbers with decimal point: 3.14, 3,000.50, 1,234,567.89 (must have decimal)
const DECIMAL_PATTERN = /^\d+\.\d+$|^\d{1,3}(,\d{3})+(\.\d+)?$/;

// Ranges: 10-12, 10–12, pp. 10-15, 1990-2020
const RANGE_PATTERN = /^(pp\.\s*)?\d+[-–]\d+$/;

// Percentages: 50%, 3.5%, 100%
const PERCENT_PATTERN = /^\d+\.?\d*%$/;

// Currency: $19.99, €50, £100.00, ¥1000
const CURRENCY_PATTERN = /^[$€£¥₹]\d+([.,]\d+)?$/;

// Units: 12kg, 37°C, 100ml, 50GB, 2.5GHz
const UNIT_PATTERN = /^\d+\.?\d*(kg|g|mg|lb|oz|km|m|cm|mm|mi|ft|in|yd|°[CFKcfk]|ml|l|L|hz|khz|mhz|ghz|mb|gb|tb|kb|kB|MB|GB|TB|mph|kph|rpm|fps|bps|px|pt|em|rem|vw|vh)$/i;

// Citations: [12], [1-3], [Smith2020], [1,2,3]
const BRACKET_CITATION_PATTERN = /^\[\d+([-–,]\d+)*\]$|^\[[A-Za-z]+\d{4}[a-z]?\]$/;

// Parenthetical citations: (Smith, 2020), (Smith et al., 2020), (see Fig. 3)
const PAREN_CITATION_PATTERN = /^\([A-Z][a-z]+(\s+et\s+al\.?)?,?\s*\d{4}[a-z]?\)$|^\(see\s+(Fig|Table|Section|Chapter|Eq|Appendix)\.\s*\d+\)$/i;

// Time patterns: 3:00, 12:30, 9:45am
const TIME_PATTERN = /^\d{1,2}:\d{2}(:\d{2})?\s*(am|pm|AM|PM)?$/;

// Code-like patterns: camelCase, snake_case, SCREAMING_SNAKE, kebab-case, PascalCase
const CODE_LIKE_PATTERN = /^[a-z]+[A-Z][a-zA-Z]*$|^[a-z]+(_[a-z]+)+$|^[A-Z]+(_[A-Z]+)+$|^[A-Z][a-z]+([A-Z][a-z]+)+$/;

// Math symbols
const MATH_SYMBOLS_PATTERN = /[∑∏∫∂∇√∞±×÷≠≈≤≥∈∉⊂⊃∪∩∧∨¬∀∃αβγδεζηθικλμνξπρστυφχψω]/;

/**
 * Prefixes for morphological complexity detection
 */
const PREFIXES = ['un', 'pre', 'dis', 'mis', 'non', 'anti', 'over', 'under', 'semi', 'super', 're', 'de', 'ex', 'sub', 'inter', 'trans', 'counter', 'multi', 'poly'];

/**
 * Suffixes for morphological complexity detection
 */
const SUFFIXES = ['tion', 'sion', 'ness', 'ment', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'ly', 'ity', 'ism', 'ist', 'ize', 'ise', 'ify', 'ical', 'ology', 'ography'];

/**
 * Words that indicate a phrase boundary - the PREVIOUS token gets a pause.
 * Based on linguistic research on prosodic phrasing in speech.
 */
const PHRASE_BOUNDARY_WORDS = new Set([
  // Coordinating conjunctions (FANBOYS)
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  // Subordinating conjunctions
  'because', 'although', 'while', 'when', 'where', 'if', 'unless',
  'since', 'until', 'before', 'after', 'though', 'whereas', 'whenever',
  'wherever', 'whether', 'once', 'as',
  // Transition words (sentence adverbs)
  'however', 'therefore', 'moreover', 'furthermore', 'meanwhile',
  'consequently', 'nevertheless', 'otherwise', 'hence', 'thus',
  'instead', 'indeed', 'besides', 'accordingly', 'similarly',
  'likewise', 'nonetheless', 'regardless', 'finally', 'subsequently',
  // Relative pronouns (clause starters)
  'which', 'that', 'who', 'whom', 'whose',
  // Contrastive markers
  'then', 'still', 'also', 'even',
]);

/**
 * Check if a word (stripped of punctuation) is a phrase boundary word.
 */
function isPhraseBoundaryWord(text: string): boolean {
  const body = extractWordBodySimple(text).toLowerCase();
  return PHRASE_BOUNDARY_WORDS.has(body);
}

/**
 * Check if a token is an abbreviation that should NOT trigger sentence-end pause.
 * 
 * Examples: U.S., Dr., e.g., Ph.D., etc.
 */
export function isAbbreviation(token: string): boolean {
  // Strip trailing punctuation (comma, period) for checking
  const trimmed = token.trim().replace(/[,]$/, '');
  
  // Check for initialism pattern (U.S., A.M., N.A.S.A.)
  if (INITIALISM_PATTERN.test(trimmed)) return true;
  
  // Check for mixed-case initialisms (Ph.D., B.Sc.)
  if (MIXED_INITIALISM_PATTERN.test(trimmed)) return true;
  
  // Check for single initial (J. in "J. Smith")
  if (SINGLE_INITIAL_PATTERN.test(trimmed)) return true;
  
  // Check for lowercase abbreviations with periods (e.g., i.e.)
  if (LOWERCASE_ABBREV_WITH_PERIODS_PATTERN.test(trimmed)) return true;
  
  // Check for known abbreviations (remove trailing period for lookup)
  const cleaned = trimmed.replace(/\.$/, '').toLowerCase();
  if (COMMON_ABBREVIATIONS.has(cleaned)) return true;
  
  return false;
}

/**
 * Detect number type for special timing handling.
 * Returns null if not a number pattern.
 */
export function detectNumberType(token: string): NumberType | null {
  const trimmed = token.trim();
  
  // Check in order of specificity
  if (BRACKET_CITATION_PATTERN.test(trimmed) || PAREN_CITATION_PATTERN.test(trimmed)) {
    return 'citation';
  }
  if (CURRENCY_PATTERN.test(trimmed)) return 'currency';
  if (PERCENT_PATTERN.test(trimmed)) return 'percent';
  if (UNIT_PATTERN.test(trimmed)) return 'unit';
  if (RANGE_PATTERN.test(trimmed)) return 'range';
  if (DECIMAL_PATTERN.test(trimmed)) return 'decimal';
  if (/^\d+$/.test(trimmed)) return 'plain';
  
  return null;
}

/**
 * Estimate syllable count for a word using vowel-group heuristics.
 * 
 * More accurate than character count for timing since syllables correlate
 * with pronunciation time.
 * 
 * @param word - The word to estimate syllables for
 * @returns Estimated syllable count (1-6)
 */
export function estimateSyllables(word: string): number {
  // Clean the word: remove punctuation, lowercase
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  
  if (cleaned.length === 0) return 1;
  if (cleaned.length <= 3) return 1;
  
  // Count vowel groups (consecutive vowels = 1 syllable)
  const vowelGroups = cleaned.match(/[aeiouy]+/g) || [];
  let count = vowelGroups.length;
  
  // Adjustments for common patterns
  
  // Silent 'e' at end (but not 'le' which is often syllabic)
  if (cleaned.endsWith('e') && !cleaned.endsWith('le') && count > 1) {
    count--;
  }
  
  // Syllabic 'le' at end (e.g., "table", "apple")
  if (cleaned.endsWith('le') && cleaned.length > 2 && !/[aeiouy]/.test(cleaned[cleaned.length - 3])) {
    count++;
  }
  
  // Words ending in 'ed' often don't add syllable (unless preceded by t/d)
  if (cleaned.endsWith('ed') && cleaned.length > 2) {
    const beforeEd = cleaned[cleaned.length - 3];
    if (beforeEd !== 't' && beforeEd !== 'd') {
      count = Math.max(1, count - 1);
    }
  }
  
  // Words ending in 'es' often don't add syllable (unless preceded by s/x/z/ch/sh)
  if (cleaned.endsWith('es') && cleaned.length > 2) {
    const beforeEs = cleaned.slice(-4, -2);
    if (!/(ss|sh|ch|x|z|s)$/.test(cleaned.slice(0, -2))) {
      count = Math.max(1, count);
    }
  }
  
  // Ensure at least 1 syllable
  if (count === 0) count = 1;
  
  // Cap at 6 syllables (extremely long words)
  return Math.min(count, 6);
}

/**
 * Count morphological affixes in a word for complexity estimation.
 */
function countAffixes(word: string): number {
  const lower = word.toLowerCase();
  let count = 0;
  
  for (const prefix of PREFIXES) {
    if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
      count++;
      break; // Only count one prefix
    }
  }
  
  for (const suffix of SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
      count++;
      break; // Only count one suffix
    }
  }
  
  return count;
}

/**
 * Compute token complexity score (0.0 - 1.0) based on multiple heuristics.
 * Higher complexity = more display time needed.
 */
export function computeTokenComplexity(token: string): number {
  const cleaned = token.toLowerCase().replace(/[^a-z]/g, '');
  
  if (cleaned.length === 0) return 0;
  
  let score = 0;
  
  // Word frequency (0-0.4)
  if (!COMMON_WORDS_5K.has(cleaned)) {
    score += 0.25;
    if (!COMMON_WORDS_20K.has(cleaned)) {
      score += 0.15;
    }
  }
  
  // Morphological complexity (0-0.2)
  const affixes = countAffixes(cleaned);
  score += Math.min(0.2, affixes * 0.1);
  
  // Length complexity (0-0.15)
  if (cleaned.length > 10) {
    score += Math.min(0.15, (cleaned.length - 10) * 0.03);
  }
  
  // Capitalization patterns (original token)
  const isAllCaps = /^[A-Z]{3,}$/.test(token.replace(/[^A-Za-z]/g, ''));
  if (isAllCaps) score += 0.1;
  
  // Has digits mixed in
  if (/\d/.test(token)) score += 0.05;
  
  return Math.min(1.0, score);
}

/**
 * Check if token has opening punctuation/brackets.
 */
export function hasOpeningPunctuation(token: string): boolean {
  return /^[""''„«»‹›\[({⟨<]/.test(token);
}

/**
 * Check if token has closing punctuation/brackets.
 */
export function hasClosingPunctuation(token: string): boolean {
  return /[""''„«»‹›\])}⟩>]$/.test(token.replace(/[.,!?;:]$/, ''));
}

/**
 * Check if token contains em-dash or en-dash.
 */
export function hasDash(token: string): boolean {
  return /[—–]/.test(token);
}

/**
 * Check if token looks like code (camelCase, snake_case, etc.)
 */
export function isCodeLike(token: string): boolean {
  const cleaned = token.replace(/[^a-zA-Z0-9_]/g, '');
  return CODE_LIKE_PATTERN.test(cleaned) || /[_]/.test(cleaned);
}

/**
 * Check if token contains math symbols.
 */
export function hasMathSymbols(token: string): boolean {
  return MATH_SYMBOLS_PATTERN.test(token);
}

/**
 * Check if a token is "easy" for momentum building during flow timing.
 * Easy words are recognized quickly and can be sped up during momentum.
 * 
 * Criteria:
 * - In top 5K common words
 * - 1-2 syllables
 * - No punctuation (or only mild punctuation like comma)
 * - Not a number, citation, or code-like
 */
export function isEasyWord(token: string, syllables: number, complexity: number): boolean {
  const cleaned = token.toLowerCase().replace(/[^a-z]/g, '');
  
  // Must be in common word list
  if (!COMMON_WORDS_5K.has(cleaned)) {
    return false;
  }
  
  // Must be short (1-2 syllables)
  if (syllables > 2) {
    return false;
  }
  
  // Must not be complex (low complexity score)
  if (complexity > 0.3) {
    return false;
  }
  
  // Must not have heavy punctuation (period, question, exclamation are NOT easy)
  const hasPunctuation = /[.?!;:]$/.test(token.trim());
  if (hasPunctuation) {
    return false;
  }
  
  return true;
}

/**
 * Detect the punctuation type at the end of a token for timing purposes.
 * Now checks for abbreviations to avoid false sentence-end detection.
 */
function detectEndPunctuation(text: string, checkAbbreviation: boolean = true): RsvpToken['endPunctuation'] {
  if (!text) return 'none';
  
  const trimmed = text.trim();
  const lastChar = trimmed[trimmed.length - 1];
  
  switch (lastChar) {
    case '.':
    case '…':
      // Check if this is an abbreviation - if so, don't treat as sentence end
      if (checkAbbreviation && lastChar === '.' && isAbbreviation(trimmed)) {
        return 'none';
      }
      // Check if this is a decimal number
      if (checkAbbreviation && /^\d+\.\d+$/.test(trimmed)) {
        return 'none';
      }
      // Check if this is a time (3:00.)
      if (checkAbbreviation && TIME_PATTERN.test(trimmed.slice(0, -1))) {
        return 'none';
      }
      return 'period';
    case '?':
      return 'question';
    case '!':
      return 'exclamation';
    case ',':
      return 'comma';
    case ';':
      return 'semicolon';
    case ':':
      // Check if this is a time (3:00) - colon in middle of time shouldn't pause
      if (checkAbbreviation && TIME_PATTERN.test(trimmed)) {
        return 'none';
      }
      return 'colon';
    default:
      return 'none';
  }
}

/**
 * Extract the word body (without punctuation) for length checking.
 */
function extractWordBodySimple(text: string): string {
  return text.replace(/^[""''„«»‹›\[\](){}⟨⟩<>'"—–\-…·•]+/, '')
             .replace(/[""''„«»‹›\[\](){}⟨⟩<>'"—–\-…·•.,!?;:]+$/, '');
}

/**
 * Check if a token is a "short word" for timing adjustment.
 */
function isShortWord(text: string): boolean {
  const body = extractWordBodySimple(text).toLowerCase();
  return body.length <= 2 || SHORT_WORDS.has(body);
}

/**
 * Get the word length without punctuation (for timing calculations).
 */
function getWordLength(text: string): number {
  return extractWordBodySimple(text).length;
}

/**
 * Detect if a token ends a sentence.
 * Looks for period/question/exclamation marks, but also considers:
 * - Ellipsis (…) as sentence end
 * - Em-dash at end of clause can indicate a break
 * - Abbreviations are NOT sentence ends
 */
function detectSentenceEnd(text: string, endPunctuation: RsvpToken['endPunctuation']): boolean {
  // Standard sentence-ending punctuation (abbreviations already filtered in detectEndPunctuation)
  if (endPunctuation === 'period' || endPunctuation === 'question' || endPunctuation === 'exclamation') {
    return true;
  }
  
  // Check for em-dash at end (often indicates a dramatic pause/break)
  const trimmed = text.trim();
  if (trimmed.endsWith('—') || trimmed.endsWith('–')) {
    return true;
  }
  
  return false;
}

/**
 * Detect boundary type for a token based on punctuation and context.
 */
export function detectBoundaryType(
  token: { 
    endPunctuation: RsvpToken['endPunctuation']; 
    isPhraseBoundary: boolean;
    isParagraphBreak: boolean;
    hasDash: boolean;
  },
  blockType?: string
): BoundaryType {
  // Paragraph breaks
  if (token.isParagraphBreak) {
    return 'paragraph';
  }
  
  // Block type overrides
  if (blockType === 'heading' || blockType === 'h1' || blockType === 'h2' || blockType === 'h3') {
    return 'heading';
  }
  if (blockType === 'list' || blockType === 'listItem' || blockType === 'li') {
    return 'listItem';
  }
  if (blockType === 'code' || blockType === 'pre') {
    return 'codeLine';
  }
  if (blockType === 'math' || blockType === 'equation') {
    return 'mathChunk';
  }
  
  // Sentence-ending punctuation
  if (token.endPunctuation === 'period' || 
      token.endPunctuation === 'question' || 
      token.endPunctuation === 'exclamation') {
    return 'sentence';
  }
  
  // Clause boundaries
  if (token.endPunctuation === 'comma' || 
      token.endPunctuation === 'semicolon' ||
      token.endPunctuation === 'colon') {
    return 'clause';
  }
  
  // Dash creates a prosodic pause
  if (token.hasDash) {
    return 'clause';
  }
  
  // Phrase boundary without punctuation
  if (token.isPhraseBoundary) {
    return 'micro';
  }
  
  return 'none';
}

/**
 * Detect if a token ends a clause (for clause-boundary pauses).
 * Commas that indicate clause boundaries (not just list items) get extra pause.
 * 
 * Heuristics:
 * - Comma after a word of 4+ characters is likely a clause boundary
 * - Semicolon always indicates clause boundary
 * - Colon can indicate clause boundary
 */
function detectClauseEnd(
  text: string, 
  endPunctuation: RsvpToken['endPunctuation'],
  wordLength: number
): boolean {
  // Semicolon and colon are always clause boundaries
  if (endPunctuation === 'semicolon' || endPunctuation === 'colon') {
    return true;
  }
  
  // Comma after longer words is likely a clause boundary
  // (short words with commas are often list items: "a, b, c")
  if (endPunctuation === 'comma' && wordLength >= 4) {
    return true;
  }
  
  return false;
}

/**
 * Sanitize text by removing invisible/control characters that disrupt reading.
 * This handles OCR artifacts, encoding issues, and non-printable Unicode.
 * 
 * Note: Preserves curly quotes and em/en-dashes as the tokenizer handles them.
 */
function sanitizeText(text: string): string {
  return text
    // Rejoin words hyphenated across line breaks (OCR/PDF artifact)
    // "Katz-\nBassett" -> "Katz-Bassett"
    // Handles optional whitespace after hyphen before newline
    .replace(/-[ \t]*\n[ \t]*/g, '-')
    // Remove BOM and zero-width characters
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060\u180E]/g, '')
    // Remove control characters (except newlines/tabs for structure)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Remove replacement character (encoding errors)
    .replace(/\uFFFD/g, '')
    // Remove private use area (common OCR artifacts)
    .replace(/[\uE000-\uF8FF]/g, '')
    // Normalize exotic dashes to em-dash or hyphen (preserve em/en-dash for splitting)
    // U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash -> regular hyphen
    // U+2015 horizontal bar -> em-dash (similar to U+2014)
    .replace(/[\u2010\u2011\u2012]/g, '-')
    .replace(/\u2015/g, '—')
    // Remove soft hyphens (invisible line-break hints)
    .replace(/\u00AD/g, '');
}

/**
 * Normalize text by standardizing whitespace and handling special characters.
 */
function normalizeText(text: string): string {
  return text
    // Normalize various whitespace to single spaces
    .replace(/[\t\v\f\r ]+/g, ' ')
    // Preserve paragraph breaks (two or more newlines)
    .replace(/\n{2,}/g, '\n\n')
    // Single newlines become spaces
    .replace(/(?<!\n)\n(?!\n)/g, ' ')
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Split text on em-dashes and en-dashes to separate compound words.
 * "well—known" becomes ["well—", "known"]
 */
function splitOnDashes(token: string): string[] {
  // Match em-dash or en-dash that's between word characters
  const parts = token.split(/(?<=.)([—–])(?=.)/);
  
  if (parts.length === 1) return [token];
  
  // Reconstruct: attach dash to preceding part
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '—' || parts[i] === '–') {
      // Attach to previous if exists
      if (result.length > 0) {
        result[result.length - 1] += parts[i];
      } else {
        result.push(parts[i]);
      }
    } else if (parts[i]) {
      result.push(parts[i]);
    }
  }
  
  return result.filter(p => p.length > 0);
}

// Threshold for splitting long hyphenated words (e.g., "application-specific")
const HYPHEN_SPLIT_THRESHOLD = 10;

/**
 * Split long hyphenated compound words for better RSVP readability.
 * Only splits if the token length exceeds HYPHEN_SPLIT_THRESHOLD.
 * 
 * "application-specific" (20 chars) -> ["application-", "specific"]
 * "self-aware" (10 chars) -> ["self-aware"] (kept together)
 */
function splitOnHyphens(token: string): string[] {
  // Only split if token length exceeds threshold
  if (token.length <= HYPHEN_SPLIT_THRESHOLD) return [token];
  
  // Split on regular hyphens between word characters
  const parts = token.split(/(?<=\w)(-)(?=\w)/);
  
  if (parts.length === 1) return [token];
  
  // Reconstruct: attach hyphen to preceding part
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '-') {
      // Attach to previous if exists
      if (result.length > 0) {
        result[result.length - 1] += parts[i];
      } else {
        result.push(parts[i]);
      }
    } else if (parts[i]) {
      result.push(parts[i]);
    }
  }
  
  return result.filter(p => p.length > 0);
}

/**
 * Tokenize source text into RSVP tokens.
 * 
 * Includes phrase boundary detection and pause tracking for natural reading rhythm.
 * 
 * @param sourceText - The raw text to tokenize
 * @returns Array of RsvpToken objects
 */
export function tokenize(sourceText: string): RsvpToken[] {
  if (!sourceText || typeof sourceText !== 'string') {
    return [];
  }
  
  const sanitized = sanitizeText(sourceText);
  const normalized = normalizeText(sanitized);
  const tokens: RsvpToken[] = [];
  let index = 0;
  let paragraphIndex = 0; // Tracks position within current paragraph
  let wordsSinceLastPause = 0; // Tracks words since last pause point
  
  // Split by paragraph breaks first
  const paragraphs = normalized.split('\n\n');
  
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx].trim();
    
    if (!paragraph) continue;
    
    // Reset counters at start of each new paragraph
    paragraphIndex = 0;
    wordsSinceLastPause = 0;
    
    // Split paragraph into words
    const words = paragraph.split(/\s+/).filter(w => w.length > 0);
    
    // Pre-process to get all sub-tokens for look-ahead
    const allSubTokens: string[] = [];
    for (const word of words) {
      const dashSplitTokens = splitOnDashes(word);
      for (const dashToken of dashSplitTokens) {
        const hyphenSplitTokens = splitOnHyphens(dashToken);
        allSubTokens.push(...hyphenSplitTokens);
      }
    }
    
    for (let i = 0; i < allSubTokens.length; i++) {
      const subToken = allSubTokens[i];
      const endPunctuation = detectEndPunctuation(subToken);
      const wordLength = getWordLength(subToken);
      
      // Check if the NEXT token is a phrase boundary word
      // If so, mark THIS token as a phrase boundary (pause before the conjunction)
      const nextToken = allSubTokens[i + 1];
      const isBeforePhraseBoundary = nextToken ? isPhraseBoundaryWord(nextToken) : false;
      
      // Determine if this token causes a pause reset
      const hasPunctuationFlag = endPunctuation !== 'none';
      
      // Compute new cadence model fields
      const tokenIsAbbreviation = isAbbreviation(subToken);
      const numberType = detectNumberType(subToken);
      const tokenIsNumber = numberType !== null && numberType !== 'citation';
      const tokenIsCitation = numberType === 'citation' || 
                             BRACKET_CITATION_PATTERN.test(subToken) || 
                             PAREN_CITATION_PATTERN.test(subToken);
      const tokenIsCodeLike = isCodeLike(subToken);
      const tokenHasMathSymbols = hasMathSymbols(subToken);
      const tokenHasOpeningPunctuation = hasOpeningPunctuation(subToken);
      const tokenHasClosingPunctuation = hasClosingPunctuation(subToken);
      const tokenHasDash = hasDash(subToken);
      const syllables = estimateSyllables(subToken);
      const complexity = computeTokenComplexity(subToken);
      
      // Compute phrase boundary (only if no explicit punctuation)
      const isPhraseBoundaryToken = isBeforePhraseBoundary && !hasPunctuationFlag;
      
      // Compute boundary type
      const boundaryType = detectBoundaryType({
        endPunctuation,
        isPhraseBoundary: isPhraseBoundaryToken,
        isParagraphBreak: false,
        hasDash: tokenHasDash,
      });
      
      // Compute easy word flag for momentum (exclude numbers, citations, code)
      const tokenIsEasyWord = !tokenIsNumber && !tokenIsCitation && !tokenIsCodeLike && 
                              isEasyWord(subToken, syllables, complexity);
      
      tokens.push({
        text: subToken,
        isParagraphBreak: false,
        index,
        endPunctuation,
        isShortWord: isShortWord(subToken),
        isSentenceEnd: detectSentenceEnd(subToken, endPunctuation),
        isClauseEnd: detectClauseEnd(subToken, endPunctuation, wordLength),
        wordLength,
        paragraphIndex,
        isPhraseBoundary: isPhraseBoundaryToken,
        wordsSinceLastPause,
        // New cadence model fields
        boundaryType,
        tokenComplexity: complexity,
        estimatedSyllables: syllables,
        isAbbreviation: tokenIsAbbreviation,
        isNumber: tokenIsNumber,
        numberType,
        isCitation: tokenIsCitation,
        isCodeLike: tokenIsCodeLike,
        hasMathSymbols: tokenHasMathSymbols,
        hasOpeningPunctuation: tokenHasOpeningPunctuation,
        hasClosingPunctuation: tokenHasClosingPunctuation,
        hasDash: tokenHasDash,
        // Adaptive flow timing
        isEasyWord: tokenIsEasyWord,
      });
      
      index++;
      paragraphIndex++;
      
      // Reset wordsSinceLastPause after punctuation or phrase boundary
      if (hasPunctuationFlag || isBeforePhraseBoundary) {
        wordsSinceLastPause = 0;
      } else {
        wordsSinceLastPause++;
      }
    }
    
    // Add paragraph break marker after each paragraph (except the last)
    if (pIdx < paragraphs.length - 1) {
      tokens.push({
        text: '',
        isParagraphBreak: true,
        index,
        endPunctuation: 'none',
        isShortWord: false,
        isSentenceEnd: false,
        isClauseEnd: false,
        wordLength: 0,
        paragraphIndex: -1, // Paragraph breaks don't belong to any paragraph
        isPhraseBoundary: false,
        wordsSinceLastPause: 0,
        // New cadence model fields
        boundaryType: 'paragraph',
        tokenComplexity: 0,
        estimatedSyllables: 0,
        isAbbreviation: false,
        isNumber: false,
        numberType: null,
        isCitation: false,
        isCodeLike: false,
        hasMathSymbols: false,
        hasOpeningPunctuation: false,
        hasClosingPunctuation: false,
        hasDash: false,
        // Adaptive flow timing
        isEasyWord: false,
      });
      index++;
    }
  }
  
  return tokens;
}

/**
 * Convert RenderedBlock array to plain text for tokenization.
 */
export function blocksToText(blocks: Array<{ type: string; text: string }>): string {
  return blocks
    .map(block => block.text)
    .join('\n\n');
}

/**
 * Get total word count (excluding paragraph breaks).
 */
export function getWordCount(tokens: RsvpToken[]): number {
  return tokens.filter(t => !t.isParagraphBreak).length;
}

/**
 * Find the start of the paragraph containing the given token index.
 * Used when resuming reading to start from the beginning of the last paragraph
 * rather than mid-sentence.
 * 
 * @param tokens - Array of RSVP tokens
 * @param currentIndex - The token index to find the paragraph start for
 * @returns The index of the first token in the paragraph (after any paragraph break)
 */
export function findParagraphStart(tokens: RsvpToken[], currentIndex: number): number {
  if (!tokens.length || currentIndex <= 0) {
    return 0;
  }
  
  // Clamp to valid range
  const idx = Math.min(currentIndex, tokens.length - 1);
  
  // Walk backward to find the nearest paragraph break
  for (let i = idx - 1; i >= 0; i--) {
    if (tokens[i].isParagraphBreak) {
      // Return the index after the paragraph break
      return i + 1;
    }
  }
  
  // No paragraph break found - we're in the first paragraph
  return 0;
}

/**
 * Create a mapping from each token back to its source position in the original blocks.
 * This enables:
 * - Highlighting the current word in the full text panel
 * - Click-to-jump functionality from full text to RSVP position
 * 
 * The mapping replicates the tokenization logic to track which block and word
 * each token originated from.
 * 
 * @param blocks - The original blocks (same format as passed to blocksToText)
 * @returns Array of TokenSourceMapping, one per token (including paragraph breaks)
 */
export function createTokenBlockMapping(
  blocks: Array<{ type: string; text: string }>
): TokenSourceMapping[] {
  const mappings: TokenSourceMapping[] = [];
  
  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    // Apply same sanitization as tokenize() to ensure token indices align
    const sanitized = sanitizeText(block.text);
    const normalized = normalizeText(sanitized);
    const blockText = normalized.trim();
    
    if (!blockText) continue;
    
    // Split block into words (same logic as tokenize)
    const words = blockText.split(/\s+/).filter(w => w.length > 0);
    
    for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
      const word = words[wordIdx];
      
      // Handle em-dash splits (same as tokenize)
      const dashSplitTokens = splitOnDashes(word);
      
      for (const dashToken of dashSplitTokens) {
        // Handle hyphen splits for long words (same as tokenize)
        const hyphenSplitTokens = splitOnHyphens(dashToken);
        
        for (const _subToken of hyphenSplitTokens) {
          // Each sub-token maps back to the same block and word
          mappings.push({
            blockIndex: blockIdx,
            wordIndexInBlock: wordIdx,
          });
        }
      }
    }
    
    // Add paragraph break mapping after each block (except the last)
    if (blockIdx < blocks.length - 1) {
      mappings.push({
        blockIndex: -1,  // Paragraph breaks don't belong to any block
        wordIndexInBlock: -1,
      });
    }
  }
  
  return mappings;
}

/**
 * Build a reverse lookup: given a block index and word index, find the token index.
 * Returns -1 if not found.
 * 
 * @param mappings - The token-to-block mapping array
 * @param blockIndex - The block index to find
 * @param wordIndexInBlock - The word index within the block
 * @returns The token index, or -1 if not found
 */
export function findTokenIndexByBlockWord(
  mappings: TokenSourceMapping[],
  blockIndex: number,
  wordIndexInBlock: number
): number {
  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    if (m.blockIndex === blockIndex && m.wordIndexInBlock === wordIndexInBlock) {
      return i;
    }
  }
  return -1;
}
