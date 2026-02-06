/**
 * Shared Control Components
 * 
 * Reusable form controls for RSVP settings.
 * Used by both RsvpControlsPanel (dark theme) and RsvpSettingsCard (light theme).
 */

import { cn } from '@/lib/utils';
import type { RsvpTimingConfig, DomainMode } from '../timing';

// ============================================================
// Slider Control
// ============================================================

export interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
  className?: string;
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  className,
}: SliderControlProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <label className="text-xs flex-1 opacity-70">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-20 sm:w-24 h-1 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-moz-range-thumb]:w-3
            [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer"
        />
        <span className="text-xs w-12 sm:w-14 text-right tabular-nums opacity-50">
          {formatValue(value)}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Toggle Control
// ============================================================

export interface ToggleControlProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function ToggleControl({
  label,
  description,
  checked,
  onChange,
  className,
}: ToggleControlProps) {
  return (
    <label className={cn('flex items-start justify-between gap-3 cursor-pointer group', className)}>
      <div className="flex-1">
        <span className="text-xs transition-opacity group-hover:opacity-90">
          {label}
        </span>
        {description && (
          <p className="text-[10px] opacity-40 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          checked ? 'bg-blue-500' : 'bg-current opacity-20'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
            checked && 'translate-x-4'
          )}
        />
      </button>
    </label>
  );
}

// ============================================================
// Segmented Control
// ============================================================

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex gap-1 p-1 bg-current opacity-5 rounded-lg', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all',
            value === option.value
              ? 'bg-current opacity-15 shadow-sm'
              : 'opacity-50 hover:opacity-70'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// WPM Slider (specialized)
// ============================================================

export interface WpmSliderProps {
  wpm: number;
  onChange: (wpm: number) => void;
  className?: string;
}

export function WpmSlider({ wpm, onChange, className }: WpmSliderProps) {
  return (
    <SliderControl
      label="Words per minute"
      value={wpm}
      min={100}
      max={1000}
      step={10}
      onChange={onChange}
      formatValue={(v) => `${v} WPM`}
      className={className}
    />
  );
}

// ============================================================
// Punctuation Sliders (group)
// ============================================================

export interface PunctuationSlidersProps {
  config: RsvpTimingConfig;
  onChange: <K extends keyof RsvpTimingConfig>(field: K, value: RsvpTimingConfig[K]) => void;
  className?: string;
}

export function PunctuationSliders({ config, onChange, className }: PunctuationSlidersProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] opacity-40">
        Higher values = longer pause
      </p>
      <SliderControl
        label="Comma"
        value={config.commaMultiplier}
        min={0}
        max={3}
        step={0.1}
        onChange={(v) => onChange('commaMultiplier', v)}
        formatValue={(v) => `${v.toFixed(1)}x`}
      />
      <SliderControl
        label="Period"
        value={config.periodMultiplier}
        min={0}
        max={5}
        step={0.1}
        onChange={(v) => onChange('periodMultiplier', v)}
        formatValue={(v) => `${v.toFixed(1)}x`}
      />
      <SliderControl
        label="Question mark"
        value={config.questionMultiplier}
        min={0}
        max={5}
        step={0.1}
        onChange={(v) => onChange('questionMultiplier', v)}
        formatValue={(v) => `${v.toFixed(1)}x`}
      />
      <SliderControl
        label="Paragraph break"
        value={config.paragraphMultiplier}
        min={0}
        max={5}
        step={0.1}
        onChange={(v) => onChange('paragraphMultiplier', v)}
        formatValue={(v) => `${v.toFixed(1)}x`}
      />
    </div>
  );
}

// ============================================================
// Rhythm Controls (group)
// ============================================================

export interface RhythmControlsProps {
  config: RsvpTimingConfig;
  onChange: <K extends keyof RsvpTimingConfig>(field: K, value: RsvpTimingConfig[K]) => void;
  className?: string;
}

