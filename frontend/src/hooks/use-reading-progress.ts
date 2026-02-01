'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { saveReadingProgress, getReadingProgress } from '@flashread/backend/actions';
import { findParagraphStart, type RsvpToken } from '@/components/rsvp';

export interface ReadingProgressState {
  /** Initial position to resume from (adjusted to paragraph start) */
  initialIndex: number;
  /** Whether progress has been loaded */
  isLoaded: boolean;
  /** Saved WPM preference, if any */
  savedWpm?: number;
  /** Whether there was existing progress to resume */
  hasProgress: boolean;
}

interface UseReadingProgressOptions {
  /** Document ID to save progress for. If not provided, progress is not saved. */
  documentId?: string;
  /** Tokens for paragraph boundary calculation */
  tokens: RsvpToken[];
  /** Debounce delay in ms (default: 2000) */
  debounceMs?: number;
}

/**
 * Hook to manage reading progress persistence.
 * 
 * Features:
 * - Loads saved progress on mount
 * - Adjusts resume position to paragraph start (not mid-sentence)
 * - Auto-saves progress with debouncing
 * - Saves on visibility change (tab switch/close)
 */
export function useReadingProgress({
  documentId,
  tokens,
  debounceMs = 2000,
}: UseReadingProgressOptions) {
  const [state, setState] = useState<ReadingProgressState>({
    initialIndex: 0,
    isLoaded: false,
    hasProgress: false,
  });

  // Track the latest index for saving
  const latestIndexRef = useRef(0);
  const latestWpmRef = useRef<number | undefined>(undefined);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Load saved progress on mount
  useEffect(() => {
    if (!documentId) {
      setState({ initialIndex: 0, isLoaded: true, hasProgress: false });
      return;
    }

    let cancelled = false;

    async function loadProgress() {
      try {
        const progress = await getReadingProgress(documentId!);
        
        if (cancelled) return;

        if (progress && progress.token_index > 0) {
          // Find the start of the paragraph containing the saved position
          const paragraphStart = findParagraphStart(tokens, progress.token_index);
          
          setState({
            initialIndex: paragraphStart,
            isLoaded: true,
            savedWpm: progress.wpm,
            hasProgress: true,
          });
        } else {
          setState({
            initialIndex: 0,
            isLoaded: true,
            hasProgress: false,
          });
        }
      } catch (error) {
        console.error('Failed to load reading progress:', error);
        if (!cancelled) {
          setState({ initialIndex: 0, isLoaded: true, hasProgress: false });
        }
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
  }, [documentId, tokens]);

  // Save function (internal)
  const doSave = useCallback(async () => {
    if (!documentId || isSavingRef.current) return;

    isSavingRef.current = true;
    try {
      await saveReadingProgress(documentId, latestIndexRef.current, latestWpmRef.current);
    } catch (error) {
      console.error('Failed to save reading progress:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [documentId]);

  // Debounced save
  const scheduleSave = useCallback(() => {
    if (!documentId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      doSave();
    }, debounceMs);
  }, [documentId, debounceMs, doSave]);

  // Update progress (called by the reader on index change)
  const updateProgress = useCallback(
    (index: number, wpm?: number) => {
      latestIndexRef.current = index;
      if (wpm !== undefined) {
        latestWpmRef.current = wpm;
      }
      scheduleSave();
    },
    [scheduleSave]
  );

  // Immediate save (for pause, exit, etc.)
  const saveNow = useCallback(() => {
    if (!documentId) return;

    // Cancel pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    doSave();
  }, [documentId, doSave]);

  // Save on visibility change (tab switch, minimize, etc.)
  useEffect(() => {
    if (!documentId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Cancel debounce and save immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        doSave();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [documentId, doSave]);

  // Cleanup on unmount - save any pending progress
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Note: We can't await in cleanup, so this is fire-and-forget
      if (documentId && latestIndexRef.current > 0) {
        saveReadingProgress(documentId, latestIndexRef.current, latestWpmRef.current).catch(
          (error) => console.error('Failed to save progress on unmount:', error)
        );
      }
    };
  }, [documentId]);

  return {
    ...state,
    updateProgress,
    saveNow,
  };
}
