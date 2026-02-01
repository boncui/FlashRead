/**
 * RSVP Timing Presets
 * 
 * Pre-configured timing profiles for different reading styles and content types.
 * Users can apply a preset as a starting point, then customize individual settings.
 */

import type { RsvpTimingConfig } from './timing';
import { DEFAULT_TIMING_CONFIG } from './timing';

/**
 * Preset identifier
 */
export type RsvpPresetId = 'factory' | 'casual' | 'speed' | 'technical' | 'comprehension';

/**
 * Preset definition
 */
export interface RsvpPreset {
  id: RsvpPresetId;
  name: string;
  description: string;
  /** Partial config - only the fields that differ from factory defaults */
  config: Partial<RsvpTimingConfig>;
}

/**
 * Factory defaults - the baseline timing configuration.
 * This is what DEFAULT_TIMING_CONFIG provides.
 */
export const FACTORY_PRESET: RsvpPreset = {
  id: 'factory',
  name: 'Factory',
  description: 'Balanced defaults for most content',
  config: {}, // Empty = use DEFAULT_TIMING_CONFIG as-is
};

/**
 * Casual Reader - slower pace with more pauses for relaxed reading.
 * Good for: leisurely reading, unfamiliar topics, complex prose
 */
export const CASUAL_PRESET: RsvpPreset = {
  id: 'casual',
  name: 'Casual',
  description: 'Slower pace with longer pauses',
  config: {
    wpm: 250,
    // +50% punctuation pauses
    commaMultiplier: 1.8,
    periodMultiplier: 3.3,
    questionMultiplier: 3.75,
    exclamationMultiplier: 3.0,
    paragraphMultiplier: 3.75,
    // More phrase pauses
    phraseBoundaryMultiplier: 0.45,
    // Momentum off for consistent pace
    enableMomentum: false,
  },
};

/**
 * Speed Reader - faster pace with minimal pauses.
 * Good for: skimming, familiar content, quick review
 */
export const SPEED_PRESET: RsvpPreset = {
  id: 'speed',
  name: 'Speed Reader',
  description: 'Fast pace with minimal pauses',
  config: {
    wpm: 450,
    // -50% punctuation pauses
    commaMultiplier: 0.6,
    periodMultiplier: 1.1,
    questionMultiplier: 1.25,
    exclamationMultiplier: 1.0,
    paragraphMultiplier: 1.25,
    // Minimal phrase pauses
    phraseBoundaryMultiplier: 0.15,
    // Max momentum for speed bursts on easy content
    enableMomentum: true,
    momentumMaxBoost: 0.25,
    momentumBuildThreshold: 2,
    // Less ease-in
    paragraphEaseInWpmDrop: 50,
    paragraphEaseInWords: 3,
  },
};

/**
 * Technical - extra time for complex content.
 * Good for: academic papers, technical docs, code explanations
 */
export const TECHNICAL_PRESET: RsvpPreset = {
  id: 'technical',
  name: 'Technical',
  description: 'Extra time for complex content',
  config: {
    wpm: 275,
    // +25% punctuation pauses
    commaMultiplier: 1.5,
    periodMultiplier: 2.75,
    questionMultiplier: 3.125,
    exclamationMultiplier: 2.5,
    paragraphMultiplier: 3.125,
    // Technical domain mode for specialized handling
    domainMode: 'technical',
    // More complexity factor weight
    enableComplexityFactor: true,
    // Momentum off for consistent comprehension
    enableMomentum: false,
    // Longer paragraph ease-in
    paragraphEaseInWpmDrop: 100,
    paragraphEaseInWords: 6,
  },
};

/**
 * Comprehension Focus - maximum pauses for deep understanding.
 * Good for: studying, learning new material, dense content
 */
export const COMPREHENSION_PRESET: RsvpPreset = {
  id: 'comprehension',
  name: 'Comprehension',
  description: 'Maximum pauses for deep reading',
  config: {
    wpm: 225,
    // +75% punctuation pauses
    commaMultiplier: 2.1,
    periodMultiplier: 3.85,
    questionMultiplier: 4.375,
    exclamationMultiplier: 3.5,
    paragraphMultiplier: 4.375,
    // Maximum phrase pauses
    phraseBoundaryMultiplier: 0.52,
    // Slower long-run threshold
    maxWordsWithoutPause: 5,
    // No momentum - consistent slow pace
    enableMomentum: false,
    // Maximum paragraph ease-in
    paragraphEaseInWpmDrop: 100,
    paragraphEaseInWords: 7,
  },
};

/**
 * All available presets
 */
export const RSVP_PRESETS: RsvpPreset[] = [
  FACTORY_PRESET,
  CASUAL_PRESET,
  SPEED_PRESET,
  TECHNICAL_PRESET,
  COMPREHENSION_PRESET,
];

/**
 * Get a preset by ID
 */
export function getPreset(id: RsvpPresetId): RsvpPreset | undefined {
  return RSVP_PRESETS.find((p) => p.id === id);
}

/**
 * Apply a preset to create a full timing config.
 * Merges preset config with factory defaults.
 * 
 * @param presetId - The preset to apply
 * @param preserveWpm - If true, keep the current WPM instead of the preset's WPM
 * @param currentWpm - Current WPM to preserve (used if preserveWpm is true)
 */
export function applyPreset(
  presetId: RsvpPresetId,
  preserveWpm: boolean = false,
  currentWpm?: number
): RsvpTimingConfig {
  const preset = getPreset(presetId);
  if (!preset) {
    return { ...DEFAULT_TIMING_CONFIG };
  }

  const config = {
    ...DEFAULT_TIMING_CONFIG,
    ...preset.config,
  };

  // Optionally preserve the user's current WPM
  if (preserveWpm && currentWpm !== undefined) {
    config.wpm = currentWpm;
  }

  return config;
}

/**
 * Detect which preset (if any) matches the current config.
 * Returns 'custom' if no preset matches.
 */
export function detectCurrentPreset(config: RsvpTimingConfig): RsvpPresetId | 'custom' {
  // Check each preset (excluding factory which is the baseline)
  for (const preset of RSVP_PRESETS) {
    if (preset.id === 'factory') continue;

    const presetConfig = applyPreset(preset.id);
    
    // Check if all relevant fields match
    const fieldsToCheck: (keyof RsvpTimingConfig)[] = [
      'wpm',
      'commaMultiplier',
      'periodMultiplier',
      'questionMultiplier',
      'paragraphMultiplier',
      'enableMomentum',
      'domainMode',
    ];

    const matches = fieldsToCheck.every(
      (field) => config[field] === presetConfig[field]
    );

    if (matches) {
      return preset.id;
    }
  }

  // Check if it matches factory defaults
  const factoryConfig = DEFAULT_TIMING_CONFIG;
  const factoryFields: (keyof RsvpTimingConfig)[] = [
    'wpm',
    'commaMultiplier',
    'periodMultiplier',
    'questionMultiplier',
    'paragraphMultiplier',
    'enableMomentum',
  ];

  const isFactory = factoryFields.every(
    (field) => config[field] === factoryConfig[field]
  );

  return isFactory ? 'factory' : 'custom';
}
