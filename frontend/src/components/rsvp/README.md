# RSVP Reader System

A sophisticated speed reading system using RSVP (Rapid Serial Visual Presentation) with advanced timing algorithms.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design and data flow documentation.

## Key Features

### Smart Timing Engine
- **Cadence Model**: Syllable-based word length, prosody factors, complexity scoring
- **Domain Modes**: Specialized timing for prose, technical, math, and code content
- **Adaptive Flow**: Momentum building during easy sequences, rolling average correction
- **Punctuation-Aware**: Granular pause control for commas, periods, questions, etc.
- **Smooth Transitions**: WPM ramping with ease-out cubic interpolation

### ORP (Optimal Recognition Point)
- Centers eye fixation point for optimal reading
- Aligns text consistently regardless of word length
- Reduces eye movement and cognitive load

### Reading Progress
- Per-document position saving
- Resume from where you left off
- WPM history tracking

### User Settings
- Global per-user timing preferences
- Preset profiles (Factory, Casual, Speed, Technical, Comprehension)
- Auto-save with debouncing
- Customizable punctuation pauses, rhythm, complexity factors

### Telemetry (Instrumented)
- Session tracking
- Frame jitter monitoring
- Comprehension probes (framework ready)
- A/B testing support

## Quick Start

```typescript
import { RsvpPlayer } from '@/components/rsvp';

<RsvpPlayer
  text="Your text here..."
  documentId="doc-123"  // Optional: enables progress saving
  initialWpm={300}
  onExit={() => console.log('Exited RSVP mode')}
/>
```

## Core Components

### `RsvpPlayer`
Main composition root. Handles:
- Text/blocks input with optional filtering
- Settings and progress persistence
- Keyboard shortcuts
- UI layout (viewport, controls, panels)

### `RsvpScheduler`
Stateful playback engine. Features:
- RequestAnimationFrame-based timing loop
- Monotonic clock (prevents drift)
- Multi-token catch-up after backgrounding
- Auto-pause on tab visibility change
- WPM ramping support

### `RsvpControlsPanel` / `RsvpSettingsCard`
Settings UI in two themes:
- Dark theme (in-player drawer)
- Light theme (settings page card)
- Both use shared control components to avoid duplication

### Hooks

#### `useRsvpEngine`
Single point of scheduler ownership. Guarantees one RAF loop.

```typescript
const engine = useRsvpEngine({ text, config });

engine.play();
engine.pause();
engine.seek(100);
```

#### `useKeyboardShortcuts`
Keyboard shortcut handling with hold-to-accelerate.

```typescript
useKeyboardShortcuts({
  onTogglePlayPause: () => setIsPlaying(p => !p),
  onStepForward: () => advance(1),
  // ... more handlers
});
```

#### `useRsvpSettings`
Per-user settings persistence with auto-save.

```typescript
const { config, updateConfig, applyPreset } = useRsvpSettings();
```

#### `useReadingProgress`
Per-document position tracking.

```typescript
const { initialIndex, updateProgress, saveNow } = useReadingProgress({
  documentId: 'doc-123',
  tokens,
});
```

## File Structure

```
components/rsvp/
├── RsvpPlayer.tsx           # Main player component
├── RsvpControlsPanel.tsx    # Settings drawer (dark)
├── RsvpSettingsCard.tsx     # Settings card (light)
├── SyncedTextPanel.tsx      # Text panel with highlighting
│
├── scheduler.ts             # Playback scheduler (stateful)
├── timing.ts                # Timing calculations (pure functions)
├── rsvpTokenizer.ts         # Tokenization + enrichment
├── orp.ts                   # ORP calculation
├── presets.ts               # Preset configs
├── rsvpTelemetry.ts         # Telemetry service
├── wordFrequency.ts         # Word frequency data
│
├── hooks/
│   ├── useRsvpEngine.ts     # Engine lifecycle hook
│   └── useKeyboardShortcuts.ts  # Keyboard handling
│
├── controls/
│   └── SharedControls.tsx   # Reusable control components
│
├── __tests__/
│   ├── timing.test.ts
│   ├── tokenizer.test.ts
│   ├── orp.test.ts
│   └── telemetry.test.ts
│
├── index.ts                 # Public exports
├── ARCHITECTURE.md          # System design doc
└── README.md                # This file
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` / `→` | Step backward/forward (hold to accelerate) |
| `↑` / `↓` | Increase/decrease WPM by 10 |
| `T` | Toggle text panel |
| `S` | Toggle settings |
| `R` | Restart from beginning |
| `Esc` | Exit RSVP mode |

