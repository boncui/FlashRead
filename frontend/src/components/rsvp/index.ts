export { RsvpPlayer } from './RsvpPlayer';
export { RsvpControlsPanel } from './RsvpControlsPanel';
export { RsvpSettingsCard } from './RsvpSettingsCard';
export { SyncedTextPanel } from './SyncedTextPanel';
export {
  SliderControl,
  ToggleControl,
  SegmentedControl,
  WpmSlider,
  PunctuationSliders,
  RhythmControls,
  ComplexityToggles,
  DomainModeSelector,
  MomentumControls,
  PresetSelector,
  type SliderControlProps,
  type ToggleControlProps,
  type SegmentedControlProps,
  type WpmSliderProps,
  type PunctuationSlidersProps,
  type RhythmControlsProps,
  type ComplexityTogglesProps,
  type DomainModeSelectorProps,
  type MomentumControlsProps,
  type PresetSelectorProps,
} from './controls/SharedControls';
export {
  RSVP_PRESETS,
  FACTORY_PRESET,
  CASUAL_PRESET,
  SPEED_PRESET,
  TECHNICAL_PRESET,
  COMPREHENSION_PRESET,
  getPreset,
  applyPreset,
  detectCurrentPreset,
  type RsvpPresetId,
  type RsvpPreset,
} from './presets';
export {
  tokenize,
  blocksToText,
  getWordCount,
  findParagraphStart,
  createTokenBlockMapping,
  findTokenIndexByBlockWord,
  // New cadence model exports
  isAbbreviation,
  detectNumberType,
  estimateSyllables,
  computeTokenComplexity,
  detectBoundaryType,
  hasOpeningPunctuation,
  hasClosingPunctuation,
  hasDash,
  isCodeLike,
  hasMathSymbols,
  type RsvpToken,
  type TokenSourceMapping,
  type BoundaryType,
  type NumberType,
} from './rsvpTokenizer';
export { splitTokenForOrp, getOrpIndex, extractWordBody, getOrpCenterOffset } from './orp';
export {
  DEFAULT_TIMING_CONFIG,
  getBaseInterval,
  getTokenDuration,
  getEstimatedDuration,
  formatDuration,
  // Cadence model exports
  getLengthFactor,
  getProsodyFactor,
  getComplexityFactor,
  getDomainFactor,
  getBoundaryPause,
  // Flow timing exports
  calculateMomentumMultiplier,
  updateFlowMomentum,
  updateRollingAverage,
  calculateAverageCorrection,
  getFlowAdjustedDuration,
  type RsvpTimingConfig,
  type WpmRampState,
  type DomainMode,
  type FlowState,
} from './timing';
export {
  RsvpScheduler,
  type SchedulerTelemetry,
} from './scheduler';
export { COMMON_WORDS_1K, COMMON_WORDS_5K, COMMON_WORDS_20K } from './wordFrequency';
export {
  RsvpTelemetryService,
  DEFAULT_TELEMETRY_CONFIG,
  type RsvpTelemetryConfig,
  type RsvpTelemetryEvent,
  type RsvpSessionStartEvent,
  type RsvpSessionEndEvent,
  type RsvpPauseEvent,
  type RsvpSpeedChangeEvent,
  type RsvpRewindEvent,
  type RsvpTokenDisplayEvent,
  type RsvpFrameJitterEvent,
  type RsvpComprehensionProbe,
  type RsvpEvent,
  type RsvpSessionMetrics,
} from './rsvpTelemetry';
export {
  useRsvpEngine,
  type RsvpEngine,
  type RsvpEngineState,
  type RsvpEngineControls,
  type UseRsvpEngineOptions,
} from './hooks/useRsvpEngine';
export {
  useKeyboardShortcuts,
  type KeyboardShortcutsHandlers,
  type UseKeyboardShortcutsOptions,
} from './hooks/useKeyboardShortcuts';
