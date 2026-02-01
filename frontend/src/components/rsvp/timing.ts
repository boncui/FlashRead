/**
 * RSVP Timing Utilities
 * 
 * Handles the timing calculations for RSVP word display,
 * including punctuation-aware pauses and configurable multipliers.
 */

import type { RsvpToken } from './rsvpTokenizer';

export interface RsvpTimingConfig {
  /** Base words per minute */
  wpm: number;
  
  // Granular punctuation multipliers (each serves a different linguistic function)
  /** Multiplier for comma - brief clause pause (default 1.2) */
  commaMultiplier: number;
  /** Multiplier for semicolon - connects related independent clauses (default 1.5) */
  semicolonMultiplier: number;
  /** Multiplier for colon - anticipatory pause before list/explanation (default 1.0) */
  colonMultiplier: number;
  /** Multiplier for period - full stop, cognitive reset (default 2.2) */
  periodMultiplier: number;
  /** Multiplier for question mark - extra time for comprehension (default 2.5) */
  questionMultiplier: number;
  /** Multiplier for exclamation - emphasis pause (default 2.0) */
  exclamationMultiplier: number;
  
  /** Multiplier for paragraph breaks (added to base interval) - cognitive reset */
  paragraphMultiplier: number;
  /** Reduction multiplier for short words (subtracts from interval) */
  shortWordMultiplier: number;
  /** Whether to apply short word timing reduction */
  enableShortWordBoost: boolean;
  /** Whether to apply word length-based timing adjustment */
  enableWordLengthTiming: boolean;
  /** Whether to apply ease-in for first few words */
  enableEaseIn: boolean;
  /** Whether to apply ease-in at start of each paragraph */
  enableParagraphEaseIn: boolean;
  /** WPM reduction at paragraph start (default 75, typically 50-100) */
  paragraphEaseInWpmDrop: number;
  /** Number of words to ramp back up over (default 5) */
  paragraphEaseInWords: number;
  
  // Phrase rhythm options
  /** Multiplier for phrase boundaries without punctuation (default 0.3) */
  phraseBoundaryMultiplier: number;
  /** Enable gradual slowdown after 5+ words without pause (default true) */
  enableLongRunRelief: boolean;
  /** Max words before forced micro-pause considered (default 7) */
  maxWordsWithoutPause: number;
  
  // Speed transition options
  /** Duration of WPM change ramp in milliseconds (default 500) */
  wpmRampDuration: number;
  /** Enable smooth WPM transitions (default true) */
  enableSmoothWpmRamp: boolean;
  
  // === NEW CADENCE MODEL OPTIONS ===
  
  /** Use syllable estimation instead of character count for length timing (default true) */
  enableSyllableWeight: boolean;
  /** Apply prosody factors (breath groups, parentheticals, quotes) (default true) */
  enableProsodyFactor: boolean;
  /** Apply word complexity factors (frequency, morphology) (default true) */
  enableComplexityFactor: boolean;
  /** Domain mode for specialized content types */
  domainMode: 'prose' | 'technical' | 'math' | 'code';
  /** Words in a breath group before relief factor kicks in (default 8) */
  breathGroupThreshold: number;
  /** Enable dense content relief micro-rests (default true) */
  enableDenseContentRelief: boolean;
  /** Seconds of continuous reading before inserting micro-rest (default 12) */
  denseContentReliefInterval: number;
  /** Minimum duration multiplier floor (default 0.4) */
  minDurationFloor: number;
  /** Maximum duration multiplier cap (default 4.0) */
  maxDurationCap: number;
  
  // === ADAPTIVE FLOW TIMING ===
  
  /** Enable adaptive pacing where WPM becomes target average (default false for gradual rollout) */
  enableAdaptivePacing: boolean;
  /** Maximum variance from target WPM as fraction (default 0.20 = ±20%) */
  targetWpmVariance: number;
  /** Number of words to track for rolling average (default 25) */
  averageWindowSize: number;
  
