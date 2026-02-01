# RSVP System Architecture

This document describes the architecture of the RSVP (Rapid Serial Visual Presentation) reading system.

## Overview

The RSVP system displays text one word at a time at configurable speeds, with sophisticated timing algorithms that account for word complexity, punctuation, and reading flow.

## Data Flow

```
Text/Blocks → Tokenizer → Tokens → Scheduler → Display
                                        ↓
                                   Timing Config
```

### 1. Text Input
- Plain text string OR structured blocks (from Flashread documents)
- Optional content filtering (removes page numbers, footnotes, captions)

### 2. Tokenization (`rsvpTokenizer.ts`)
- Splits text into tokens (words + paragraph breaks)
- Enriches each token with metadata:
  - ORP (Optimal Recognition Point) for eye fixation
  - Syllable count estimation
  - Word complexity score (frequency, morphology)
  - Boundary type (micro/clause/sentence/paragraph)
  - Prosody markers (parentheticals, quotes, dashes)
  - Domain-specific flags (math symbols, code-like, citations)

### 3. Timing Calculation (`timing.ts`)
Pure functions that calculate display duration for each token:

**Base Duration:**
```typescript
baseInterval = 60_000 / wpm  // milliseconds per word
```

**Cadence Model Factors:**
1. **Length Factor** - Syllable-based scaling (1-syllable = 0.85x, 6+ = 1.55x)
2. **Prosody Factor** - Breath groups, parentheticals, quotes (1.0-1.35x)
3. **Complexity Factor** - Word rarity, morphology (1.0-1.35x)
4. **Domain Factor** - Math/code/technical content (1.0-1.4x)
5. **Boundary Pause** - Punctuation-based pauses (added to duration)

**Flow Adjustments (optional):**
- **Momentum** - Speed boost during easy word sequences (up to 15% faster)
- **Rolling Average Correction** - Keeps overall WPM near target

### 4. Scheduling (`scheduler.ts`)
The scheduler is a stateful class that:
- Manages playback state (play/pause/seek)
- Runs a requestAnimationFrame loop
- Advances currentIndex when elapsed time exceeds scheduled time
- Handles multi-token catch-up (after tab backgrounding)
- Auto-pauses when tab is hidden
- Supports smooth WPM ramping (ease-out cubic)
- Collects telemetry (frame jitter, deadline misses)

**Key insight:** The scheduler uses a **monotonic clock** to prevent drift:
```typescript
elapsed = performance.now() - startTime
if (elapsed >= timeToNextToken) {
  advanceToNextToken()
}
```

### 5. Display (`RsvpPlayer.tsx`)
React component that:
- Owns scheduler instance (single source of truth)
- Renders current word with ORP alignment
- Shows controls (play/pause, WPM, progress bar)
- Handles keyboard shortcuts
- Manages synced text panel and settings drawer

## State Ownership

### React State (in RsvpPlayer)
- `currentIndex` - Token currently displayed (updated by scheduler callback)
- `isPlaying` - Play/pause state
- `wpm` - Current WPM setting
- `showControls`, `showTextPanel`, `showSettingsPanel` - UI visibility

### Scheduler Internal State
- `accumulatedTime` - Elapsed playback time (pauses when paused)
- `animationFrameId` - RAF handle
- `wpmRamp` - Active WPM transition state
- `flowState` - Momentum and rolling average tracking

### Persistence
- **Reading Progress** (`useReadingProgress`) - Per-document position + WPM
- **User Settings** (`useRsvpSettings`) - Per-user timing config

## Synchronization Points

### 1. Token Change (Scheduler → React)
```typescript
scheduler.onTick = (index, token) => setCurrentIndex(index)
```
- Scheduler advances index based on timing
- React re-renders with new token

### 2. WPM Change (React → Scheduler)
```typescript
setWpm(newWpm)
scheduler.updateConfig({ wpm: newWpm })
```
- User adjusts WPM via slider/keyboard
- Scheduler recalculates timing, optionally ramps smoothly

### 3. Play/Pause (React → Scheduler)
```typescript
setIsPlaying(true)
scheduler.start()
```
- React manages play/pause button state
- Scheduler starts/stops RAF loop

### 4. Seek (React → Scheduler)
```typescript
scheduler.jumpTo(newIndex)
setCurrentIndex(newIndex)
```
- User clicks progress bar or word in text panel
- Scheduler recalculates accumulated time, updates position

