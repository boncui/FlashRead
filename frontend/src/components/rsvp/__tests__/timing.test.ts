import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_TIMING_CONFIG,
  getBaseInterval,
  getTokenDuration,
  getWordLengthMultiplier,
  getEaseInMultiplier,
  RsvpScheduler,
  getLengthFactor,
  getBoundaryPause,
  type RsvpTimingConfig,
} from '../timing';
import { tokenize, type RsvpToken } from '../rsvpTokenizer';

describe('DEFAULT_TIMING_CONFIG', () => {
  it('has granular punctuation multipliers', () => {
    expect(DEFAULT_TIMING_CONFIG.commaMultiplier).toBe(1.2);
    expect(DEFAULT_TIMING_CONFIG.semicolonMultiplier).toBe(1.5);
    expect(DEFAULT_TIMING_CONFIG.colonMultiplier).toBe(1.0);
    expect(DEFAULT_TIMING_CONFIG.periodMultiplier).toBe(2.2);
    expect(DEFAULT_TIMING_CONFIG.questionMultiplier).toBe(2.5);
    expect(DEFAULT_TIMING_CONFIG.exclamationMultiplier).toBe(2.0);
  });

  it('has phrase rhythm options', () => {
    expect(DEFAULT_TIMING_CONFIG.phraseBoundaryMultiplier).toBe(0.3);
    expect(DEFAULT_TIMING_CONFIG.enableLongRunRelief).toBe(true);
    expect(DEFAULT_TIMING_CONFIG.maxWordsWithoutPause).toBe(7);
  });
});

describe('getBaseInterval', () => {
  it('calculates correct interval for 300 WPM', () => {
    expect(getBaseInterval(300)).toBe(200); // 60000 / 300 = 200ms
  });

  it('calculates correct interval for 600 WPM', () => {
    expect(getBaseInterval(600)).toBe(100); // 60000 / 600 = 100ms
  });

  it('calculates correct interval for 150 WPM', () => {
    expect(getBaseInterval(150)).toBe(400); // 60000 / 150 = 400ms
  });
});

