'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RsvpPlayer } from '@/components/rsvp';

const MAX_WORDS = 150;

const SAMPLE_TEXT = `The human brain processes visual information at remarkable speeds. When reading traditionally, our eyes make small jumps called saccades, pausing briefly on words before moving to the next. This process, while natural, limits how fast we can read.

RSVP (Rapid Serial Visual Presentation) changes this by displaying words one at a time in the same location. This eliminates eye movement entirely, allowing the brain to focus purely on processing each word. The red letter you see marks the optimal recognition point—where your eye naturally focuses.

Try adjusting the speed with arrow keys to find your comfort zone.`;

export function RsvpDemo() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [showPlayer, setShowPlayer] = useState(false);

  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [text]);

  const isOverLimit = wordCount > MAX_WORDS;
  const isEmpty = wordCount === 0;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleTryRsvp = () => {
    if (!isEmpty && !isOverLimit) {
      setShowPlayer(true);
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Try RSVP Speed Reading
          </CardTitle>
          <CardDescription>
            Paste your own text or use the sample below. Max {MAX_WORDS} words.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder="Paste your text here..."
              className="w-full h-48 p-4 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm leading-relaxed"
            />
            <div
              className={`absolute bottom-3 right-3 text-xs px-2 py-1 rounded ${
                isOverLimit
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {wordCount} / {MAX_WORDS} words
            </div>
          </div>

          {isOverLimit && (
            <p className="text-sm text-destructive">
              Text exceeds {MAX_WORDS} words. Please shorten it to try the demo.
            </p>
          )}

          <div className="flex items-center gap-4">
            <Button
              onClick={handleTryRsvp}
              disabled={isEmpty || isOverLimit}
              size="lg"
              className="flex-1 sm:flex-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="mr-2"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Launch RSVP
            </Button>
            <button
              onClick={() => setText(SAMPLE_TEXT)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset to sample
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-2 border-t">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Space</kbd>
              Play/Pause
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">↑↓</kbd>
              Speed
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">←→</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Esc</kbd>
              Exit
            </span>
          </div>
        </CardContent>
      </Card>

      {showPlayer && (
        <RsvpPlayer
          text={text}
          title="RSVP Demo"
          onExit={() => setShowPlayer(false)}
          initialWpm={220}
        />
      )}
    </>
  );
}
