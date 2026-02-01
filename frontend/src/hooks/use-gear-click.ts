'use client';

import { useCallback, useRef } from 'react';
import useSound from 'use-sound';

interface GearClickOptions {
  volume?: number;
  /** Playback rate variation for natural feel (default: 0.1) */
  rateVariation?: number;
}

/**
 * Hook that plays a satisfying mechanical gear click sound.
 * Uses the bicycle gear lever sound for authentic mechanical feel.
 */
export function useGearClick(options: GearClickOptions = {}) {
  const { volume = 0.3, rateVariation = 0.15 } = options;

  const lastClickTimeRef = useRef(0);

  const [play, { stop }] = useSound('/sounds/gear-click.wav', {
    volume,
    // Shorter, snappier click for immediate feedback
    sprite: {
      click: [403, 35],      // Shortened to 35ms for faster response
      clickSoft: [575, 10],  // Even shorter soft click
    },
    interrupt: true, // Allow interrupting previous sounds
    preload: true,   // Preload for faster response
  });

  const playClick = useCallback(() => {
    // Minimal throttle (10ms) for very responsive feedback
    const now = performance.now();
    if (now - lastClickTimeRef.current < 10) {
      return;
    }
    lastClickTimeRef.current = now;

    try {
      // Stop any playing sound first for immediate response
      stop();
      play({ id: 'click' });
    } catch {
      // Silently fail if audio not available
    }
  }, [play, stop]);

  return playClick;
}