describe('getTokenDuration with granular punctuation', () => {
  const baseConfig: RsvpTimingConfig = {
    ...DEFAULT_TIMING_CONFIG,
    enableShortWordBoost: false,
    enableWordLengthTiming: false,
    enableEaseIn: false,
    enableParagraphEaseIn: false,
    enableLongRunRelief: false,
    phraseBoundaryMultiplier: 0,
  };

  function createToken(overrides: Partial<RsvpToken>): RsvpToken {
    return {
      text: 'word',
      isParagraphBreak: false,
      index: 0,
      endPunctuation: 'none',
      isShortWord: false,
      isSentenceEnd: false,
      isClauseEnd: false,
      wordLength: 4,
      paragraphIndex: 0,
      isPhraseBoundary: false,
      wordsSinceLastPause: 0,
      ...overrides,
    };
  }

  it('applies comma multiplier correctly', () => {
    const token = createToken({ text: 'word,', endPunctuation: 'comma' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 1.2) = 200 * 2.2 = 440ms
    expect(duration).toBeCloseTo(440);
  });

  it('applies semicolon multiplier correctly', () => {
    const token = createToken({ text: 'word;', endPunctuation: 'semicolon' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 1.5) = 200 * 2.5 = 500ms
    expect(duration).toBeCloseTo(500);
  });

  it('applies colon multiplier correctly', () => {
    const token = createToken({ text: 'word:', endPunctuation: 'colon' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 1.0) = 200 * 2.0 = 400ms
    expect(duration).toBeCloseTo(400);
  });

  it('applies period multiplier correctly', () => {
    const token = createToken({ text: 'word.', endPunctuation: 'period' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 2.2) = 200 * 3.2 = 640ms
    expect(duration).toBeCloseTo(640);
  });

  it('applies question multiplier correctly', () => {
    const token = createToken({ text: 'word?', endPunctuation: 'question' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 2.5) = 200 * 3.5 = 700ms
    expect(duration).toBeCloseTo(700);
  });

  it('applies exclamation multiplier correctly', () => {
    const token = createToken({ text: 'word!', endPunctuation: 'exclamation' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 2.0) = 200 * 3.0 = 600ms
    expect(duration).toBeCloseTo(600);
  });

  it('no extra time for no punctuation', () => {
    const token = createToken({ text: 'word', endPunctuation: 'none' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * 1 = 200ms
    expect(duration).toBeCloseTo(200);
  });
});

describe('getTokenDuration with phrase boundary', () => {
  const baseConfig: RsvpTimingConfig = {
    ...DEFAULT_TIMING_CONFIG,
    enableShortWordBoost: false,
    enableWordLengthTiming: false,
    enableEaseIn: false,
    enableParagraphEaseIn: false,
    enableLongRunRelief: false,
    phraseBoundaryMultiplier: 0.3,
  };

  function createToken(overrides: Partial<RsvpToken>): RsvpToken {
    return {
      text: 'word',
      isParagraphBreak: false,
      index: 0,
      endPunctuation: 'none',
      isShortWord: false,
      isSentenceEnd: false,
      isClauseEnd: false,
      wordLength: 4,
      paragraphIndex: 0,
      isPhraseBoundary: false,
      wordsSinceLastPause: 0,
      ...overrides,
    };
  }

  it('applies phrase boundary multiplier when no punctuation', () => {
    const token = createToken({ isPhraseBoundary: true, endPunctuation: 'none' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 0.3) = 200 * 1.3 = 260ms
    expect(duration).toBeCloseTo(260);
  });

  it('does not apply phrase boundary multiplier when punctuation present', () => {
    const token = createToken({ isPhraseBoundary: true, endPunctuation: 'comma' });
    const duration = getTokenDuration(token, baseConfig);
    // base 200ms * (1 + 1.2) = 200 * 2.2 = 440ms (no phrase boundary added)
    expect(duration).toBeCloseTo(440);
  });
});

describe('getTokenDuration with long-run relief', () => {
  const baseConfig: RsvpTimingConfig = {
    ...DEFAULT_TIMING_CONFIG,
    enableShortWordBoost: false,
    enableWordLengthTiming: false,
    enableEaseIn: false,
    enableParagraphEaseIn: false,
    enableLongRunRelief: true,
    phraseBoundaryMultiplier: 0,
  };

  function createToken(overrides: Partial<RsvpToken>): RsvpToken {
    return {
      text: 'word',
      isParagraphBreak: false,
      index: 0,
      endPunctuation: 'none',
      isShortWord: false,
      isSentenceEnd: false,
      isClauseEnd: false,
      wordLength: 4,
      paragraphIndex: 0,
      isPhraseBoundary: false,
      wordsSinceLastPause: 0,
      ...overrides,
    };
  }

  it('no relief for wordsSinceLastPause <= 5', () => {
    const token = createToken({ wordsSinceLastPause: 5 });
    const duration = getTokenDuration(token, baseConfig);
    expect(duration).toBeCloseTo(200); // No relief
  });

  it('applies relief for wordsSinceLastPause = 6', () => {
    const token = createToken({ wordsSinceLastPause: 6 });
    const duration = getTokenDuration(token, baseConfig);
    // relief = min(0.25, (6 - 5) * 0.05) = 0.05
    // base 200ms * (1 + 0.05) = 210ms
    expect(duration).toBeCloseTo(210);
  });

  it('applies relief for wordsSinceLastPause = 8', () => {
    const token = createToken({ wordsSinceLastPause: 8 });
    const duration = getTokenDuration(token, baseConfig);
    // relief = min(0.25, (8 - 5) * 0.05) = min(0.25, 0.15) = 0.15
    // base 200ms * (1 + 0.15) = 230ms
    expect(duration).toBeCloseTo(230);
  });

  it('caps relief at 0.25', () => {
    const token = createToken({ wordsSinceLastPause: 20 });
    const duration = getTokenDuration(token, baseConfig);
    // relief = min(0.25, (20 - 5) * 0.05) = min(0.25, 0.75) = 0.25
    // base 200ms * (1 + 0.25) = 250ms
    expect(duration).toBeCloseTo(250);
  });
});

describe('integrated timing with real tokens', () => {
  it('applies correct timing to sentence with various punctuation (classic model)', () => {
    const tokens = tokenize('Hello, how are you? I am fine!');
    // Disable new cadence model to test classic timing
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableShortWordBoost: false,
      enableWordLengthTiming: false,
      enableEaseIn: false,
      enableParagraphEaseIn: false,
      enableLongRunRelief: false,
      // Disable new cadence model features
      enableSyllableWeight: false,
      enableProsodyFactor: false,
      enableComplexityFactor: false,
    };

    // "Hello," - comma
    expect(getTokenDuration(tokens[0], config)).toBeCloseTo(440);
    // "how" - no punctuation (but might be phrase boundary before "are")
    // "are" - no punctuation
    // "you?" - question
    expect(tokens[3].endPunctuation).toBe('question');
    expect(getTokenDuration(tokens[3], config)).toBeCloseTo(700);
    // "fine!" - exclamation
    expect(tokens[6].endPunctuation).toBe('exclamation');
    expect(getTokenDuration(tokens[6], config)).toBeCloseTo(600);
  });

  it('applies phrase boundary timing to conjunctions (classic model)', () => {
    const tokens = tokenize('The dog and cat');
    // Disable new cadence model to test classic timing
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableShortWordBoost: false,
      enableWordLengthTiming: false,
      enableEaseIn: false,
      enableParagraphEaseIn: false,
      enableLongRunRelief: false,
      phraseBoundaryMultiplier: 0.3,
      // Disable new cadence model features
      enableSyllableWeight: false,
      enableProsodyFactor: false,
      enableComplexityFactor: false,
    };

    // "dog" should have phrase boundary timing
    expect(tokens[1].isPhraseBoundary).toBe(true);
    expect(getTokenDuration(tokens[1], config)).toBeCloseTo(260); // 200 * 1.3
  });
});

// ==================== SCHEDULER TESTS ====================

describe('RsvpScheduler', () => {
  let mockOnTick: ReturnType<typeof vi.fn>;
  let mockOnComplete: ReturnType<typeof vi.fn>;
  let rafCallbacks: Array<FrameRequestCallback> = [];
  let rafId = 0;
  
  beforeEach(() => {
    mockOnTick = vi.fn();
    mockOnComplete = vi.fn();
    rafCallbacks = [];
    rafId = 0;
    
    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return ++rafId;
    });
    
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      // No-op for tests
    });
  });
  
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  
  // Helper to flush pending RAF callbacks
  function flushRaf() {
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach(cb => cb(performance.now()));
  }
  
  function createScheduler(text: string = 'One two three four five') {
    const tokens = tokenize(text);
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableEaseIn: false,
      enableParagraphEaseIn: false,
      enableLongRunRelief: false,
    };
    return new RsvpScheduler(tokens, config, mockOnTick, mockOnComplete);
  }
  
  it('creates scheduler with correct initial state', () => {
    const scheduler = createScheduler();
    const state = scheduler.getState();
    
    expect(state.index).toBe(0);
    expect(state.isRunning).toBe(false);
    expect(state.progress).toBe(0);
    
    scheduler.destroy();
  });
  
  it('starts and calls onTick', () => {
    const scheduler = createScheduler();
    scheduler.start();
    
    const state = scheduler.getState();
    expect(state.isRunning).toBe(true);
    
    // Flush RAF to trigger the first tick
    flushRaf();
    expect(mockOnTick).toHaveBeenCalled();
    
    scheduler.destroy();
  });
  
  it('pauses correctly', () => {
    const scheduler = createScheduler();
    scheduler.start();
    flushRaf(); // Start the scheduler
    scheduler.pause();
    
    const state = scheduler.getState();
    expect(state.isRunning).toBe(false);
    
    scheduler.destroy();
  });
  
  it('stops and resets to beginning', () => {
    const scheduler = createScheduler();
    scheduler.start();
    flushRaf();
    scheduler.jumpTo(3);
    scheduler.stop();
    
    const state = scheduler.getState();
    expect(state.index).toBe(0);
    expect(state.isRunning).toBe(false);
    
    scheduler.destroy();
  });
  
  it('jumps to correct index', () => {
    const scheduler = createScheduler();
    scheduler.jumpTo(2);
    
    const state = scheduler.getState();
    expect(state.index).toBe(2);
    expect(mockOnTick).toHaveBeenCalledWith(2, expect.any(Object));
    
    scheduler.destroy();
  });
  
  it('clamps jumpTo within bounds', () => {
    const scheduler = createScheduler();
    
    scheduler.jumpTo(-5);
    expect(scheduler.getState().index).toBe(0);
    
    scheduler.jumpTo(1000);
    expect(scheduler.getState().index).toBe(4); // 5 tokens, max index is 4
    
    scheduler.destroy();
  });
  
  it('updates config correctly', () => {
    const scheduler = createScheduler();
    scheduler.jumpTo(2);
    scheduler.updateConfig({ wpm: 600 });
    
    // Should maintain position after config update
    expect(scheduler.getState().index).toBe(2);
    
    scheduler.destroy();
  });
  
  it('cleans up on destroy', () => {
    const scheduler = createScheduler();
    scheduler.start();
    flushRaf();
    scheduler.destroy();
    
    expect(scheduler.getState().isRunning).toBe(false);
  });
});

describe('RsvpScheduler telemetry', () => {
  let mockOnTick: ReturnType<typeof vi.fn>;
  let mockOnComplete: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockOnTick = vi.fn();
    mockOnComplete = vi.fn();
  });
  
  function createScheduler(text: string = 'One two three four five') {
    const tokens = tokenize(text);
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableEaseIn: false,
      enableParagraphEaseIn: false,
      enableLongRunRelief: false,
    };
    return new RsvpScheduler(tokens, config, mockOnTick, mockOnComplete);
  }
  
  it('returns null telemetry when not enabled', () => {
    const scheduler = createScheduler();
    expect(scheduler.getTelemetry()).toBe(null);
    scheduler.destroy();
  });
  
  it('initializes telemetry when enabled', () => {
    const scheduler = createScheduler();
    scheduler.enableTelemetry();
    
    const telemetry = scheduler.getTelemetry();
    expect(telemetry).not.toBe(null);
    expect(telemetry?.frameJitter).toEqual([]);
    expect(telemetry?.deadlineMisses).toBe(0);
    expect(telemetry?.catchupEvents).toBe(0);
    expect(telemetry?.tokensDisplayed).toBe(0);
    
    scheduler.destroy();
  });
  
  it('returns telemetry summary', () => {
    const scheduler = createScheduler();
    scheduler.enableTelemetry();
    
    const summary = scheduler.getTelemetrySummary();
    expect(summary).not.toBe(null);
    expect(summary?.p50Jitter).toBe(0);
    expect(summary?.deadlineMisses).toBe(0);
    expect(summary?.catchupEvents).toBe(0);
    
    scheduler.destroy();
  });
});

