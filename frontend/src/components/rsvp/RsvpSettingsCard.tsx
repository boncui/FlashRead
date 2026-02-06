'use client';

import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRsvpSettings } from '@/hooks/use-rsvp-settings';
import type { RsvpTimingConfig, DomainMode } from './timing';
import { RSVP_PRESETS, detectCurrentPreset, applyPreset, type RsvpPresetId } from './presets';

/**
 * RsvpSettingsCard - Settings page card for RSVP timing controls.
 * 
 * Light-themed version of RsvpControlsPanel, designed to fit in the settings page.
 */
export function RsvpSettingsCard() {
  const {
    config,
    isLoaded,
    isDirty,
    isSaving,
    error,
    updateConfig,
    applyPreset: applyPresetFn,
    resetToFactory,
    saveNow,
  } = useRsvpSettings({ autoSave: true });

  // Detect current preset
  const currentPreset = useMemo(() => detectCurrentPreset(config), [config]);

  // Handle preset selection
  const handlePresetChange = useCallback(
    (presetId: RsvpPresetId) => {
      const presetConfig = applyPreset(presetId);
      applyPresetFn(presetConfig);
    },
    [applyPresetFn]
  );

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>RSVP Reading Settings</CardTitle>
          <CardDescription>Loading your reading preferences...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>RSVP Reading Settings</CardTitle>
        <CardDescription>
          Configure your speed reading preferences for the RSVP player
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}

        {/* Presets Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Presets</Label>
          <div className="flex flex-wrap gap-2">
            {RSVP_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={currentPreset === preset.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetChange(preset.id)}
                title={preset.description}
              >
                {preset.name}
              </Button>
            ))}
            {currentPreset === 'custom' && (
              <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                Custom
              </span>
            )}
          </div>
        </div>

        {/* Speed Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Speed</Label>
          <SliderControl
            label="Words per minute"
            value={config.wpm}
            min={100}
            max={1000}
            step={10}
            onChange={(v) => updateConfig('wpm', v)}
            formatValue={(v) => `${v} WPM`}
          />
        </div>

        {/* Punctuation Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Punctuation Pauses</Label>
          <p className="text-xs text-muted-foreground">
            Higher values = longer pause
          </p>
          <div className="space-y-2">
            <SliderControl
              label="Comma"
              value={config.commaMultiplier}
              min={0}
              max={3}
              step={0.1}
              onChange={(v) => updateConfig('commaMultiplier', v)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
            <SliderControl
              label="Semicolon"
              value={config.semicolonMultiplier}
              min={0}
              max={3}
              step={0.1}
              onChange={(v) => updateConfig('semicolonMultiplier', v)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
            <SliderControl
              label="Colon"
              value={config.colonMultiplier}
              min={0}
              max={3}
              step={0.1}
              onChange={(v) => updateConfig('colonMultiplier', v)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
            <SliderControl
              label="Period"
              value={config.periodMultiplier}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => updateConfig('periodMultiplier', v)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
            <SliderControl
              label="Question mark"
              value={config.questionMultiplier}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => updateConfig('questionMultiplier', v)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
            <SliderControl
              label="Exclamation"
              value={config.exclamationMultiplier}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => updateConfig('exclamationMultiplier', v)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
            <SliderControl
              label="Paragraph break"
              value={config.paragraphMultiplier}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => updateConfig('paragraphMultiplier', v)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
          </div>
        </div>

        {/* Rhythm & Flow Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Rhythm & Flow</Label>
          <div className="space-y-2">
            <SliderControl
              label="Phrase boundary pause"
              value={config.phraseBoundaryMultiplier}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateConfig('phraseBoundaryMultiplier', v)}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />
            <ToggleControl
              label="Long run relief"
              description="Slow down after many words without pause"
              checked={config.enableLongRunRelief}
              onChange={(v) => updateConfig('enableLongRunRelief', v)}
            />
            {config.enableLongRunRelief && (
              <SliderControl
                label="Max words without pause"
                value={config.maxWordsWithoutPause}
                min={4}
                max={12}
                step={1}
                onChange={(v) => updateConfig('maxWordsWithoutPause', v)}
                formatValue={(v) => `${v} words`}
              />
            )}
            <ToggleControl
              label="Paragraph ease-in"
              description="Start each paragraph slower"
              checked={config.enableParagraphEaseIn}
              onChange={(v) => updateConfig('enableParagraphEaseIn', v)}
            />
          </div>
        </div>

        {/* Word Complexity Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Word Complexity</Label>
          <div className="space-y-2">
            <ToggleControl
              label="Short word boost"
              description="Speed up common short words"
              checked={config.enableShortWordBoost}
              onChange={(v) => updateConfig('enableShortWordBoost', v)}
            />
            <ToggleControl
              label="Complexity slowdown"
              description="Extra time for rare/complex words"
              checked={config.enableComplexityFactor}
              onChange={(v) => updateConfig('enableComplexityFactor', v)}
            />
            <ToggleControl
              label="Syllable-based timing"
              description="Use syllables instead of characters"
              checked={config.enableSyllableWeight}
              onChange={(v) => updateConfig('enableSyllableWeight', v)}
            />
          </div>
        </div>

        {/* Content Mode Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Content Mode</Label>
          <SegmentedControl
            value={config.domainMode}
            options={[
              { value: 'prose', label: 'Prose' },
              { value: 'technical', label: 'Technical' },
              { value: 'math', label: 'Math' },
              { value: 'code', label: 'Code' },
            ]}
            onChange={(v) => updateConfig('domainMode', v as DomainMode)}
          />
          <p className="text-xs text-muted-foreground">
            {config.domainMode === 'prose' && 'Standard timing for general text'}
            {config.domainMode === 'technical' && 'Extra time for technical terms and citations'}
            {config.domainMode === 'math' && 'Extra time for math symbols and numbers'}
            {config.domainMode === 'code' && 'Extra time for code-like patterns'}
          </p>
        </div>

        {/* Momentum Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Momentum</Label>
          <div className="space-y-2">
            <ToggleControl
              label="Enable momentum"
              description="Speed up during easy word sequences"
              checked={config.enableMomentum}
              onChange={(v) => updateConfig('enableMomentum', v)}
            />
            {config.enableMomentum && (
              <SliderControl
                label="Max speed boost"
                value={config.momentumMaxBoost}
                min={0.05}
                max={0.3}
                step={0.01}
                onChange={(v) => updateConfig('momentumMaxBoost', v)}
                formatValue={(v) => `${Math.round(v * 100)}%`}
              />
            )}
          </div>
        </div>

        {/* Save/Reset Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={saveNow}
            disabled={!isDirty || isSaving}
            variant={isDirty ? 'default' : 'outline'}
          >
            {isSaving ? 'Saving...' : isDirty ? 'Save Settings' : 'Saved'}
          </Button>
          <Button
            onClick={resetToFactory}
            variant="outline"
          >
            Reset to Factory Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-components
// ============================================================

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
      <label className="text-sm text-muted-foreground flex-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-20 sm:w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:bg-primary
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer"
        />
        <span className="text-sm text-muted-foreground w-14 sm:w-16 text-right tabular-nums">
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
        <span className="text-sm text-foreground group-hover:text-foreground/80 transition-colors">
          {label}
        </span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors shrink-0',
          checked ? 'bg-primary' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
            checked && 'translate-x-5'
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
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
            value === option.value
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
