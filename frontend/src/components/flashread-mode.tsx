'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RenderedBlock } from '@flashread/dependencies/types';
import { useFlashReadMode } from '@/hooks/use-flashread-mode';
import { cn } from '@/lib/utils';
import { RsvpPlayer } from '@/components/rsvp';

interface FlashReadModeProps {
  blocks: RenderedBlock[];
  title?: string;
  onExit: () => void;
  /** Document ID for saving reading progress */
  documentId?: string;
}

export function FlashReadMode({ blocks, title, onExit, documentId }: FlashReadModeProps) {
  const [readingMode, setReadingMode] = useState<'scroll' | 'rsvp'>('rsvp');
  
  const {
    state,
    togglePlay,
    adjustWpm,
    toggleFullscreen,
    jumpToPosition,
    jumpToPercent,
    getCurrentBlockIndex,
    exit,
  } = useFlashReadMode({ blocks, onExit });

  const contentRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<(HTMLElement | null)[]>([]);
  
  // Scroll to current block smoothly
  useEffect(() => {
    const currentBlockIndex = getCurrentBlockIndex();
    const blockElement = blockRefs.current[currentBlockIndex];
    
    if (blockElement && contentRef.current) {
      blockElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [getCurrentBlockIndex]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for our control keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'Escape', 'KeyF'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'Space':
          togglePlay();
          break;
        case 'ArrowUp':
          adjustWpm(25);
          break;
        case 'ArrowDown':
          adjustWpm(-25);
          break;
        case 'Escape':
          exit();
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, adjustWpm, exit, toggleFullscreen]);

  // Scroll wheel controls for scrubbing through text (like video)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Scroll down = skip forward, scroll up = go backward
      // Skip ~20 words per scroll tick for smooth scrubbing
      const wordsToSkip = Math.sign(e.deltaY) * 20;
      jumpToPosition(state.currentWordIndex + wordsToSkip);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [jumpToPosition, state.currentWordIndex]);

  // Progress bar click handler
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      jumpToPercent(Math.max(0, Math.min(100, percent)));
    },
    [jumpToPercent]
  );

  const currentBlockIndex = getCurrentBlockIndex();
  
  // RSVP mode
  if (readingMode === 'rsvp') {
    return (
      <RsvpPlayer
        blocks={blocks}
        title={title}
        onExit={onExit}
        initialWpm={state.wpm}
        documentId={documentId}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar with WPM and controls */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        {/* WPM Display - Top Left */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
            <span className="text-2xl font-bold tabular-nums">{state.wpm}</span>
            <span className="text-sm text-muted-foreground">WPM</span>
          </div>
          <div className="text-sm text-muted-foreground hidden sm:block">
            ↑↓ to adjust speed
          </div>
        </div>

        {/* Title - Center */}
        {title && (
          <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-muted-foreground truncate max-w-[200px] sm:max-w-md">
            {title}
          </div>
        )}

        {/* Controls - Top Right */}
        <div className="flex items-center gap-2">
          {/* RSVP Mode Toggle */}
          <button
            onClick={() => setReadingMode('rsvp')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-colors text-sm"
            title="Switch to RSVP mode (experimental)"
          >
            <RsvpIcon className="w-4 h-4" />
            <span className="hidden sm:inline">RSVP</span>
            <span className="px-1 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-medium rounded hidden sm:inline">
              EXP
            </span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Toggle fullscreen (F)"
          >
            {state.isFullscreen ? (
              <ExitFullscreenIcon className="w-5 h-5" />
            ) : (
              <FullscreenIcon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={exit}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Exit reading mode (Esc)"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8"
      >
        {/* Centered reading container following typography guidelines */}
        <div className="max-w-[60ch] mx-auto text-lg leading-relaxed text-left">
          {blocks.map((block, index) => {
            const isCurrentBlock = index === currentBlockIndex;
            const isPastBlock = index < currentBlockIndex;

            if (block.type === 'heading') {
              return (
                <h2
                  key={index}
                  ref={(el) => { blockRefs.current[index] = el; }}
                  className={cn(
                    'text-2xl font-bold mt-10 mb-6 first:mt-0 transition-colors duration-300',
                    isCurrentBlock && 'text-foreground',
                    isPastBlock && 'text-muted-foreground/60',
                    !isCurrentBlock && !isPastBlock && 'text-muted-foreground/40'
                  )}
                >
                  {block.text}
                </h2>
              );
            }

            return (
              <p
                key={index}
                ref={(el) => { blockRefs.current[index] = el; }}
                className={cn(
                  'mb-6 transition-colors duration-300',
                  isCurrentBlock && 'text-foreground',
                  isPastBlock && 'text-muted-foreground/60',
                  !isCurrentBlock && !isPastBlock && 'text-muted-foreground/40'
                )}
              >
                {block.text}
              </p>
            );
          })}
        </div>
      </div>

      {/* Play/Pause overlay indicator */}
      {!state.isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background/80 backdrop-blur-sm rounded-full p-8 shadow-lg">
            <PlayIcon className="w-16 h-16 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Bottom progress bar */}
      <div className="border-t border-border/50 px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title={state.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {state.isPlaying ? (
              <PauseIcon className="w-6 h-6" />
            ) : (
              <PlayIcon className="w-6 h-6" />
            )}
          </button>

          {/* Progress bar */}
          <div
            className="flex-1 h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-primary rounded-full transition-all duration-150"
              style={{ width: `${state.progress}%` }}
            />
          </div>

          {/* Progress percentage */}
          <div className="text-sm text-muted-foreground tabular-nums w-12 text-right">
            {Math.round(state.progress)}%
          </div>
        </div>

        {/* Instructions */}
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Space</kbd> Play/Pause
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono ml-0.5">↓</kbd> Speed
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Scroll</kbd> Skip
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">F</kbd> Fullscreen
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> Exit
          </span>
        </div>
      </div>
    </div>
  );
}

// Icon components
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function FullscreenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8V4h4M4 16v4h4M16 4h4v4M16 20h4v-4"
      />
    </svg>
  );
}

function ExitFullscreenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 4v4H4M8 20v-4H4M16 4v4h4M16 20v-4h4"
      />
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
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function RsvpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Eye icon representing focused reading */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}
