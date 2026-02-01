'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { cn } from '@/lib/utils';
import { useGearClick } from '@/hooks/use-gear-click';
import { useReadingProgress } from '@/hooks/use-reading-progress';
import { useRsvpSettings } from '@/hooks/use-rsvp-settings';
import { tokenize, blocksToText, getWordCount, createTokenBlockMapping, type RsvpToken } from './rsvpTokenizer';
import { splitTokenForOrp, getOrpCenterOffset } from './orp';
import {
  DEFAULT_TIMING_CONFIG,
  type RsvpTimingConfig,
  getEstimatedDuration,
  formatDuration,
} from './timing';
import { RsvpScheduler } from './scheduler';
import { filterBlocks, filterText } from '@/lib/content-filter';
import { SyncedTextPanel } from './SyncedTextPanel';
import { RsvpControlsPanel } from './RsvpControlsPanel';

export interface RsvpPlayerProps {
  /** Source text to display */
  text?: string;
  /** Alternative: rendered blocks from a Flashread */
  blocks?: Array<{ type: string; text: string }>;
  /** Title to show (optional) */
  title?: string;
  /** Callback when exiting RSVP mode */
  onExit?: () => void;
  /** Initial WPM setting */
  initialWpm?: number;
  /** Initial timing config overrides */
  initialConfig?: Partial<RsvpTimingConfig>;
  /** Callback to save settings */
  onSettingsChange?: (config: RsvpTimingConfig) => void;
  /** Document ID for saving reading progress (if provided, progress is auto-saved) */
  documentId?: string;
  /** Filter out non-core content like page numbers, footnotes, captions (default: true) */
  filterContent?: boolean;
}

const MIN_WPM = 100;
const MAX_WPM = 1000;

