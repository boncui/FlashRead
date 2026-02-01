'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { RenderedBlock } from '@flashread/dependencies/types';

export interface WordData {
  word: string;
  blockIndex: number;
  wordIndexInBlock: number;
  globalIndex: number;
  blockType: 'heading' | 'p';
}

export interface FlashReadModeState {
  isPlaying: boolean;
  wpm: number;
  currentWordIndex: number;
  totalWords: number;
  isFullscreen: boolean;
  progress: number; // 0-100
}

interface UseFlashReadModeOptions {
  blocks: RenderedBlock[];
  onExit?: () => void;
  initialWpm?: number;
}

const MIN_WPM = 100;
const MAX_WPM = 600;
const DEFAULT_WPM = 250;

export function useFlashReadMode({
  blocks,
  onExit,
  initialWpm = DEFAULT_WPM,
}: UseFlashReadModeOptions) {
  // Parse blocks into word array
  const words = useRef<WordData[]>([]);
  const [state, setState] = useState<FlashReadModeState>({
    isPlaying: false,
    wpm: initialWpm,
    currentWordIndex: 0,
    totalWords: 0,
    isFullscreen: false,
    progress: 0,
  });

  // Animation frame ref for smooth scrolling
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);

  // Parse blocks into words on mount/change
  useEffect(() => {
    const parsedWords: WordData[] = [];
    let globalIndex = 0;

    blocks.forEach((block, blockIndex) => {
      const blockWords = block.text.split(/\s+/).filter((w) => w.length > 0);
      blockWords.forEach((word, wordIndexInBlock) => {
        parsedWords.push({
          word,
          blockIndex,
          wordIndexInBlock,
          globalIndex,
          blockType: block.type,
        });
        globalIndex++;
      });
    });

    words.current = parsedWords;
    setState((prev) => ({
      ...prev,
      totalWords: parsedWords.length,
      progress: parsedWords.length > 0 ? (prev.currentWordIndex / parsedWords.length) * 100 : 0,
    }));
  }, [blocks]);

  // Calculate ms per word based on WPM
  const getMsPerWord = useCallback((wpm: number) => {
    return (60 * 1000) / wpm;
  }, []);

  // Animation loop for advancing words
  useEffect(() => {
    if (!state.isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      accumulatedTimeRef.current += deltaTime;

      const msPerWord = getMsPerWord(state.wpm);

      // Advance words based on accumulated time
      while (accumulatedTimeRef.current >= msPerWord) {
        accumulatedTimeRef.current -= msPerWord;

        setState((prev) => {
          const nextIndex = prev.currentWordIndex + 1;
          if (nextIndex >= prev.totalWords) {
            // Reached end, stop playing
            return {
              ...prev,
              isPlaying: false,
              currentWordIndex: prev.totalWords - 1,
              progress: 100,
            };
          }
          return {
            ...prev,
            currentWordIndex: nextIndex,
            progress: (nextIndex / prev.totalWords) * 100,
          };
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    accumulatedTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isPlaying, state.wpm, getMsPerWord]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setState((prev) => {
      // If at end, restart from beginning
      if (!prev.isPlaying && prev.currentWordIndex >= prev.totalWords - 1) {
        return {
          ...prev,
          isPlaying: true,
          currentWordIndex: 0,
          progress: 0,
        };
      }
      return { ...prev, isPlaying: !prev.isPlaying };
    });
  }, []);

  // Adjust WPM
  const adjustWpm = useCallback((delta: number) => {
    setState((prev) => ({
      ...prev,
      wpm: Math.max(MIN_WPM, Math.min(MAX_WPM, prev.wpm + delta)),
    }));
  }, []);

  // Set specific WPM
  const setWpm = useCallback((wpm: number) => {
    setState((prev) => ({
      ...prev,
      wpm: Math.max(MIN_WPM, Math.min(MAX_WPM, wpm)),
    }));
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setState((prev) => ({ ...prev, isFullscreen: true }));
      } else {
        await document.exitFullscreen();
        setState((prev) => ({ ...prev, isFullscreen: false }));
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState((prev) => ({
        ...prev,
        isFullscreen: !!document.fullscreenElement,
      }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Jump to specific position
  const jumpToPosition = useCallback((wordIndex: number) => {
    setState((prev) => {
      const clampedIndex = Math.max(0, Math.min(prev.totalWords - 1, wordIndex));
      return {
        ...prev,
        currentWordIndex: clampedIndex,
        progress: (clampedIndex / prev.totalWords) * 100,
      };
    });
  }, []);

  // Jump to percentage
  const jumpToPercent = useCallback((percent: number) => {
    setState((prev) => {
      const wordIndex = Math.floor((percent / 100) * prev.totalWords);
      const clampedIndex = Math.max(0, Math.min(prev.totalWords - 1, wordIndex));
      return {
        ...prev,
        currentWordIndex: clampedIndex,
        progress: percent,
      };
    });
  }, []);

  // Get current word data
  const getCurrentWord = useCallback((): WordData | null => {
    return words.current[state.currentWordIndex] || null;
  }, [state.currentWordIndex]);

  // Get current block index
  const getCurrentBlockIndex = useCallback((): number => {
    const currentWord = words.current[state.currentWordIndex];
    return currentWord?.blockIndex ?? 0;
  }, [state.currentWordIndex]);

  // Exit handler
  const exit = useCallback(() => {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onExit?.();
  }, [onExit]);

  return {
    state,
    words: words.current,
    togglePlay,
    adjustWpm,
    setWpm,
    toggleFullscreen,
    jumpToPosition,
    jumpToPercent,
    getCurrentWord,
    getCurrentBlockIndex,
    exit,
  };
}