  /** Enable momentum building on easy word sequences (default true) */
  enableMomentum: boolean;
  /** Number of easy words before momentum kicks in (default 3) */
  momentumBuildThreshold: number;
  /** Maximum speed boost from momentum as fraction (default 0.15 = 15% faster) */
  momentumMaxBoost: number;
  /** How fast momentum decays on complex words (default 0.5 = 50% decay) */
  momentumDecayRate: number;
}

/**
 * Domain mode type for content-aware timing
 */
export type DomainMode = 'prose' | 'technical' | 'math' | 'code';

/**
 * State for smooth WPM transitions
 */
export interface WpmRampState {
  /** Target WPM we're ramping to */
  targetWpm: number;
  /** WPM we started ramping from */
  startWpm: number;
  /** Timestamp when ramp started */
  rampStartTime: number;
  /** Duration of the ramp in ms */
  rampDuration: number;
}

/**
 * Flow state for adaptive timing - tracks momentum and rolling average
 */
export interface FlowState {
  // Momentum tracking
  /** Number of consecutive easy words encountered */
  consecutiveEasyWords: number;
  /** Current momentum multiplier (1.0 = neutral, 0.85 = 15% faster) */
  currentMomentum: number;
  
  // Average correction tracking
  /** Sliding window of recent actual durations (ms) */
  recentDurations: number[];
  /** Sliding window of recent target base durations (ms) */
  recentTargetDurations: number[];
  /** Current average deviation from target (positive = too slow, negative = too fast) */
  averageDeviation: number;
}

/**
 * Research-backed timing configuration with granular punctuation control.
 * 
 * At 300 WPM, base interval = 200ms
 * 
 * Punctuation timing (based on TTS research and linguistic function):
 * - Colon:       +200ms (1.0x) = 400ms - anticipatory, expects more
 * - Comma:       +240ms (1.2x) = 440ms - brief clause pause
 * - Semicolon:   +300ms (1.5x) = 500ms - connects independent clauses
 * - Exclamation: +400ms (2.0x) = 600ms - emphasis processing
 * - Period:      +440ms (2.2x) = 640ms - cognitive reset
 * - Question:    +500ms (2.5x) = 700ms - comprehension time
 * - Paragraph:   +500ms (2.5x) = 700ms - full context switch
 * 
 * Phrase rhythm (music theory inspired):
 * - Phrase boundary: +30% at natural breaks (conjunctions, transitions)
 * - Long-run relief: gradual slowdown after 5+ words without pause
 */
export const DEFAULT_TIMING_CONFIG: RsvpTimingConfig = {
  wpm: 300,
  
  // Granular punctuation multipliers
  commaMultiplier: 1.2,       // Brief clause pause
  semicolonMultiplier: 1.5,   // Connects related independent clauses
  colonMultiplier: 1.0,       // Anticipatory pause (shorter - reader expects more)
  periodMultiplier: 2.2,      // Full stop, cognitive reset
  questionMultiplier: 2.5,    // Extra time for question comprehension
  exclamationMultiplier: 2.0, // Emphasis pause
  
  // Paragraph cognitive reset pause
  paragraphMultiplier: 2.5,
  
  // Short word reduction (common words like "the", "a", "is")
  shortWordMultiplier: 0.15,
  // Enable short word timing by default (research-backed)
  enableShortWordBoost: true,
  // Enable word length adjustment by default
  enableWordLengthTiming: true,
  // Enable ease-in for smoother session start
  enableEaseIn: true,
  // Enable paragraph ease-in for smoother paragraph transitions
  enableParagraphEaseIn: true,
  // WPM reduction at paragraph start (middle of 50-100 range)
  paragraphEaseInWpmDrop: 75,
  // Ramp back up over 5 words
  paragraphEaseInWords: 5,
  
  // Phrase rhythm options
  phraseBoundaryMultiplier: 0.3,  // +30% pause at phrase boundaries
  enableLongRunRelief: true,      // Gradual slowdown for long runs
  maxWordsWithoutPause: 7,        // Max words before considering forced pause
  
  // Speed transition options
  wpmRampDuration: 500,           // 500ms ramp for WPM changes
  enableSmoothWpmRamp: true,      // Smooth WPM transitions enabled
  
  // Cadence model options
  enableSyllableWeight: true,     // Use syllables instead of chars
  enableProsodyFactor: true,      // Apply breath group/prosody factors
  enableComplexityFactor: true,   // Apply word complexity factors
  domainMode: 'prose',            // Default to prose mode
  breathGroupThreshold: 8,        // Words before breath relief
  enableDenseContentRelief: true, // Enable micro-rests for dense content
  denseContentReliefInterval: 12, // Seconds before micro-rest
  minDurationFloor: 0.4,          // Min 40% of base interval
  maxDurationCap: 4.0,            // Max 4x base interval
  
  // Adaptive flow timing options
  enableAdaptivePacing: false,    // Disabled by default for gradual rollout
  targetWpmVariance: 0.20,        // ±20% variance from target WPM
  averageWindowSize: 25,          // Track 25 words for rolling average
  enableMomentum: true,           // Enable momentum building
  momentumBuildThreshold: 3,      // 3 easy words before momentum kicks in
  momentumMaxBoost: 0.15,         // Max 15% speed boost
  momentumDecayRate: 0.5,         // 50% momentum decay on complex words
};

