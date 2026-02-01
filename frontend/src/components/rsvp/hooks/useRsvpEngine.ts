/**
 * useRsvpEngine Hook
 * 
 * Single point of scheduler ownership for RSVP playback.
 * Guarantees ONE scheduler instance and handles lifecycle properly.
 * 
 * Usage:
 * ```typescript
 * const engine = useRsvpEngine(text, config);
 * 
 * // Control playback
 * engine.play();
 * engine.pause();
 * engine.seek(100);
 * 
 * // Access state
 * console.log(engine.currentIndex, engine.currentToken, engine.isPlaying);
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { RsvpScheduler } from '../scheduler';
import { tokenize, type RsvpToken } from '../rsvpTokenizer';
import type { RsvpTimingConfig } from '../timing';

export interface RsvpEngineState {
  /** Currently displayed token index */
  currentIndex: number;
  /** Currently displayed token */
  currentToken: RsvpToken | null;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Progress as percentage (0-100) */
  progress: number;
  /** All tokens */
  tokens: RsvpToken[];
  /** Whether paused due to tab visibility */
  isPausedByVisibility: boolean;
}

export interface RsvpEngineControls {
  /** Start or resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Toggle play/pause */
  togglePlayPause: () => void;
  /** Stop and reset to beginning */
  stop: () => void;
  /** Jump to specific token index */
  seek: (index: number) => void;
  /** Advance by N tokens (positive or negative) */
  advance: (delta: number) => void;
  /** Update WPM or other config */
  updateConfig: (config: Partial<RsvpTimingConfig>) => void;
  /** Get current effective WPM (accounts for ramping) */
  getEffectiveWpm: () => number;
  /** Check if WPM is currently ramping */
  isRamping: () => boolean;
  /** Enable telemetry collection */
  enableTelemetry: () => void;
  /** Get telemetry summary */
  getTelemetrySummary: () => ReturnType<RsvpScheduler['getTelemetrySummary']>;
}

export type RsvpEngine = RsvpEngineState & RsvpEngineControls;

export interface UseRsvpEngineOptions {
  /** Text to tokenize and display */
  text: string;
  /** Timing configuration */
  config: RsvpTimingConfig;
  /** Initial token index (for resuming) */
  initialIndex?: number;
  /** Callback when playback completes */
  onComplete?: () => void;
  /** Callback when token changes (for side effects like telemetry) */
  onTokenChange?: (index: number, token: RsvpToken) => void;
}

/**
 * Hook that manages RSVP engine lifecycle and state.
 * 
 * Key features:
 * - Single scheduler instance (prevents multiple RAF loops)
 * - Automatic cleanup on unmount
 * - Config updates without recreating scheduler
 * - Proper pause/resume handling
 */
export function useRsvpEngine({
  text,
  config,
  initialIndex = 0,
  onComplete,
  onTokenChange,
}: UseRsvpEngineOptions): RsvpEngine {
  const schedulerRef = useRef<RsvpScheduler | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPausedByVisibility, setIsPausedByVisibility] = useState(false);
  
  // Tokenize text (memoized by useEffect dependency)
  const [tokens, setTokens] = useState<RsvpToken[]>([]);
  
  useEffect(() => {
    const newTokens = tokenize(text);
    setTokens(newTokens);
    setCurrentIndex(Math.min(initialIndex, Math.max(0, newTokens.length - 1)));
  }, [text, initialIndex]);
  
  // Current token
  const currentToken = tokens[currentIndex] || null;
  
  // Progress percentage
  const progress = tokens.length > 0 ? (currentIndex / tokens.length) * 100 : 0;
  
  // Initialize scheduler when tokens change
  useEffect(() => {
    if (tokens.length === 0) return;
    
    const handleTick = (index: number, token: RsvpToken) => {
      setCurrentIndex(index);
      onTokenChange?.(index, token);
    };
    
    const handleComplete = () => {
      setIsPlaying(false);
      onComplete?.();
    };
    
    const scheduler = new RsvpScheduler(
      tokens,
      config,
      handleTick,
      handleComplete
    );
    
    // If there was an initial index, jump to it
    if (initialIndex > 0 && initialIndex < tokens.length) {
      scheduler.jumpTo(initialIndex);
    }
    
    schedulerRef.current = scheduler;
    
    return () => {
      scheduler.destroy();
      schedulerRef.current = null;
    };
    // Only recreate when tokens change, NOT on config/callback changes
    // Config is updated separately via updateConfig effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);
  
  // Update scheduler config when config changes (without recreating)
  useEffect(() => {
    schedulerRef.current?.updateConfig(config);
  }, [config]);
  
  // Sync playing state with scheduler
  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;
    
    if (isPlaying) {
      scheduler.start();
    } else {
      scheduler.pause();
    }
  }, [isPlaying]);
  
  // Monitor visibility pause state
  useEffect(() => {
    const checkVisibility = () => {
      const scheduler = schedulerRef.current;
      if (scheduler) {
        setIsPausedByVisibility(scheduler.isPausedByVisibility());
      }
    };
    
    // Check periodically (visibility handler in scheduler handles the actual pause/resume)
    const interval = setInterval(checkVisibility, 500);
    return () => clearInterval(interval);
  }, []);
  
  // Control functions
  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);
  
  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);
  
  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);
  
  const stop = useCallback(() => {
    schedulerRef.current?.stop();
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);
  
  const seek = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, tokens.length - 1));
    schedulerRef.current?.jumpTo(clampedIndex);
    setCurrentIndex(clampedIndex);
  }, [tokens.length]);
  
  const advance = useCallback((delta: number) => {
    const newIndex = Math.max(0, Math.min(tokens.length - 1, currentIndex + delta));
    seek(newIndex);
  }, [currentIndex, tokens.length, seek]);
  
  const updateConfig = useCallback((newConfig: Partial<RsvpTimingConfig>) => {
    schedulerRef.current?.updateConfig(newConfig);
  }, []);
  
  const getEffectiveWpm = useCallback(() => {
    return schedulerRef.current?.getEffectiveWpm() || config.wpm;
  }, [config.wpm]);
  
  const isRamping = useCallback(() => {
    return schedulerRef.current?.isRamping() || false;
  }, []);
  
  const enableTelemetry = useCallback(() => {
    schedulerRef.current?.enableTelemetry();
  }, []);
  
  const getTelemetrySummary = useCallback(() => {
    return schedulerRef.current?.getTelemetrySummary() || null;
  }, []);
  
  return {
    // State
    currentIndex,
    currentToken,
    isPlaying,
    progress,
    tokens,
    isPausedByVisibility,
    
    // Controls
    play,
    pause,
    togglePlayPause,
    stop,
    seek,
    advance,
    updateConfig,
    getEffectiveWpm,
    isRamping,
    enableTelemetry,
    getTelemetrySummary,
  };
}
