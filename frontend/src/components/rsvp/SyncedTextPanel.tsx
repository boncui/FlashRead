'use client';

import { useEffect, useRef, useMemo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { type TokenSourceMapping, findTokenIndexByBlockWord } from './rsvpTokenizer';

interface SyncedTextPanelProps {
  /** The blocks to display */
  blocks: Array<{ type: string; text: string }>;
  /** Mapping from tokens to their source block/word positions */
  tokenMapping: TokenSourceMapping[];
  /** Current token index being displayed in RSVP */
  currentTokenIndex: number;
  /** Callback when a word is clicked */
  onWordClick: (tokenIndex: number) => void;
  /** Whether content filtering is enabled */
  isFilteringContent: boolean;
  /** Callback to toggle content filtering */
  onFilterChange: (enabled: boolean) => void;
  /** Callback to close the panel */
  onClose: () => void;
}

/**
 * SyncedTextPanel displays the full text with the current RSVP word highlighted.
 * Clicking any word jumps the RSVP player to that position.
 */
export const SyncedTextPanel = forwardRef<HTMLDivElement, SyncedTextPanelProps>(
  function SyncedTextPanel(
    {
      blocks,
      tokenMapping,
      currentTokenIndex,
      onWordClick,
      isFilteringContent,
      onFilterChange,
      onClose,
    },
    ref
  ) {
    const currentWordRef = useRef<HTMLSpanElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Get the current block and word indices from the mapping
    const currentMapping = tokenMapping[currentTokenIndex];
    const currentBlockIndex = currentMapping?.blockIndex ?? -1;
    const currentWordIndexInBlock = currentMapping?.wordIndexInBlock ?? -1;

    // Auto-scroll to keep the current word visible
    useEffect(() => {
      if (currentWordRef.current && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const word = currentWordRef.current;
        
        // Get positions relative to the scroll container
        const containerRect = container.getBoundingClientRect();
        const wordRect = word.getBoundingClientRect();
        
        // Calculate if the word is outside the visible area (with some padding)
        const padding = 100; // pixels of padding from edges
        const isAboveView = wordRect.top < containerRect.top + padding;
        const isBelowView = wordRect.bottom > containerRect.bottom - padding;
        
        if (isAboveView || isBelowView) {
          word.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    }, [currentTokenIndex]);

    // Render a single block with clickable words
    const renderBlock = useMemo(() => {
      return (blockIndex: number, block: { type: string; text: string }) => {
        const text = block.text;
        
        // Split text into words and whitespace, preserving whitespace
        const segments = text.split(/(\s+)/);
        let wordIndex = 0;
        
        return segments.map((segment, segIdx) => {
          // If it's whitespace, render it as-is
          if (/^\s+$/.test(segment)) {
            return <span key={segIdx}>{segment}</span>;
          }
          
          // It's a word - check if it's the current word
          const thisWordIndex = wordIndex;
          wordIndex++;
          
          const isCurrent = 
            blockIndex === currentBlockIndex && 
            thisWordIndex === currentWordIndexInBlock;
          
          // Find the token index for this word
          const tokenIdx = findTokenIndexByBlockWord(
            tokenMapping,
            blockIndex,
            thisWordIndex
          );
          
          return (
            <span
              key={segIdx}
              ref={isCurrent ? currentWordRef : null}
              onClick={() => {
                if (tokenIdx >= 0) {
                  onWordClick(tokenIdx);
                }
              }}
              className={cn(
                'cursor-pointer transition-colors duration-150 rounded px-0.5 -mx-0.5',
                'hover:bg-white/10',
                isCurrent && 'bg-yellow-500/40 text-white font-medium'
              )}
            >
              {segment}
            </span>
          );
        });
      };
    }, [currentBlockIndex, currentWordIndexInBlock, tokenMapping, onWordClick]);

    return (
      <div className="flex flex-col h-full" ref={ref}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h3 className="text-white/80 font-medium text-sm">Full Text</h3>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white/80 transition-colors"
            title="Close panel (T)"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        
        {/* Filter toggle */}
        <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-white/60">
            <input
              type="checkbox"
              checked={isFilteringContent}
              onChange={(e) => onFilterChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-white/10 border-white/30 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0"
            />
            Skip non-core content
          </label>
          <span className="text-[10px] text-white/40">
            {isFilteringContent ? 'Filtered' : 'Full text'}
          </span>
        </div>

        {/* Panel content - scrollable */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed"
        >
          {blocks.map((block, blockIndex) => (
            <div key={blockIndex} className="mb-4">
              {block.type === 'heading' ? (
                <h4 className="text-white/90 font-semibold text-base mb-2">
                  {renderBlock(blockIndex, block)}
                </h4>
              ) : (
                <p className="text-white/70">
                  {renderBlock(blockIndex, block)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

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