/**
 * Calculate the base interval in milliseconds for a given WPM.
 */
export function getBaseInterval(wpm: number): number {
  return 60_000 / wpm;
}

/**
 * Extract the word length from a token, stripping punctuation.
 * Used for word length-based timing calculations.
 */
function extractWordLength(text: string): number {
  // Strip leading/trailing punctuation and quotes
  const stripped = text
    .replace(/^[""''„«»‹›\[\](){}⟨⟩<>'"—–\-…·•]+/, '')
    .replace(/[""''„«»‹›\[\](){}⟨⟩<>'"—–\-…·•.,!?;:]+$/, '');
  return stripped.length;
}

/**
 * Calculate word length multiplier based on character count.
 * 
 * Research shows longer words need proportionally more time:
 * - Very short words (1-2 chars): recognized near-instantly (-15%)
 * - Normal words (3-4 chars): baseline (1.0x)
 * - Longer words: +10% per character above 4, capped at 1.6x
 * 
 * @param token - The token to calculate multiplier for
 * @returns Multiplier (0.85 to 1.6)
 */
export function getWordLengthMultiplier(token: RsvpToken): number {
  const wordLength = extractWordLength(token.text);
  
  // Very short words (1-2 chars): reduce time
  if (wordLength <= 2) return 0.85;
  
  // Normal length words (3-4 chars): baseline
  if (wordLength <= 4) return 1.0;
  
  // Longer words: gradual increase, capped at 1.6x
  // Each char above 4 adds 10% more time
  return Math.min(1.6, 1 + (wordLength - 4) * 0.10);
}

/**
 * Calculate ease-in multiplier for session start.
 * 
 * First 3-5 words display slightly slower to let reader "settle in"
 * and establish the reading rhythm before reaching full speed.
 * 
 * @param tokenIndex - The index of the current token (0-based)
 * @returns Multiplier (1.0 to 1.5)
 */
export function getEaseInMultiplier(tokenIndex: number): number {
  switch (tokenIndex) {
    case 0: return 1.5;   // First word: 50% slower
    case 1: return 1.3;   // Second word: 30% slower
    case 2: return 1.15;  // Third word: 15% slower
    case 3: return 1.05;  // Fourth word: 5% slower
    default: return 1.0;  // Full speed after 4 words
  }
}

/**
 * Calculate paragraph ease-in multiplier for smoother paragraph transitions.
 * 
 * At the start of each new paragraph, the reading speed is temporarily reduced
 * to help the reader "settle in" to the new context, then gradually ramps back
 * up to the target WPM over several words.
 * 
 * @param paragraphIndex - Position within the current paragraph (0-based)
 * @param wpm - Current WPM setting
 * @param wpmDrop - How much to reduce WPM at paragraph start (typically 50-100)
 * @param rampWords - Number of words to ramp back up over
 * @returns Multiplier (1.0 to ~1.5 depending on WPM and drop)
 */
export function getParagraphEaseInMultiplier(
  paragraphIndex: number,
  wpm: number,
  wpmDrop: number,
  rampWords: number
): number {
  // No adjustment needed after ramp period
  if (paragraphIndex >= rampWords) return 1.0;
  
  // Calculate multiplier for target reduced WPM
  // multiplier = wpm / (wpm - wpmDrop)
  // Clamp denominator to minimum of 50 WPM for safety
  const effectiveTargetWpm = Math.max(wpm - wpmDrop, 50);
  const fullDropMultiplier = wpm / effectiveTargetWpm;
  
  // Linear ramp: 100% drop at index 0, 0% at rampWords
  const rampFactor = 1 - (paragraphIndex / rampWords);
  
  // Apply ramp to the drop (1.0 + scaled portion of the drop)
  return 1 + (fullDropMultiplier - 1) * rampFactor;
}

/**
 * Calculate the display duration for a specific token using the new cadence model.
 * 
 * New formula:
 * duration = baseInterval * length_factor * prosody_factor * complexity_factor * domain_factor + boundary_pause
 * 
 * @param token - The token to calculate duration for
 * @param config - Timing configuration
 * @returns Duration in milliseconds
 */
function getTokenDurationCadenceModel(token: RsvpToken, config: RsvpTimingConfig): number {
  const baseInterval = getBaseInterval(config.wpm);
  
  // Paragraph breaks use simple multiplier
  if (token.isParagraphBreak) {
    return getBoundaryPause('paragraph', baseInterval, config.maxDurationCap);
  }
  
  // Start with base factor of 1
  let factor = 1.0;
  
  // 1. Length factor (syllable-based)
  if (config.enableSyllableWeight && token.estimatedSyllables > 0) {
    factor *= getLengthFactor(token.estimatedSyllables);
  } else if (config.enableWordLengthTiming) {
    // Fallback to character-based
    factor *= getWordLengthMultiplier(token);
  }
  
  // 2. Prosody factor
  if (config.enableProsodyFactor) {
    factor *= getProsodyFactor(token, token.wordsSinceLastPause, config.breathGroupThreshold);
  }
  
  // 3. Complexity factor
  if (config.enableComplexityFactor) {
    factor *= getComplexityFactor(token);
  }
  
  // 4. Domain factor
  factor *= getDomainFactor(token, config.domainMode);
  
  // Apply floor and cap
  factor = Math.max(config.minDurationFloor, Math.min(factor, config.maxDurationCap));
  
  // Calculate base duration
  let duration = baseInterval * factor;
  
  // 5. Add boundary pause
  const boundaryPause = getBoundaryPause(token.boundaryType, baseInterval, config.maxDurationCap);
  duration += boundaryPause;
  
  return duration;
}

/**
 * Calculate the display duration for a specific token.
 * 
 * Uses the new cadence model when syllable weighting is enabled,
 * otherwise falls back to the classic multiplier-based system.
 * 
 * Classic model combines:
 * 1. Base interval from WPM
 * 2. Word length adjustment (longer words = more time)
 * 3. Short word boost (common short words = less time)
 * 4. Granular punctuation pauses (comma, semicolon, colon, period, question, exclamation)
 * 5. Phrase boundary pauses (natural breaks at conjunctions/transitions)
 * 6. Long-run relief (gradual slowdown after 5+ words without pause)
 * 7. Ease-in for session start (first few words slower)
 * 8. Paragraph ease-in (first few words of each paragraph slower)
 * 
 * @param token - The token to calculate duration for
 * @param config - Timing configuration
 * @param tokenIndex - Optional index for ease-in calculation (defaults to token.index)
 * @returns Duration in milliseconds
 */
export function getTokenDuration(
  token: RsvpToken, 
  config: RsvpTimingConfig,
  tokenIndex?: number
): number {
  // Use new cadence model when syllable weighting is enabled
  // and token has the new fields
  if (config.enableSyllableWeight && 'estimatedSyllables' in token && token.estimatedSyllables > 0) {
    const baseDuration = getTokenDurationCadenceModel(token, config);
    
    // Still apply ease-in multipliers on top
    const index = tokenIndex ?? token.index;
    let easeInFactor = 1.0;
    
    if (config.enableEaseIn) {
      easeInFactor *= getEaseInMultiplier(index);
    }
    
    if (config.enableParagraphEaseIn && token.paragraphIndex >= 0 && token.paragraphIndex < config.paragraphEaseInWords) {
      easeInFactor *= getParagraphEaseInMultiplier(
        token.paragraphIndex,
        config.wpm,
        config.paragraphEaseInWpmDrop,
        config.paragraphEaseInWords
      );
    }
    
    return baseDuration * easeInFactor;
  }
  
  // Fallback to classic multiplier-based timing
  return getTokenDurationClassic(token, config, tokenIndex);
}

/**
 * Classic multiplier-based timing calculation.
 * Used as fallback when new cadence model fields are not available.
 */
function getTokenDurationClassic(
  token: RsvpToken, 
  config: RsvpTimingConfig,
  tokenIndex?: number
): number {
  const baseInterval = getBaseInterval(config.wpm);
  const index = tokenIndex ?? token.index;
  
  // Paragraph breaks get their own timing (no other multipliers apply)
  if (token.isParagraphBreak) {
    return baseInterval * (1 + config.paragraphMultiplier);
  }
  
  // Start with base multiplier of 1
  let multiplier = 1;
  
  // 1. Word length adjustment (longer words need more time)
  if (config.enableWordLengthTiming) {
    const lengthMultiplier = getWordLengthMultiplier(token);
    // Apply as a scaling factor centered around 1.0
    multiplier *= lengthMultiplier;
  }
  
  // 2. Short word boost (reduces time for common short words)
  // Only applies if word length timing didn't already reduce it
  if (config.enableShortWordBoost && token.isShortWord) {
    // Don't double-reduce if word length already reduced
    const lengthMultiplier = config.enableWordLengthTiming ? getWordLengthMultiplier(token) : 1;
    if (lengthMultiplier >= 1) {
      multiplier -= config.shortWordMultiplier;
    }
  }
  
  // 3. Punctuation pauses (granular - each punctuation type has its own timing)
  switch (token.endPunctuation) {
    case 'comma':
      multiplier += config.commaMultiplier;
      break;
    case 'semicolon':
      multiplier += config.semicolonMultiplier;
      break;
    case 'colon':
      multiplier += config.colonMultiplier;
      break;
    case 'period':
      multiplier += config.periodMultiplier;
      break;
    case 'question':
      multiplier += config.questionMultiplier;
      break;
    case 'exclamation':
      multiplier += config.exclamationMultiplier;
      break;
  }
  
  // 4. Phrase boundary pause (if no explicit punctuation but at natural break)
  if (config.phraseBoundaryMultiplier > 0 && token.isPhraseBoundary && token.endPunctuation === 'none') {
    multiplier += config.phraseBoundaryMultiplier;
  }
  
  // 5. Long-run relief (gradual slowdown after 5+ words without pause)
  if (config.enableLongRunRelief && token.wordsSinceLastPause > 5) {
    const relief = Math.min(0.25, (token.wordsSinceLastPause - 5) * 0.05);
    multiplier += relief;
  }
  
  // 6. Ease-in for session start (first few words slower)
  if (config.enableEaseIn) {
    const easeInMultiplier = getEaseInMultiplier(index);
    multiplier *= easeInMultiplier;
  }
  
  // 7. Paragraph ease-in (first few words of each paragraph slower)
  if (config.enableParagraphEaseIn && token.paragraphIndex >= 0 && token.paragraphIndex < config.paragraphEaseInWords) {
    const paragraphEaseIn = getParagraphEaseInMultiplier(
      token.paragraphIndex,
      config.wpm,
      config.paragraphEaseInWpmDrop,
      config.paragraphEaseInWords
    );
    multiplier *= paragraphEaseIn;
  }
  
  // Ensure we never go below 0.5x (safety floor)
  multiplier = Math.max(0.5, multiplier);
  
  return baseInterval * multiplier;
}

/**
 * Calculate estimated reading time for all tokens.
 * 
 * @param tokens - Array of tokens
 * @param config - Timing configuration
 * @returns Total duration in milliseconds
 */
export function getEstimatedDuration(tokens: RsvpToken[], config: RsvpTimingConfig): number {
  return tokens.reduce((total, token) => total + getTokenDuration(token, config), 0);
}

/**
 * Format duration as human-readable string.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

// ==================== CADENCE MODEL FACTORS ====================

/**
 * Syllable-based length factor lookup table.
 * Maps syllable count to timing multiplier.
 * 
 * 1 syllable: 0.85 (faster - instant recognition)
 * 2 syllables: 0.95 (slightly faster)
 * 3 syllables: 1.0 (baseline)
 * 4 syllables: 1.12
 * 5 syllables: 1.25
 * 6+ syllables: 1.4-1.55
 */
const SYLLABLE_LENGTH_FACTORS = [0.85, 0.85, 0.95, 1.0, 1.12, 1.25, 1.4, 1.55];

/**
 * Calculate length factor based on syllable count.
 * Uses syllables for more accurate timing than raw character count.
 * 
 * @param syllables - Estimated syllable count (1-6)
 * @returns Multiplier (0.85 - 1.55)
 */
export function getLengthFactor(syllables: number): number {
  const clamped = Math.min(Math.max(syllables, 1), 7);
  return SYLLABLE_LENGTH_FACTORS[clamped] || 1.0;
}

/**
 * Calculate prosody factor based on token context.
 * Accounts for breath groups, parentheticals, and quotes.
 * 
 * @param token - The token with prosody context
 * @param breathGroupLength - Words since last major pause
 * @param breathGroupThreshold - Threshold for breath relief
 * @returns Multiplier (1.0 - 1.35)
 */
export function getProsodyFactor(
  token: RsvpToken,
  breathGroupLength: number,
  breathGroupThreshold: number
): number {
  let factor = 1.0;
  
  // Breath group length relief (long clauses need a mental "inhale")
  if (breathGroupLength >= breathGroupThreshold) {
    const excess = breathGroupLength - breathGroupThreshold;
    factor *= 1.05 + Math.min(0.15, excess * 0.02);
  }
  
  // Parenthetical slowdown (asides need attention)
  if (token.hasOpeningPunctuation) {
    factor *= 1.08;
  }
  if (token.hasClosingPunctuation) {
    factor *= 1.05;
  }
  
  // Em-dash dramatic pause
  if (token.hasDash) {
    factor *= 1.10;
  }
  
  return Math.min(factor, 1.35); // Cap at 1.35
}

/**
 * Calculate complexity factor based on token properties.
 * Increases time for rare, long, or morphologically complex words.
 * 
 * @param token - The token with complexity data
 * @returns Multiplier (1.0 - 1.35)
 */
export function getComplexityFactor(token: RsvpToken): number {
  // Use pre-computed complexity score (0-1)
  // Map to multiplier range 1.0-1.35
  const complexity = token.tokenComplexity || 0;
  return 1.0 + (complexity * 0.35);
}

/**
 * Calculate domain factor based on content type.
 * Gives extra time for technical/math/code content.
 * 
 * @param token - The token with domain flags
 * @param mode - Current domain mode
 * @returns Multiplier (1.0 - 1.4)
 */
export function getDomainFactor(token: RsvpToken, mode: DomainMode): number {
  switch (mode) {
    case 'math':
      if (token.hasMathSymbols) return 1.4;
      if (token.isNumber) return 1.15;
      return 1.0;
      
    case 'code':
      if (token.isCodeLike) return 1.25;
      return 1.0;
      
    case 'technical':
      // Technical mode gives slight boost to numbers and citations
      if (token.isCitation) return 1.2;
      if (token.isNumber) return 1.1;
      if (token.tokenComplexity > 0.5) return 1.15;
      return 1.0;
      
    case 'prose':
    default:
      // Prose mode still handles citations specially
      if (token.isCitation) return 1.15;
      return 1.0;
  }
}

/**
 * Boundary pause multipliers based on boundary type.
 * Returns the pause as a fraction of baseInterval.
 */
const BOUNDARY_PAUSE_MULTIPLIERS: Record<string, number> = {
  none: 0,
  micro: 0.15,      // Phrase boundary without punctuation
  clause: 0.4,      // Comma
  sentence: 0.9,    // Period
  paragraph: 2.0,   // Paragraph break
  heading: 2.5,     // After heading
  listItem: 1.25,   // List item
  codeLine: 0.6,    // Code line
  mathChunk: 0.8,   // Math expression
};

/**
 * Calculate boundary pause duration.
 * 
 * @param boundaryType - Type of boundary
 * @param baseInterval - Base interval in ms
 * @param maxPause - Maximum pause cap (default 3x baseInterval)
 * @returns Pause duration in ms
 */
export function getBoundaryPause(
  boundaryType: string,
  baseInterval: number,
  maxPause: number = 3
): number {
  const multiplier = BOUNDARY_PAUSE_MULTIPLIERS[boundaryType] || 0;
  return Math.min(baseInterval * multiplier, baseInterval * maxPause);
}

// ==================== ADAPTIVE FLOW TIMING ====================

/**
 * Calculate momentum multiplier based on consecutive easy words.
 * Momentum reduces duration (speeds up reading) during easy sequences.
 * 
 * @param consecutiveEasyWords - Number of easy words in current streak
 * @param config - Timing configuration
 * @returns Multiplier (1.0 = neutral, 0.85 = 15% faster)
 */
export function calculateMomentumMultiplier(
  consecutiveEasyWords: number,
  config: RsvpTimingConfig
): number {
  if (!config.enableMomentum) {
    return 1.0;
  }
  
  // No momentum until threshold is met
  if (consecutiveEasyWords < config.momentumBuildThreshold) {
    return 1.0;
  }
  
  // Linear momentum build from threshold to max
  const excessWords = consecutiveEasyWords - config.momentumBuildThreshold;
  const momentumProgress = Math.min(1.0, excessWords / 5); // Ramp over 5 words
  const speedBoost = momentumProgress * config.momentumMaxBoost;
  
  // Return multiplier: 1.0 (no boost) down to (1.0 - maxBoost) (full boost)
  return 1.0 - speedBoost;
}

/**
 * Update flow state based on current token.
 * Handles momentum building, decay, and resetting.
 * 
 * @param flowState - Current flow state (mutated in place)
 * @param token - Current token
 * @param config - Timing configuration
 */
export function updateFlowMomentum(
  flowState: FlowState,
  token: RsvpToken,
  config: RsvpTimingConfig
): void {
  if (!config.enableMomentum) {
    flowState.consecutiveEasyWords = 0;
    flowState.currentMomentum = 1.0;
    return;
  }
  
  // Paragraph breaks reset momentum completely
  if (token.isParagraphBreak) {
    flowState.consecutiveEasyWords = 0;
    flowState.currentMomentum = 1.0;
    return;
  }
  
  // Easy word: build momentum
  if (token.isEasyWord) {
    flowState.consecutiveEasyWords++;
    flowState.currentMomentum = calculateMomentumMultiplier(
      flowState.consecutiveEasyWords,
      config
    );
  } else {
    // Complex word: decay momentum
    if (flowState.consecutiveEasyWords > 0) {
      // Apply decay rate
      flowState.consecutiveEasyWords = Math.floor(
        flowState.consecutiveEasyWords * (1 - config.momentumDecayRate)
      );
      flowState.currentMomentum = calculateMomentumMultiplier(
        flowState.consecutiveEasyWords,
        config
      );
    }
  }
  
  // Phrase boundaries also reset momentum (natural pause point)
  if (token.isPhraseBoundary || token.isSentenceEnd) {
    flowState.consecutiveEasyWords = 0;
    flowState.currentMomentum = 1.0;
  }
}

/**
 * Update rolling average tracker with a new duration.
 * Maintains a sliding window of recent durations for average correction.
 * 
 * @param flowState - Current flow state (mutated in place)
 * @param actualDuration - Actual duration used for this token (ms)
 * @param targetDuration - Target base duration before flow adjustments (ms)
 * @param config - Timing configuration
 */
export function updateRollingAverage(
  flowState: FlowState,
  actualDuration: number,
  targetDuration: number,
  config: RsvpTimingConfig
): void {
  // Add to sliding windows
  flowState.recentDurations.push(actualDuration);
  flowState.recentTargetDurations.push(targetDuration);
  
  // Keep window size limited
  const maxSize = config.averageWindowSize;
  if (flowState.recentDurations.length > maxSize) {
    flowState.recentDurations.shift();
    flowState.recentTargetDurations.shift();
  }
  
  // Calculate average deviation if we have enough samples (at least 5)
  if (flowState.recentDurations.length >= 5) {
    const totalActual = flowState.recentDurations.reduce((sum, d) => sum + d, 0);
    const totalTarget = flowState.recentTargetDurations.reduce((sum, d) => sum + d, 0);
    
    const avgActual = totalActual / flowState.recentDurations.length;
    const avgTarget = totalTarget / flowState.recentTargetDurations.length;
    
    // Deviation: positive means we're going slower than target, negative means faster
    flowState.averageDeviation = (avgActual - avgTarget) / avgTarget;
  } else {
    flowState.averageDeviation = 0;
  }
}

/**
 * Calculate average correction factor to drift toward target WPM.
 * Returns a multiplier to apply to duration: <1.0 speeds up, >1.0 slows down.
 * 
 * @param flowState - Current flow state
 * @param config - Timing configuration
 * @returns Correction multiplier (typically 0.95 - 1.05)
 */
export function calculateAverageCorrection(
  flowState: FlowState,
  config: RsvpTimingConfig
): number {
  if (!config.enableAdaptivePacing) {
    return 1.0;
  }
  
  // No correction if not enough samples yet
  if (flowState.recentDurations.length < 5) {
    return 1.0;
  }
  
  // Apply gentle correction: 2-5% adjustment based on deviation
  // If deviation is positive (too slow), multiply by <1.0 to speed up
  // If deviation is negative (too fast), multiply by >1.0 to slow down
  const correctionStrength = 0.1; // 10% of deviation is applied
  const correction = 1.0 - (flowState.averageDeviation * correctionStrength);
  
  // Clamp correction to prevent extreme changes (0.95 - 1.05 = ±5%)
  return Math.max(0.95, Math.min(1.05, correction));
}

/**
 * Calculate flow-adjusted duration for a token.
 * Applies momentum and average correction on top of base duration.
 * 
 * @param baseDuration - Base duration from cadence model (ms)
 * @param token - Current token
 * @param flowState - Current flow state (or null if disabled)
 * @param config - Timing configuration
 * @returns Adjusted duration (ms)
 */
export function getFlowAdjustedDuration(
  baseDuration: number,
  token: RsvpToken,
  flowState: FlowState | null,
  config: RsvpTimingConfig
): number {
  // If adaptive pacing disabled or no flow state, return base duration
  if (!config.enableAdaptivePacing || !flowState) {
    return baseDuration;
  }
  
  // Start with base duration
  let adjustedDuration = baseDuration;
  
  // Apply momentum multiplier (speeds up during easy sequences)
  if (config.enableMomentum) {
    adjustedDuration *= flowState.currentMomentum;
  }
  
  // Apply average correction factor (keeps overall average near target)
  const correctionFactor = calculateAverageCorrection(flowState, config);
  adjustedDuration *= correctionFactor;
  
  // Enforce variance bounds to prevent extreme deviations
  const baseInterval = getBaseInterval(config.wpm);
  const minDuration = baseInterval * (1 - config.targetWpmVariance);
  const maxDuration = baseInterval * (1 + config.targetWpmVariance) * 3; // Allow 3x for pauses
  adjustedDuration = Math.max(minDuration, Math.min(maxDuration, adjustedDuration));
  
  return adjustedDuration;
}

