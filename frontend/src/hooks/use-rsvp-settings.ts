'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getRsvpSettings,
  saveRsvpSettings,
  resetRsvpSettings,
  type RsvpUserSettings,
} from '@flashread/backend/actions';
import { DEFAULT_TIMING_CONFIG, type RsvpTimingConfig } from '@/components/rsvp/timing';

export interface RsvpSettingsState {
  /** The merged config (user settings + factory defaults) */
  config: RsvpTimingConfig;
  /** Whether settings have been loaded from the server */
  isLoaded: boolean;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Error message if load/save failed */
  error: string | null;
}

interface UseRsvpSettingsOptions {
  /** Debounce delay for auto-save in ms (default: 1000) */
  debounceMs?: number;
  /** Whether to auto-save on changes (default: false) */
  autoSave?: boolean;
}

/**
 * Hook to manage RSVP timing settings with persistence.
 * 
 * Features:
 * - Loads user settings on mount, merges with factory defaults
 * - Auto-saves changes with debouncing
 * - Provides reset to factory functionality
 * - Handles unauthenticated state gracefully (uses defaults)
 */
export function useRsvpSettings({
  debounceMs = 1000,
  autoSave = false,
}: UseRsvpSettingsOptions = {}) {
  const [state, setState] = useState<RsvpSettingsState>({
    config: { ...DEFAULT_TIMING_CONFIG },
    isLoaded: false,
    isDirty: false,
    isSaving: false,
    error: null,
  });

  // Track user overrides separately from the merged config
  const userSettingsRef = useRef<RsvpUserSettings>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Load settings on mount
  useEffect(() => {
    isMountedRef.current = true;

    async function loadSettings() {
      try {
        const settings = await getRsvpSettings();
        
        if (!isMountedRef.current) return;

        if (settings) {
          userSettingsRef.current = settings;
          setState((prev) => ({
            ...prev,
            config: { ...DEFAULT_TIMING_CONFIG, ...settings },
            isLoaded: true,
            error: null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isLoaded: true,
            error: null,
          }));
        }
      } catch (error) {
        console.error('Failed to load RSVP settings:', error);
        if (!isMountedRef.current) return;
        
        // Use defaults on error
        setState((prev) => ({
          ...prev,
          isLoaded: true,
          error: error instanceof Error ? error.message : 'Failed to load settings',
        }));
      }
    }

    loadSettings();

    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save function (internal)
  const doSave = useCallback(async () => {
    if (!isMountedRef.current) return;

    setState((prev) => ({ ...prev, isSaving: true }));

    try {
      await saveRsvpSettings(userSettingsRef.current);
      
      if (!isMountedRef.current) return;
      
      setState((prev) => ({
        ...prev,
        isSaving: false,
        isDirty: false,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to save RSVP settings:', error);
      
      if (!isMountedRef.current) return;
      
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save settings',
      }));
    }
  }, []);

  // Schedule debounced save
  const scheduleSave = useCallback(() => {
    if (!autoSave) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      doSave();
    }, debounceMs);
  }, [autoSave, debounceMs, doSave]);

  // Update a single config field
  const updateConfig = useCallback(
    <K extends keyof RsvpTimingConfig>(field: K, value: RsvpTimingConfig[K]) => {
      // Track user override
      userSettingsRef.current = {
        ...userSettingsRef.current,
        [field]: value,
      };

      setState((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          [field]: value,
        },
        isDirty: true,
      }));

      scheduleSave();
    },
    [scheduleSave]
  );

  // Update multiple config fields at once
  const updateConfigBatch = useCallback(
    (updates: Partial<RsvpTimingConfig>) => {
      // Track user overrides
      userSettingsRef.current = {
        ...userSettingsRef.current,
        ...updates,
      };

      setState((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          ...updates,
        },
        isDirty: true,
      }));

      scheduleSave();
    },
    [scheduleSave]
  );

  // Apply a preset (replaces all settings with preset values)
  const applyPreset = useCallback(
    (presetConfig: Partial<RsvpTimingConfig>) => {
      // Replace user settings with preset values
      userSettingsRef.current = { ...presetConfig };

      setState((prev) => ({
        ...prev,
        config: {
          ...DEFAULT_TIMING_CONFIG,
          ...presetConfig,
        },
        isDirty: true,
      }));

      scheduleSave();
    },
    [scheduleSave]
  );

  // Reset to factory defaults
  const resetToFactory = useCallback(async () => {
    // Clear user settings
    userSettingsRef.current = {};

    setState((prev) => ({
      ...prev,
      config: { ...DEFAULT_TIMING_CONFIG },
      isDirty: false,
      isSaving: true,
    }));

    // Cancel any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    try {
      await resetRsvpSettings();
      
      if (!isMountedRef.current) return;
      
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to reset RSVP settings:', error);
      
      if (!isMountedRef.current) return;
      
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to reset settings',
      }));
    }
  }, []);

  // Immediate save (for when user is about to leave)
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (Object.keys(userSettingsRef.current).length > 0) {
      doSave();
    }
  }, [doSave]);

  // Save on visibility change (tab switch, minimize)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && state.isDirty) {
        saveNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isDirty, saveNow]);

  return {
    ...state,
    updateConfig,
    updateConfigBatch,
    applyPreset,
    resetToFactory,
    saveNow,
  };
}