## Configuration

### Timing Config

```typescript
interface RsvpTimingConfig {
  wpm: number;  // Words per minute
  
  // Punctuation pauses (multipliers)
  commaMultiplier: number;
  periodMultiplier: number;
  questionMultiplier: number;
  // ... more
  
  // Rhythm & flow
  phraseBoundaryMultiplier: number;
  enableLongRunRelief: boolean;
  enableParagraphEaseIn: boolean;
  
  // Word complexity
  enableShortWordBoost: boolean;
  enableComplexityFactor: boolean;
  enableSyllableWeight: boolean;
  
  // Domain mode
  domainMode: 'prose' | 'technical' | 'math' | 'code';
  
  // Momentum
  enableMomentum: boolean;
  momentumMaxBoost: number;  // Max 15% speed boost
  momentumDecayRate: number;  // Decay on complex words
}
```

### Presets

Five built-in presets:

1. **Factory** (Default): Balanced for general reading
2. **Casual**: Slower with longer pauses (250 WPM)
3. **Speed**: Minimal pauses for experienced readers (400 WPM)
4. **Technical**: Extra time for complexity and citations (280 WPM)
5. **Comprehension**: Maximum pauses for difficult text (220 WPM)

## Testing

```bash
# Run tests
npm run test

# Watch mode
npm run test:watch
```

Tests cover:
- Timing calculations
- Tokenization edge cases
- ORP calculation
- Telemetry service

## Design Principles

### Single Scheduler Instance
Only one RAF loop runs at a time. Enforced by `useRsvpEngine` hook.

### Pure Functions vs Stateful Classes
- **Timing functions** are pure: `(token, config) => duration`
- **Scheduler** is stateful: manages RAF loop, visibility, telemetry

### Monotonic Clock
Scheduler uses `performance.now()` to prevent drift. Elapsed time determines token advancement, not frame count.

### Separation of Concerns
- **Tokenizer**: Text → Enriched tokens
- **Timing**: Token + Config → Duration
- **Scheduler**: Durations → Playback
- **React**: Scheduler callbacks → UI updates

### No Double RAF Loops
Common pitfall: recreating scheduler on config change. Solution: single scheduler instance, update config separately.

## Performance

- **Frame-accurate timing**: Uses requestAnimationFrame
- **Multi-token catch-up**: Handles backgrounded tabs gracefully
- **Telemetry**: Optional frame jitter monitoring
- **WPM ramping**: Smooth transitions without jarring jumps

## Future Enhancements

1. **Telemetry Integration**: Wire service to track sessions, pauses, speed changes
2. **Comprehension Probes**: Periodic questions to verify understanding
3. **Adaptive WPM**: Auto-adjust based on comprehension probe results
4. **Multi-Column Layout**: Display 2-3 words simultaneously
5. **Voice Synthesis**: Optional audio output synchronized with display

## Research & References

- **ORP**: Optimal Recognition Point research (Rayner, 1998)
- **RSVP Timing**: TTS pause research for natural speech rhythm
- **Syllable Estimation**: Kahn algorithm for English syllabification
- **Word Frequency**: Top 1k/5k/20k English words for complexity scoring

## License

See project root LICENSE file.