export function RsvpPlayer({
  text,
  blocks,
  title,
  onExit,
  initialWpm = 300,
  initialConfig,
  onSettingsChange,
  documentId,
  filterContent: initialFilterContent = true,
}: RsvpPlayerProps) {
  // Content filtering state
  const [isFilteringContent, setIsFilteringContent] = useState(initialFilterContent);

  // Derive source text with optional content filtering
  const sourceText = useMemo(() => {
    if (text) {
      return isFilteringContent ? filterText(text) : text;
    }
    if (blocks) {
      const filteredBlocks = isFilteringContent ? filterBlocks(blocks) : blocks;
      return blocksToText(filteredBlocks);
    }
    return '';
  }, [text, blocks, isFilteringContent]);

  // Also filter blocks for the text panel display
  const displayBlocks = useMemo(() => {
    if (!blocks) return undefined;
    return isFilteringContent ? filterBlocks(blocks) : blocks;
  }, [blocks, isFilteringContent]);

  // Create token-to-block mapping for the synced text panel
  const tokenMapping = useMemo(() => {
    if (!displayBlocks) return [];
    return createTokenBlockMapping(displayBlocks);
  }, [displayBlocks]);

  // Tokenize
  const tokens = useMemo(() => tokenize(sourceText), [sourceText]);
  const wordCount = useMemo(() => getWordCount(tokens), [tokens]);

  // Reading progress persistence
  const {
    initialIndex,
    isLoaded: progressLoaded,
    savedWpm,
    hasProgress,
    updateProgress,
    saveNow,
  } = useReadingProgress({ documentId, tokens });

  // RSVP settings persistence (per-user)
  const {
    config: savedConfig,
    isLoaded: settingsLoaded,
    isDirty: isSettingsDirty,
    isSaving: isSettingsSaving,
    updateConfig: updateSavedConfig,
    applyPreset,
    resetToFactory,
    saveNow: saveSettingsNow,
  } = useRsvpSettings();

  // State - initialize from saved progress once loaded
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(initialWpm);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize from saved progress and settings once loaded
  useEffect(() => {
    if (progressLoaded && settingsLoaded && !hasInitialized) {
      if (initialIndex > 0) {
        setCurrentIndex(initialIndex);
        schedulerRef.current?.jumpTo(initialIndex);
      }
      // Use saved settings WPM, then document progress WPM, then initialWpm prop
      if (savedConfig.wpm) {
        setWpm(savedConfig.wpm);
      } else if (savedWpm) {
        setWpm(savedWpm);
      }
      setHasInitialized(true);
    }
  }, [progressLoaded, settingsLoaded, hasInitialized, initialIndex, savedWpm, savedConfig.wpm]);

  // Auto-save progress when currentIndex changes
  useEffect(() => {
    if (hasInitialized && documentId) {
      updateProgress(currentIndex, wpm);
    }
  }, [currentIndex, wpm, hasInitialized, documentId, updateProgress]);
  const [showControls, setShowControls] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [showTextPanel, setShowTextPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // WPM change indicator
  const [showWpmIndicator, setShowWpmIndicator] = useState(false);
  const wpmIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WPM drag/edit state
  const [isEditingWpm, setIsEditingWpm] = useState(false);
  const [editWpmValue, setEditWpmValue] = useState('');
  const wpmDragRef = useRef({
    isDragging: false,
    startX: 0,
    startWpm: 0,
    hasMoved: false,
  });
  const wpmInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const schedulerRef = useRef<RsvpScheduler | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textPanelRef = useRef<HTMLDivElement>(null);

  // Arrow key hold-to-accelerate refs
  const arrowHoldIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const arrowHoldSpeedRef = useRef(200); // Start at 200ms, will decrease
  const arrowHoldCountRef = useRef(0);

  // Gear click sound
  const playClick = useGearClick({ volume: 0.2 });

  // Timing config - uses saved settings, with local wpm override for responsiveness
  const timingConfig = useMemo<RsvpTimingConfig>(
    () => ({
      ...savedConfig,
      wpm, // Local wpm state for responsive adjustments
      ...initialConfig, // Allow props to override
    }),
    [savedConfig, wpm, initialConfig]
  );

  // Current token
  const currentToken = tokens[currentIndex];
  const orpParts = useMemo(
    () => (currentToken ? splitTokenForOrp(currentToken.text) : { pre: '', orp: '', post: '' }),
    [currentToken]
  );

  // Estimated duration
  const estimatedDuration = useMemo(
    () => getEstimatedDuration(tokens, timingConfig),
    [tokens, timingConfig]
  );

  // Progress
  const progress = tokens.length > 0 ? (currentIndex / tokens.length) * 100 : 0;

  // Initialize scheduler
  useEffect(() => {
    const scheduler = new RsvpScheduler(
      tokens,
      timingConfig,
      (index) => setCurrentIndex(index),
      () => setIsPlaying(false)
    );
    schedulerRef.current = scheduler;

    return () => {
      scheduler.destroy();
    };
  }, [tokens]); // Only recreate on tokens change

  // Update scheduler config when WPM changes
  useEffect(() => {
    schedulerRef.current?.updateConfig({ wpm });
  }, [wpm]);

  // Play/pause control
  useEffect(() => {
    if (isPlaying) {
      schedulerRef.current?.start();
      // Hide text panel when playing to focus on RSVP
      setShowTextPanel(false);
    } else {
      schedulerRef.current?.pause();
      // Save progress when paused
      if (hasInitialized && documentId) {
        saveNow();
      }
      // Show text panel when paused
      setShowTextPanel(true);
    }
  }, [isPlaying, hasInitialized, documentId, saveNow]);

  // Mouse move to show controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      if (isPlaying) {
        hideControlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 2500);
      }
    };

    const container = containerRef.current;
    container?.addEventListener('mousemove', handleMouseMove);
    container?.addEventListener('touchstart', handleMouseMove);

    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      container?.removeEventListener('touchstart', handleMouseMove);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Cleanup WPM indicator timeout
  useEffect(() => {
    return () => {
      if (wpmIndicatorTimeoutRef.current) {
        clearTimeout(wpmIndicatorTimeoutRef.current);
      }
    };
  }, []);

  // Advance word helper with sound
  const advanceWord = useCallback(
    (direction: 1 | -1) => {
      setCurrentIndex((prev) => {
        const newIndex = Math.max(0, Math.min(tokens.length - 1, prev + direction));
        if (newIndex !== prev) {
          schedulerRef.current?.jumpTo(newIndex);
          playClick();
        }
        return newIndex;
      });
    },
    [tokens.length, playClick]
  );

  // Click to toggle play
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Don't toggle if clicking on controls
    if ((e.target as HTMLElement).closest('[data-controls]')) {
      return;
    }
    setIsPlaying((p) => !p);
  }, []);

  const adjustWpm = useCallback((delta: number) => {
    setWpm((prev) => {
      const newWpm = Math.max(MIN_WPM, Math.min(MAX_WPM, prev + delta));
      // Also update saved settings (debounced)
      updateSavedConfig('wpm', newWpm);
      return newWpm;
    });
    
    // Show WPM indicator briefly
    setShowWpmIndicator(true);
    if (wpmIndicatorTimeoutRef.current) {
      clearTimeout(wpmIndicatorTimeoutRef.current);
    }
    wpmIndicatorTimeoutRef.current = setTimeout(() => {
      setShowWpmIndicator(false);
    }, 1200);
  }, [updateSavedConfig]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    schedulerRef.current?.stop();
    // Save progress before exiting (don't reset to 0)
    saveNow();
    onExit?.();
  }, [onExit, saveNow]);

  const handleRestart = useCallback(() => {
    schedulerRef.current?.jumpTo(0);
    setCurrentIndex(0);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          // Only start hold interval if not already repeating
          if (!e.repeat) {
            advanceWord(-1);
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
                    advanceWord(-1);
                  }, arrowHoldSpeedRef.current);
                }
              }
              advanceWord(-1);
            }, arrowHoldSpeedRef.current);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Only start hold interval if not already repeating
          if (!e.repeat) {
            advanceWord(1);
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
                    advanceWord(1);
                  }, arrowHoldSpeedRef.current);
                }
              }
              advanceWord(1);
            }, arrowHoldSpeedRef.current);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustWpm(10);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustWpm(-10);
          break;
        case 'Escape':
          e.preventDefault();
          handleStop();
          break;
        case 'KeyR':
          e.preventDefault();
          handleRestart();
          break;
        case 'KeyT':
          e.preventDefault();
          setShowTextPanel((p) => !p);
          break;
        case 'KeyS':
          e.preventDefault();
          setShowSettingsPanel((p) => !p);
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
  }, [advanceWord, adjustWpm, handleStop, handleRestart]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const targetIndex = Math.floor((percent / 100) * tokens.length);
      schedulerRef.current?.jumpTo(targetIndex);
      setCurrentIndex(targetIndex);
    },
    [tokens.length]
  );

  // Handle word click from the synced text panel
  const handleWordClick = useCallback((tokenIndex: number) => {
    if (tokenIndex >= 0 && tokenIndex < tokens.length) {
      schedulerRef.current?.jumpTo(tokenIndex);
      setCurrentIndex(tokenIndex);
      setIsPlaying(false); // Pause when clicking a word
      playClick(); // Play feedback sound
    }
  }, [tokens.length, playClick]);

  // WPM drag handlers
  const handleWpmPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    wpmDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startWpm: wpm,
      hasMoved: false,
    };
  }, [wpm]);

  const handleWpmPointerMove = useCallback((e: React.PointerEvent) => {
    if (!wpmDragRef.current.isDragging) return;
    
    const deltaX = e.clientX - wpmDragRef.current.startX;
    // Consider it a "move" if dragged more than 5px
    if (Math.abs(deltaX) > 5) {
      wpmDragRef.current.hasMoved = true;
    }
    
    // Map 1px = 2 WPM for responsive feel
    const deltaWpm = Math.round(deltaX * 2);
    const newWpm = Math.max(MIN_WPM, Math.min(MAX_WPM, wpmDragRef.current.startWpm + deltaWpm));
    setWpm(newWpm);
    updateSavedConfig('wpm', newWpm);
  }, [updateSavedConfig]);

  const handleWpmPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const hasMoved = wpmDragRef.current.hasMoved;
    wpmDragRef.current.isDragging = false;
    wpmDragRef.current.hasMoved = false;
    
    // If no significant drag movement, enter edit mode
    if (!hasMoved) {
      setEditWpmValue(String(wpm));
      setIsEditingWpm(true);
      // Focus input on next tick
      setTimeout(() => wpmInputRef.current?.select(), 0);
    }
  }, [wpm]);

  const handleWpmInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const value = e.target.value.replace(/\D/g, '');
    setEditWpmValue(value);
  }, []);

  const handleWpmInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const parsed = parseInt(editWpmValue, 10);
      if (!isNaN(parsed)) {
        const newWpm = Math.max(MIN_WPM, Math.min(MAX_WPM, parsed));
        setWpm(newWpm);
        updateSavedConfig('wpm', newWpm);
      }
      setIsEditingWpm(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingWpm(false);
    }
  }, [editWpmValue, updateSavedConfig]);

  const handleWpmInputBlur = useCallback(() => {
    const parsed = parseInt(editWpmValue, 10);
    if (!isNaN(parsed)) {
      const newWpm = Math.max(MIN_WPM, Math.min(MAX_WPM, parsed));
      setWpm(newWpm);
      updateSavedConfig('wpm', newWpm);
    }
    setIsEditingWpm(false);
  }, [editWpmValue, updateSavedConfig]);

  // Save settings on unmount or config change
  useEffect(() => {
    return () => {
      onSettingsChange?.(timingConfig);
    };
  }, [timingConfig, onSettingsChange]);

  // Set body/html background to black while RSVP player is active
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    
    html.style.backgroundColor = 'black';
    body.style.backgroundColor = 'black';
    
    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  // Show loading state while progress and settings are being loaded
  if ((documentId && !progressLoaded) || !settingsLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white/50 text-center">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no tokens
  if (tokens.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white/50 text-center">
          <p className="text-xl">No text to display</p>
          <button
            onClick={onExit}
            className="mt-4 px-4 py-2 bg-white/10 rounded hover:bg-white/20 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black select-none cursor-pointer"
      onClick={handleContainerClick}
    >
      {/* Text panel - slides from left */}
      <div
        ref={textPanelRef}
        data-controls
        className={cn(
          'absolute top-0 left-0 h-full w-80 sm:w-96 overflow-hidden bg-zinc-900/95 backdrop-blur-sm border-r border-white/10 z-20 transition-transform duration-300 ease-in-out',
          showTextPanel ? 'translate-x-0' : '-translate-x-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {displayBlocks ? (
          <SyncedTextPanel
            blocks={displayBlocks}
            tokenMapping={tokenMapping}
            currentTokenIndex={currentIndex}
            onWordClick={handleWordClick}
            isFilteringContent={isFilteringContent}
            onFilterChange={setIsFilteringContent}
            onClose={() => setShowTextPanel(false)}
          />
        ) : text ? (
          /* Fallback for plain text mode (no blocks) */
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-white/80 font-medium text-sm">Full Text</h3>
              <button
                onClick={() => setShowTextPanel(false)}
                className="p-1 text-white/40 hover:text-white/80 transition-colors"
                title="Close panel (T)"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[calc(100%-52px)] overflow-y-auto overscroll-contain p-4 text-sm leading-relaxed">
              <p className="text-white/70 whitespace-pre-wrap">
                {isFilteringContent ? filterText(text) : text}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Settings panel - slides from right */}
      <div
        data-controls
        className={cn(
          'absolute top-0 right-0 h-full w-80 sm:w-96 overflow-hidden bg-zinc-900/95 backdrop-blur-sm border-l border-white/10 z-20 transition-transform duration-300 ease-in-out',
          showSettingsPanel ? 'translate-x-0' : 'translate-x-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <RsvpControlsPanel
          config={timingConfig}
          onUpdateConfig={(field, value) => {
            // Update local wpm state for responsiveness
            if (field === 'wpm') {
              setWpm(value as number);
            }
            // Update saved settings (debounced)
            updateSavedConfig(field, value);
          }}
          onApplyPreset={applyPreset}
          onResetToFactory={() => {
            resetToFactory();
            setWpm(DEFAULT_TIMING_CONFIG.wpm);
          }}
          isDirty={isSettingsDirty}
          isSaving={isSettingsSaving}
          onSave={saveSettingsNow}
          onClose={() => setShowSettingsPanel(false)}
        />
      </div>

      {/* Crosshair axis - fixed reference point behind words (hidden) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none hidden">
        {/* Horizontal axis (X) */}
        <div
          className="absolute w-full h-px"
          style={{ backgroundColor: 'rgb(211, 211, 211)', opacity: 0.45 }}
        />
        {/* Vertical axis (Y) */}
        <div
          className="absolute h-full w-px"
          style={{ backgroundColor: 'rgb(211, 211, 211)', opacity: 0.45 }}
        />
      </div>

      {/* Word display - ORP character centered at screen center, all text on same baseline */}
      <div className="absolute inset-0 flex items-center justify-center">
        {currentToken?.isParagraphBreak ? (
          <span className="text-white/20 text-2xl">•••</span>
        ) : (
          <span
            className="font-serif tracking-wide whitespace-nowrap"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              // Responsive font size: scales with viewport, fills ~8-12% of screen
              fontSize: 'clamp(3rem, 8vw, 12rem)',
              // Shift left so ORP character lands at center
              transform: `translateX(${(0.5 - getOrpCenterOffset(currentToken.text)) * 100}%)`,
            }}
          >
            <span className="text-white">{orpParts.pre}</span>
            <span className="text-[#e05a5a]">{orpParts.orp}</span>
            <span className="text-white">{orpParts.post}</span>
          </span>
        )}
      </div>

      {/* WPM display - bottom right (always visible) */}
      <div className="absolute bottom-6 right-6 text-white/40 text-sm italic font-light">
        {wpm} wpm
      </div>

      {/* WPM change indicator - prominent center bottom */}
      <div
        className={cn(
          'absolute bottom-32 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 transition-all duration-300 pointer-events-none',
          showWpmIndicator
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        )}
      >
        <span className="text-white text-3xl font-semibold tabular-nums">{wpm}</span>
        <span className="text-white/60 text-lg ml-2">WPM</span>
      </div>

      {/* Badges - top right */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {isFilteringContent && (
          <button
            data-controls
            onClick={() => setShowTextPanel(true)}
            className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
            title="Content filtered - click to configure"
          >
            <FilterIcon className="w-3 h-3 inline mr-1" />
            FILTERED
          </button>
        )}
        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded border border-amber-500/30">
          EXPERIMENTAL
        </span>
        <button
          data-controls
          onClick={() => setShowWarning(true)}
          className="text-white/40 hover:text-white/60 transition-colors"
          title="About RSVP"
        >
          <InfoIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Top left controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button
          data-controls
          onClick={handleStop}
          className="p-2 text-white/40 hover:text-white/80 transition-colors"
          title="Exit (Esc)"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
        <button
          data-controls
          onClick={() => setShowTextPanel((p) => !p)}
          className={cn(
            'p-2 transition-colors',
            showTextPanel
              ? 'text-white/80 bg-white/10 rounded'
              : 'text-white/40 hover:text-white/80'
          )}
          title="Show text panel (T)"
        >
          <TextIcon className="w-5 h-5" />
        </button>
        <button
          data-controls
          onClick={() => setShowSettingsPanel((p) => !p)}
          className={cn(
            'p-2 transition-colors',
            showSettingsPanel
              ? 'text-white/80 bg-white/10 rounded'
              : 'text-white/40 hover:text-white/80'
          )}
          title="Show settings (S)"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Controls overlay */}
      <div
        data-controls
        className={cn(
          'absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Progress bar */}
        <div
          className="w-full h-1 bg-white/10 rounded-full cursor-pointer mb-4 overflow-hidden"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-white/40 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Left: Play/Pause + Word count */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <PauseIcon className="w-6 h-6 text-white" />
              ) : (
                <PlayIcon className="w-6 h-6 text-white" />
              )}
            </button>
            <div className="text-white/50 text-sm">
              {currentIndex + 1} / {tokens.length}
            </div>
          </div>

          {/* Center: Draggable WPM control */}
          <div className="flex items-center justify-center flex-1">
            {isEditingWpm ? (
              <div className="flex items-center gap-2">
                <input
                  ref={wpmInputRef}
                  type="text"
                  inputMode="numeric"
                  value={editWpmValue}
                  onChange={handleWpmInputChange}
                  onKeyDown={handleWpmInputKeyDown}
                  onBlur={handleWpmInputBlur}
                  className="w-20 px-2 py-1 bg-white/10 border border-white/30 rounded text-white text-center text-lg font-semibold tabular-nums focus:outline-none focus:border-white/50"
                  autoFocus
                />
                <span className="text-white/50 text-sm">WPM</span>
              </div>
            ) : (
              <div
                onPointerDown={handleWpmPointerDown}
                onPointerMove={handleWpmPointerMove}
                onPointerUp={handleWpmPointerUp}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg cursor-ew-resize select-none transition-colors touch-none"
                title="Drag to adjust or click to type exact value"
              >
                <span className="text-white text-lg font-semibold tabular-nums">{wpm}</span>
                <span className="text-white/50 text-sm">WPM</span>
                {/* Drag hint arrows */}
                <span className="text-white/30 text-xs ml-1">◀▶</span>
              </div>
            )}
          </div>

          {/* Right: Estimated time + Restart */}
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-sm">
              ~{formatDuration(estimatedDuration)}
            </span>
            <button
              onClick={handleRestart}
              className="p-2 text-white/40 hover:text-white/80 transition-colors"
              title="Restart (R)"
            >
              <RestartIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-white/30 flex-wrap">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">Space</kbd>{' '}
            Play/Pause
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] ml-0.5">→</kbd>{' '}
            ±1 Word
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] ml-0.5">↓</kbd>{' '}
            ±10 WPM
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">T</kbd>{' '}
            Text
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">S</kbd>{' '}
            Settings
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">R</kbd>{' '}
            Restart
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px]">Esc</kbd>{' '}
            Exit
          </span>
        </div>
      </div>

      {/* Warning modal */}
      {showWarning && (
        <div
          className="absolute inset-0 bg-black/80 flex items-center justify-center z-10"
          onClick={() => setShowWarning(false)}
        >
          <div
            data-controls
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <WarningIcon className="w-5 h-5 text-amber-400" />
              <h3 className="text-white font-semibold">About RSVP Mode</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              RSVP (Rapid Serial Visual Presentation) displays words one at a time at high speeds.
              While it can be useful for certain tasks, research shows it may:
            </p>
            <ul className="text-white/60 text-sm space-y-2 mb-4 list-disc list-inside">
              <li>Reduce comprehension compared to normal reading</li>
              <li>Increase cognitive load and fatigue</li>
              <li>Make it difficult to re-read or skim content</li>
              <li>Not improve overall reading speed long-term</li>
            </ul>
            <p className="text-amber-400/80 text-sm font-medium mb-4">
              Use at your own discretion. This is an experimental feature.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full py-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
            >
              I understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
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

function RestartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function TextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