describe('Cadence model factors', () => {
  it('getLengthFactor returns correct values for syllable counts', () => {
    expect(getLengthFactor(1)).toBe(0.85);
    expect(getLengthFactor(2)).toBe(0.95);
    expect(getLengthFactor(3)).toBe(1.0);
    expect(getLengthFactor(4)).toBe(1.12);
    expect(getLengthFactor(5)).toBe(1.25);
    expect(getLengthFactor(6)).toBe(1.4);
  });
  
  it('getBoundaryPause returns correct values', () => {
    const baseInterval = 200; // 300 WPM
    
    expect(getBoundaryPause('none', baseInterval)).toBe(0);
    expect(getBoundaryPause('micro', baseInterval)).toBe(30); // 0.15 * 200
    expect(getBoundaryPause('clause', baseInterval)).toBe(80); // 0.4 * 200
    expect(getBoundaryPause('sentence', baseInterval)).toBe(180); // 0.9 * 200
    expect(getBoundaryPause('paragraph', baseInterval)).toBe(400); // 2.0 * 200
  });
  
  it('cadence model produces reasonable durations', () => {
    const tokens = tokenize('The quick brown fox jumps.');
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableEaseIn: false,
      enableParagraphEaseIn: false,
      // Enable new cadence model
      enableSyllableWeight: true,
      enableProsodyFactor: true,
      enableComplexityFactor: true,
    };
    
    // All durations should be positive and within bounds
    for (const token of tokens) {
      const duration = getTokenDuration(token, config);
      expect(duration).toBeGreaterThan(0);
      // With floor of 0.4 and cap of 4.0, at 300 WPM (200ms base):
      // Min: 200 * 0.4 = 80ms, Max: 200 * 4.0 + pause = ~1000ms
      expect(duration).toBeGreaterThanOrEqual(80);
      expect(duration).toBeLessThanOrEqual(1000);
    }
    
    // Sentence-ending token should have longer duration (boundary pause)
    const lastToken = tokens[tokens.length - 1];
    const firstToken = tokens[0];
    const lastDuration = getTokenDuration(lastToken, config);
    const firstDuration = getTokenDuration(firstToken, config);
    // "jumps." should be longer than "The" due to sentence boundary
    expect(lastDuration).toBeGreaterThan(firstDuration);
  });
  
  it('syllable count affects duration', () => {
    const tokens = tokenize('cat elephant');
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableEaseIn: false,
      enableParagraphEaseIn: false,
      enableSyllableWeight: true,
      enableProsodyFactor: false,
      enableComplexityFactor: false,
    };
    
    // "elephant" (3 syllables) should take longer than "cat" (1 syllable)
    const catDuration = getTokenDuration(tokens[0], config);
    const elephantDuration = getTokenDuration(tokens[1], config);
    expect(elephantDuration).toBeGreaterThan(catDuration);
  });
});

