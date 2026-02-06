'use client';

import { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { RsvpTimingConfig, DomainMode } from './timing';
import { RSVP_PRESETS, detectCurrentPreset, applyPreset, type RsvpPresetId } from './presets';

interface RsvpControlsPanelProps {
  /** Current timing config */
  config: RsvpTimingConfig;
  /** Update a single config field */
  onUpdateConfig: <K extends keyof RsvpTimingConfig>(field: K, value: RsvpTimingConfig[K]) => void;
  /** Apply a preset */
  onApplyPreset: (config: Partial<RsvpTimingConfig>) => void;
  /** Reset to factory defaults */
  onResetToFactory: () => void;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Whether settings are being saved */
  isSaving?: boolean;
  /** Save settings manually */
  onSave?: () => void;
  /** Close the panel */
  onClose: () => void;
}

/**
 * RsvpControlsPanel - Right-side settings panel for RSVP timing controls.
 * 
 * Organized into sections:
 * 1. Presets - Quick apply preset profiles
 * 2. Speed - WPM slider
 * 3. Punctuation - Pause multipliers for different punctuation
 * 4. Rhythm & Flow - Phrase boundaries, long-run relief, ease-in
 * 5. Word Complexity - Short word boost, complexity factor, syllables
 * 6. Content Mode - Domain mode selector
 * 7. Momentum - Speed boost on easy content
 */
export function RsvpControlsPanel({
  config,
  onUpdateConfig,
  onApplyPreset,
  onResetToFactory,
  isDirty,
  isSaving,
  onSave,
  onClose,
}: RsvpControlsPanelProps) {
  // Detect current preset
  const currentPreset = useMemo(() => detectCurrentPreset(config), [config]);

  // Handle preset selection
  const handlePresetChange = useCallback(
    (presetId: RsvpPresetId) => {
      const presetConfig = applyPreset(presetId);
      onApplyPreset(presetConfig);
    },
    [onApplyPreset]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-white/80 font-medium text-sm">Settings</h3>
          {isSaving && (
            <span className="text-[10px] text-white/40 animate-pulse">Saving...</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-white/40 hover:text-white/80 transition-colors"
          title="Close settings (S)"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div 
        className="flex-1 overflow-y-scroll min-h-0"
        style={{
          direction: 'rtl',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.3) rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ direction: 'ltr' }}>
        {/* Presets Section */}
        <Section title="Presets">
          <div className="flex flex-wrap gap-2">
            {RSVP_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  currentPreset === preset.id
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80'
                )}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
            {currentPreset === 'custom' && (
              <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Custom
              </span>
            )}
          </div>
        </Section>

        {/* Speed Section */}
        <Section title="Speed">
          <SliderControl
            label="Words per minute"
            value={config.wpm}
            min={100}
            max={1000}
            step={10}
            onChange={(v) => onUpdateConfig('wpm', v)}
            formatValue={(v) => `${v} WPM`}
          />
        </Section>

        {/* Punctuation Section */}
        <Section title="Punctuation Pauses">
          <p className="text-[10px] text-white/40 -mt-1 mb-2">
            Higher values = longer pause
          </p>
          <SliderControl
            label="Comma"
            value={config.commaMultiplier}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => onUpdateConfig('commaMultiplier', v)}
            formatValue={(v) => `${v.toFixed(1)}x`}
          />
          <SliderControl
            label="Period"
            value={config.periodMultiplier}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => onUpdateConfig('periodMultiplier', v)}
            formatValue={(v) => `${v.toFixed(1)}x`}
          />
          <SliderControl
            label="Question mark"
            value={config.questionMultiplier}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => onUpdateConfig('questionMultiplier', v)}
            formatValue={(v) => `${v.toFixed(1)}x`}
          />
          <SliderControl
            label="Paragraph break"
            value={config.paragraphMultiplier}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => onUpdateConfig('paragraphMultiplier', v)}
            formatValue={(v) => `${v.toFixed(1)}x`}
          />
        </Section>

        {/* Rhythm & Flow Section */}
        <Section title="Rhythm & Flow">
          <SliderControl
            label="Phrase boundary pause"
            value={config.phraseBoundaryMultiplier}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => onUpdateConfig('phraseBoundaryMultiplier', v)}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
          <ToggleControl
            label="Long run relief"
            description="Slow down after many words without pause"
            checked={config.enableLongRunRelief}
            onChange={(v) => onUpdateConfig('enableLongRunRelief', v)}
          />
          {config.enableLongRunRelief && (
            <SliderControl
              label="Max words without pause"
              value={config.maxWordsWithoutPause}
              min={4}
              max={12}
              step={1}
              onChange={(v) => onUpdateConfig('maxWordsWithoutPause', v)}
              formatValue={(v) => `${v} words`}
            />
          )}
          <ToggleControl
            label="Paragraph ease-in"
            description="Start each paragraph slower"
            checked={config.enableParagraphEaseIn}
            onChange={(v) => onUpdateConfig('enableParagraphEaseIn', v)}
          />
        </Section>

        {/* Word Complexity Section */}
        <Section title="Word Complexity">
          <ToggleControl
            label="Short word boost"
            description="Speed up common short words"
            checked={config.enableShortWordBoost}
            onChange={(v) => onUpdateConfig('enableShortWordBoost', v)}
          />
          <ToggleControl
            label="Complexity slowdown"
            description="Extra time for rare/complex words"
            checked={config.enableComplexityFactor}
            onChange={(v) => onUpdateConfig('enableComplexityFactor', v)}
          />
          <ToggleControl
            label="Syllable-based timing"
            description="Use syllables instead of characters"
            checked={config.enableSyllableWeight}
            onChange={(v) => onUpdateConfig('enableSyllableWeight', v)}
          />
        </Section>

        {/* Content Mode Section */}
        <Section title="Content Mode">
          <SegmentedControl
            value={config.domainMode}
            options={[
              { value: 'prose', label: 'Prose' },
              { value: 'technical', label: 'Technical' },
              { value: 'math', label: 'Math' },
              { value: 'code', label: 'Code' },
            ]}
            onChange={(v) => onUpdateConfig('domainMode', v as DomainMode)}
          />
          <p className="text-[10px] text-white/40 mt-2">
            {config.domainMode === 'prose' && 'Standard timing for general text'}
            {config.domainMode === 'technical' && 'Extra time for technical terms and citations'}
            {config.domainMode === 'math' && 'Extra time for math symbols and numbers'}
            {config.domainMode === 'code' && 'Extra time for code-like patterns'}
          </p>
        </Section>

        {/* Momentum Section */}
        <Section title="Momentum">
          <ToggleControl
            label="Enable momentum"
            description="Speed up during easy word sequences"
            checked={config.enableMomentum}
            onChange={(v) => onUpdateConfig('enableMomentum', v)}
          />
          {config.enableMomentum && (
            <SliderControl
              label="Max speed boost"
              value={config.momentumMaxBoost}
              min={0.05}
              max={0.3}
              step={0.01}
              onChange={(v) => onUpdateConfig('momentumMaxBoost', v)}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />
          )}
        </Section>

        {/* Footer with Save + Reset */}
        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          <button
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className={cn(
              'w-full py-2 text-sm font-medium rounded-md transition-colors',
              isDirty && !isSaving
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
            )}
          >
            {isSaving ? 'Saving...' : isDirty ? 'Save Settings' : 'Saved'}
          </button>
          <button
            onClick={onResetToFactory}
            className="w-full py-2 text-sm font-medium text-white/60 bg-white/5 rounded-md hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            Reset to Factory Defaults
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-white/5">
      <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: SliderControlProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-white/70 flex-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-20 sm:w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-moz-range-thumb]:w-3
            [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer"
        />
        <span className="text-xs text-white/50 w-12 sm:w-14 text-right tabular-nums">
          {formatValue(value)}
        </span>
      </div>
    </div>
  );
}

interface ToggleControlProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleControl({ label, description, checked, onChange }: ToggleControlProps) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer group">
      <div className="flex-1">
        <span className="text-xs text-white/70 group-hover:text-white/90 transition-colors">
          {label}
        </span>
        {description && (
          <p className="text-[10px] text-white/40 mt-0.5">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          checked ? 'bg-blue-500' : 'bg-white/20'
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

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
            value === option.value
              ? 'bg-white/15 text-white'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
