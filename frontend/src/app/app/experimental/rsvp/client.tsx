'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Flashread } from '@flashread/dependencies/types';
import { RsvpPlayer } from '@/components/rsvp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface RsvpExperimentalClientProps {
  flashreads: Flashread[];
}

const SAMPLE_TEXT = `The art of reading is in great part that of acquiring a better understanding of life from one's encounter with it in a book. We read to find out about ourselves, about others, about the world. Reading opens doors to new ideas and experiences we might never have otherwise.

In the digital age, the way we consume written content has evolved dramatically. From scrolling through social media feeds to skimming articles, our reading habits have adapted to an environment of information abundance.

RSVP (Rapid Serial Visual Presentation) is one experimental approach to reading that displays words sequentially at a fixed position. While it can achieve high word-per-minute rates, research suggests it may come with trade-offs in comprehension and retention.

This is a demonstration of the RSVP reading technique. Notice how each word appears briefly, with punctuation creating natural pauses in the flow. The red letter indicates the optimal recognition point—where your eye should focus for fastest word recognition.`;

export function RsvpExperimentalClient({ flashreads }: RsvpExperimentalClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'select' | 'paste' | 'playing'>('select');
  const [selectedFlashread, setSelectedFlashread] = useState<Flashread | null>(null);
  const [customText, setCustomText] = useState('');

  const handleStartWithFlashread = useCallback((flashread: Flashread) => {
    setSelectedFlashread(flashread);
    setMode('playing');
  }, []);

  const handleStartWithSample = useCallback(() => {
    setCustomText(SAMPLE_TEXT);
    setMode('playing');
  }, []);

  const handleStartWithCustom = useCallback(() => {
    if (customText.trim()) {
      setMode('playing');
    }
  }, [customText]);

  const handleExit = useCallback(() => {
    setMode('select');
    setSelectedFlashread(null);
  }, []);

  // Playing mode
  if (mode === 'playing') {
    return (
      <RsvpPlayer
        text={selectedFlashread ? undefined : customText}
        blocks={selectedFlashread?.rendered_blocks}
        title={selectedFlashread?.title}
        onExit={handleExit}
        initialWpm={300}
      />
    );
  }

  // Selection mode
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/app')}
            className="text-white/60 hover:text-white mb-4"
          >
            ← Back to Library
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">RSVP Mode</h1>
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded border border-amber-500/30">
              EXPERIMENTAL
            </span>
          </div>
          <p className="text-white/50">
            Rapid Serial Visual Presentation reading mode
          </p>
        </div>

        {/* Warning card */}
        <Card className="bg-amber-500/10 border-amber-500/30 mb-8">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <WarningIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 font-medium mb-1">Use with caution</p>
                <p className="text-amber-200/70 text-sm">
                  RSVP can reduce comprehension and increase fatigue for many readers. 
                  Use at your own discretion. This feature is experimental and not intended 
                  as a speed-reading solution.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mode selection */}
        <div className="space-y-6">
          {/* Quick start with sample */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Try with Sample Text</CardTitle>
              <CardDescription className="text-white/50">
                Experience RSVP with a pre-loaded sample passage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartWithSample} className="w-full">
                Start with Sample
              </Button>
            </CardContent>
          </Card>

          {/* Select from library */}
          {flashreads.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Select from Library</CardTitle>
                <CardDescription className="text-white/50">
                  Choose one of your saved FlashReads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {flashreads.map((flashread) => (
                    <button
                      key={flashread.id}
                      onClick={() => handleStartWithFlashread(flashread)}
                      className="w-full text-left p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-white truncate">
                        {flashread.title}
                      </div>
                      <div className="text-sm text-white/40 truncate">
                        {flashread.source_text.slice(0, 100)}...
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paste custom text */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Paste Custom Text</CardTitle>
              <CardDescription className="text-white/50">
                Enter or paste any text to read in RSVP mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste your text here..."
                className="w-full h-40 p-3 bg-zinc-800 border border-zinc-700 rounded-lg resize-none text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <Button
                onClick={handleStartWithCustom}
                disabled={!customText.trim()}
                className="w-full mt-4"
              >
                Start Reading
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <h3 className="text-white font-medium mb-3">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
            <div><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-xs">Space</kbd> Play/Pause</div>
            <div><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-xs">←</kbd> <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-xs">→</kbd> ±10 WPM</div>
            <div><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-xs">↓</kbd> ±50 WPM</div>
            <div><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-xs">R</kbd> Restart</div>
            <div><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-xs">Esc</kbd> Exit</div>
            <div>Click anywhere to toggle play</div>
          </div>
        </div>
      </div>
    </div>
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
