/**
 * useKeyboardShortcuts Hook
 * 
 * Handles all keyboard shortcuts for RSVP player.
 * Extracted from RsvpPlayer to reduce complexity.
 */

import { useEffect, useRef } from 'react';

export interface KeyboardShortcutsHandlers {
  /** Toggle play/pause */
  onTogglePlayPause: () => void;
  /** Move backward one word */
  onStepBackward: () => void;
  /** Move forward one word */
  onStepForward: () => void;
  /** Increase WPM */
  onIncreaseWpm: () => void;
  /** Decrease WPM */
  onDecreaseWpm: () => void;
  /** Exit RSVP mode */
  onExit: () => void;
  /** Restart from beginning */
  onRestart: () => void;
  /** Toggle text panel */
  onToggleTextPanel: () => void;
  /** Toggle settings panel */
  onToggleSettings: () => void;
}

export interface UseKeyboardShortcutsOptions extends KeyboardShortcutsHandlers {
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook for keyboard shortcuts with hold-to-accelerate for arrow keys.
 * 
 * Shortcuts:
 * - Space: Play/Pause
 * - ←/→: Step backward/forward (hold to accelerate)
 * - ↑/↓: Increase/decrease WPM
 * - Esc: Exit
 * - R: Restart
 * - T: Toggle text panel
 * - S: Toggle settings
 */
export function useKeyboardShortcuts({
  onTogglePlayPause,
  onStepBackward,
  onStepForward,
  onIncreaseWpm,
  onDecreaseWpm,
  onExit,
  onRestart,
  onToggleTextPanel,
  onToggleSettings,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  // Arrow key hold-to-accelerate state
  const arrowHoldIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const arrowHoldSpeedRef = useRef(200); // Start at 200ms, will decrease
  const arrowHoldCountRef = useRef(0);
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onTogglePlayPause();
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          // Only start hold interval if not already repeating
          if (!e.repeat) {
            onStepBackward();
            // Start hold-to-accelerate
            arrowHoldCountRef.current = 0;
            arrowHoldSpeedRef.current = 200;
            arrowHoldIntervalRef.current = setInterval(() => {
              arrowHoldCountRef.current++;
              // Accelerate: reduce interval every 3 repeats, min 50ms
              if (arrowHoldCountRef.current % 3 === 0) {
                arrowHoldSpeedRef.current = Math.max(50, arrowHoldSpeedRef.current - 20);
                if (arrowHoldIntervalRef.current) {
                  clearInterval(arrowHoldIntervalRef.current);
                  arrowHoldIntervalRef.current = setInterval(() => {
                    onStepBackward();
                  }, arrowHoldSpeedRef.current);
                }
              }
              onStepBackward();
            }, arrowHoldSpeedRef.current);
          }
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          // Only start hold interval if not already repeating
          if (!e.repeat) {
            onStepForward();
            // Start hold-to-accelerate
            arrowHoldCountRef.current = 0;
            arrowHoldSpeedRef.current = 200;
            arrowHoldIntervalRef.current = setInterval(() => {
              arrowHoldCountRef.current++;
              // Accelerate: reduce interval every 3 repeats, min 50ms
              if (arrowHoldCountRef.current % 3 === 0) {
                arrowHoldSpeedRef.current = Math.max(50, arrowHoldSpeedRef.current - 20);
                if (arrowHoldIntervalRef.current) {
                  clearInterval(arrowHoldIntervalRef.current);
                  arrowHoldIntervalRef.current = setInterval(() => {
                    onStepForward();
                  }, arrowHoldSpeedRef.current);
                }
              }
              onStepForward();
            }, arrowHoldSpeedRef.current);
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          onIncreaseWpm();
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          onDecreaseWpm();
          break;
          
        case 'Escape':
          e.preventDefault();
          onExit();
          break;
          
        case 'KeyR':
          e.preventDefault();
          onRestart();
          break;
          
        case 'KeyT':
          e.preventDefault();
          onToggleTextPanel();
          break;
          
        case 'KeyS':
          e.preventDefault();
          onToggleSettings();
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Clear hold-to-accelerate on arrow key release
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (arrowHoldIntervalRef.current) {
          clearInterval(arrowHoldIntervalRef.current);
          arrowHoldIntervalRef.current = null;
        }
        arrowHoldCountRef.current = 0;
        arrowHoldSpeedRef.current = 200;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Cleanup interval on unmount
      if (arrowHoldIntervalRef.current) {
        clearInterval(arrowHoldIntervalRef.current);
      }
    };
  }, [
    enabled,
    onTogglePlayPause,
    onStepBackward,
    onStepForward,
    onIncreaseWpm,
    onDecreaseWpm,
    onExit,
    onRestart,
    onToggleTextPanel,
    onToggleSettings,
  ]);
}