export function RhythmControls({ config, onChange, className }: RhythmControlsProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <SliderControl
        label="Phrase boundary pause"
        value={config.phraseBoundaryMultiplier}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => onChange('phraseBoundaryMultiplier', v)}
        formatValue={(v) => `${Math.round(v * 100)}%`}
      />
      <ToggleControl
        label="Long run relief"
        description="Slow down after many words without pause"
        checked={config.enableLongRunRelief}
        onChange={(v) => onChange('enableLongRunRelief', v)}
      />
      {config.enableLongRunRelief && (
        <SliderControl
          label="Max words without pause"
          value={config.maxWordsWithoutPause}
          min={4}
          max={12}
          step={1}
          onChange={(v) => onChange('maxWordsWithoutPause', v)}
          formatValue={(v) => `${v} words`}
        />
      )}
      <ToggleControl
        label="Paragraph ease-in"
        description="Start each paragraph slower"
        checked={config.enableParagraphEaseIn}
        onChange={(v) => onChange('enableParagraphEaseIn', v)}
      />
    </div>
  );
}

// ============================================================
// Complexity Toggles (group)
// ============================================================

export interface ComplexityTogglesProps {
  config: RsvpTimingConfig;
  onChange: <K extends keyof RsvpTimingConfig>(field: K, value: RsvpTimingConfig[K]) => void;
  className?: string;
}

export function ComplexityToggles({ config, onChange, className }: ComplexityTogglesProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <ToggleControl
        label="Short word boost"
        description="Speed up common short words"
        checked={config.enableShortWordBoost}
        onChange={(v) => onChange('enableShortWordBoost', v)}
      />
      <ToggleControl
        label="Complexity slowdown"
        description="Extra time for rare/complex words"
        checked={config.enableComplexityFactor}
        onChange={(v) => onChange('enableComplexityFactor', v)}
      />
      <ToggleControl
        label="Syllable-based timing"
        description="Use syllables instead of characters"
        checked={config.enableSyllableWeight}
        onChange={(v) => onChange('enableSyllableWeight', v)}
      />
    </div>
  );
}

// ============================================================
// Domain Mode Selector
// ============================================================

export interface DomainModeSelectorProps {
  mode: DomainMode;
  onChange: (mode: DomainMode) => void;
  className?: string;
}

export function DomainModeSelector({ mode, onChange, className }: DomainModeSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <SegmentedControl
        value={mode}
        options={[
          { value: 'prose', label: 'Prose' },
          { value: 'technical', label: 'Technical' },
          { value: 'math', label: 'Math' },
          { value: 'code', label: 'Code' },
        ]}
        onChange={onChange}
      />
      <p className="text-[10px] opacity-40">
        {mode === 'prose' && 'Standard timing for general text'}
        {mode === 'technical' && 'Extra time for technical terms and citations'}
        {mode === 'math' && 'Extra time for math symbols and numbers'}
        {mode === 'code' && 'Extra time for code-like patterns'}
      </p>
    </div>
  );
}

// ============================================================
// Momentum Controls (group)
// ============================================================

export interface MomentumControlsProps {
  config: RsvpTimingConfig;
  onChange: <K extends keyof RsvpTimingConfig>(field: K, value: RsvpTimingConfig[K]) => void;
  className?: string;
}

export function MomentumControls({ config, onChange, className }: MomentumControlsProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <ToggleControl
        label="Enable momentum"
        description="Speed up during easy word sequences"
        checked={config.enableMomentum}
        onChange={(v) => onChange('enableMomentum', v)}
      />
      {config.enableMomentum && (
        <SliderControl
          label="Max speed boost"
          value={config.momentumMaxBoost}
          min={0.05}
          max={0.3}
          step={0.01}
          onChange={(v) => onChange('momentumMaxBoost', v)}
          formatValue={(v) => `${Math.round(v * 100)}%`}
        />
      )}
    </div>
  );
}

// ============================================================
// Preset Selector (group)
// ============================================================

export interface PresetSelectorProps {
  currentPreset: string;
  onSelectPreset: (presetId: string) => void;
  presets: Array<{ id: string; name: string; description: string }>;
  className?: string;
}

export function PresetSelector({
  currentPreset,
  onSelectPreset,
  presets,
  className,
}: PresetSelectorProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelectPreset(preset.id)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all border',
            currentPreset === preset.id
              ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
              : 'bg-current opacity-5 border-current border-opacity-10 hover:opacity-10'
          )}
          title={preset.description}
        >
          {preset.name}
        </button>
      ))}
      {currentPreset === 'custom' && (
        <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300">
          Custom
        </span>
      )}
    </div>
  );
}