describe('RsvpScheduler WPM ramping', () => {
  let mockOnTick: ReturnType<typeof vi.fn>;
  let mockOnComplete: ReturnType<typeof vi.fn>;
  let rafCallbacks: Array<FrameRequestCallback> = [];
  let rafId = 0;
  
  beforeEach(() => {
    mockOnTick = vi.fn();
    mockOnComplete = vi.fn();
    rafCallbacks = [];
    rafId = 0;
    
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return ++rafId;
    });
    
    vi.stubGlobal('cancelAnimationFrame', (_id: number) => {});
  });
  
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  
  function createScheduler(text: string = 'One two three four five') {
    const tokens = tokenize(text);
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      wpm: 300,
      enableEaseIn: false,
      enableParagraphEaseIn: false,
      enableLongRunRelief: false,
      enableSmoothWpmRamp: true,
      wpmRampDuration: 500,
    };
    return new RsvpScheduler(tokens, config, mockOnTick, mockOnComplete);
  }
  
  it('returns base WPM when not ramping', () => {
    const scheduler = createScheduler();
    
    expect(scheduler.getEffectiveWpm()).toBe(300);
    expect(scheduler.isRamping()).toBe(false);
    
    scheduler.destroy();
  });
  
  it('starts ramping when WPM changes while running', () => {
    const scheduler = createScheduler();
    scheduler.start();
    
    // Flush RAF to actually start
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach(cb => cb(performance.now()));
    
    // Change WPM
    scheduler.updateConfig({ wpm: 400 });
    
    // Should be ramping
    expect(scheduler.isRamping()).toBe(true);
    
    // Effective WPM should be between 300 and 400
    const effectiveWpm = scheduler.getEffectiveWpm();
    expect(effectiveWpm).toBeGreaterThanOrEqual(300);
    expect(effectiveWpm).toBeLessThanOrEqual(400);
    
    scheduler.destroy();
  });
  
  it('does not ramp when not running', () => {
    const scheduler = createScheduler();
    
    // Change WPM while paused
    scheduler.updateConfig({ wpm: 400 });
    
    // Should NOT be ramping - instant change when paused
    expect(scheduler.isRamping()).toBe(false);
    expect(scheduler.getEffectiveWpm()).toBe(400);
    
    scheduler.destroy();
  });
  
  it('does not ramp when smooth ramp is disabled', () => {
    const tokens = tokenize('One two three four five');
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      wpm: 300,
      enableSmoothWpmRamp: false, // Disabled
    };
    const scheduler = new RsvpScheduler(tokens, config, mockOnTick, mockOnComplete);
    
    scheduler.start();
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach(cb => cb(performance.now()));
    
    scheduler.updateConfig({ wpm: 400 });
    
    // Should NOT be ramping
    expect(scheduler.isRamping()).toBe(false);
    
    scheduler.destroy();
  });
});