## Component Hierarchy

```
RsvpPlayer (composition root)
├── SyncedTextPanel (left drawer)
│   └── Word highlighting synced to currentIndex
├── RsvpControlsPanel (right drawer)
│   └── Timing config controls (WPM, punctuation, etc.)
├── Word Display (center)
│   └── ORP-aligned word rendering
└── Controls Overlay (bottom)
    ├── Play/Pause button
    ├── Progress bar (scrubber)
    ├── WPM drag control
    └── Keyboard shortcuts hint
```

## Key Design Decisions

### Why Separate Scheduler from Timing Functions?
- **Timing functions** are pure: `(token, config) => duration`
- **Scheduler** is stateful: manages RAF loop, visibility, telemetry
- Separation enables:
  - Easy testing of timing logic
  - Reusable timing functions outside RSVP context
  - Single scheduler instance (prevents multiple RAF loops)

### Why NOT Use `setInterval`?
- `setInterval` drifts over time (accumulates error)
- Scheduler uses monotonic clock + RAF for frame-accurate timing
- Can catch up multiple tokens if running behind

### Why Separate Settings from Progress?
- **Settings** (timing config) are per-user, persist globally
- **Progress** (position, WPM) is per-document
- Document progress can override global WPM for resuming

### Why Use Callbacks Instead of Events?
- Scheduler only needs to notify React of two things:
  1. Token changed (`onTick`)
  2. Playback complete (`onComplete`)
- Callbacks are simpler and more direct than event emitters

## File Organization

```
frontend/src/components/rsvp/
├── RsvpPlayer.tsx           # Main composition root (React component)
├── RsvpControlsPanel.tsx    # Settings drawer (dark theme)
├── RsvpSettingsCard.tsx     # Settings page card (light theme)
├── SyncedTextPanel.tsx      # Text panel with word highlighting
├── scheduler.ts             # Stateful playback scheduler
├── timing.ts                # Pure timing calculations
├── rsvpTokenizer.ts         # Text → tokens transformation
├── orp.ts                   # ORP calculation for eye fixation
├── presets.ts               # Preset timing configs
├── rsvpTelemetry.ts         # Telemetry service (not yet integrated)
├── wordFrequency.ts         # Word frequency data (1k/5k/20k)
├── index.ts                 # Public exports
├── ARCHITECTURE.md          # This file
└── __tests__/               # Unit tests
    ├── timing.test.ts
    ├── tokenizer.test.ts
    ├── orp.test.ts
    └── telemetry.test.ts
```

## Common Pitfalls

### ❌ Creating Multiple Schedulers
```typescript
// DON'T - creates new scheduler on every config change
useEffect(() => {
  const scheduler = new RsvpScheduler(tokens, config, onTick, onComplete)
  return () => scheduler.destroy()
}, [tokens, config]) // ← includes config
```

### ✅ Single Scheduler, Update Config
```typescript
// DO - create once, update config separately
useEffect(() => {
  const scheduler = new RsvpScheduler(tokens, config, onTick, onComplete)
  return () => scheduler.destroy()
}, [tokens]) // Only recreate on text change

useEffect(() => {
  scheduler?.updateConfig({ wpm })
}, [wpm])
```

### ❌ Forgetting to Clean Up RAF
```typescript
// DON'T - RAF keeps running after unmount
useEffect(() => {
  scheduler.start()
  // Missing cleanup!
}, [])
```

### ✅ Clean Up in useEffect Return
```typescript
// DO - destroy scheduler on unmount
useEffect(() => {
  const scheduler = new RsvpScheduler(...)
  return () => scheduler.destroy() // ← cancels RAF
}, [tokens])
```

## Future Improvements

### Telemetry Integration (Phase 5)
- Wire `RsvpTelemetryService` to scheduler events
- Track: session duration, pauses, speed changes, comprehension probes
- Export data for analysis

### Performance Monitoring
- Use `scheduler.enableTelemetry()` to collect frame jitter
- Alert user if p95 jitter > 10ms (dropping frames)
- Suggest reducing WPM or closing other tabs

### Adaptive WPM
- Use comprehension probes to adjust WPM automatically
- If user misses probes → reduce WPM
- If user aces probes → increase WPM

### Multi-Column Layout
- Display 2-3 words simultaneously for faster reading
- Research shows some readers prefer this over single-word RSVP
