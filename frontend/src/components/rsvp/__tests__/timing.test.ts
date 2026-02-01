import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_TIMING_CONFIG,
  getBaseInterval,
  getTokenDuration,
  getWordLengthMultiplier,
  getEaseInMultiplier,
  getLengthFactor,
  getBoundaryPause,
  calculateMomentumMultiplier,
  updateFlowMomentum,
  updateRollingAverage,
  calculateAverageCorrection,
  getFlowAdjustedDuration,
  type RsvpTimingConfig,
  type FlowState,
} from '../timing';
import { RsvpScheduler } from '../scheduler';
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
    // Disable new cadence model to test classic timing
    enableSyllableWeight: false,
    enableProsodyFactor: false,
    enableComplexityFactor: false,
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
      boundaryType: 'none',
      tokenComplexity: 0,
      estimatedSyllables: 1,
      isAbbreviation: false,
      isNumber: false,
      numberType: null,
      isCitation: false,
      isCodeLike: false,
      hasMathSymbols: false,
      hasOpeningPunctuation: false,
      hasClosingPunctuation: false,
      hasDash: false,
      isEasyWord: false,
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
    // Disable new cadence model to test classic timing
    enableSyllableWeight: false,
    enableProsodyFactor: false,
    enableComplexityFactor: false,
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
      boundaryType: 'none',
      tokenComplexity: 0,
      estimatedSyllables: 1,
      isAbbreviation: false,
      isNumber: false,
      numberType: null,
      isCitation: false,
      isCodeLike: false,
      hasMathSymbols: false,
      hasOpeningPunctuation: false,
      hasClosingPunctuation: false,
      hasDash: false,
      isEasyWord: false,
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
    // Disable new cadence model to test classic timing
    enableSyllableWeight: false,
    enableProsodyFactor: false,
    enableComplexityFactor: false,
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
      boundaryType: 'none',
      tokenComplexity: 0,
      estimatedSyllables: 1,
      isAbbreviation: false,
      isNumber: false,
      numberType: null,
      isCitation: false,
      isCodeLike: false,
      hasMathSymbols: false,
      hasOpeningPunctuation: false,
      hasClosingPunctuation: false,
      hasDash: false,
      isEasyWord: false,
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

describe('Adaptive flow timing', () => {
  describe('calculateMomentumMultiplier', () => {
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableMomentum: true,
      momentumBuildThreshold: 3,
      momentumMaxBoost: 0.15,
      momentumDecayRate: 0.5,
    };
    
    it('returns 1.0 when momentum is disabled', () => {
      const disabledConfig = { ...config, enableMomentum: false };
      expect(calculateMomentumMultiplier(10, disabledConfig)).toBe(1.0);
    });
    
    it('returns 1.0 before threshold is met', () => {
      expect(calculateMomentumMultiplier(0, config)).toBe(1.0);
      expect(calculateMomentumMultiplier(1, config)).toBe(1.0);
      expect(calculateMomentumMultiplier(2, config)).toBe(1.0);
    });
    
    it('builds momentum gradually after threshold', () => {
      const mult4 = calculateMomentumMultiplier(4, config); // 1 excess word
      const mult5 = calculateMomentumMultiplier(5, config); // 2 excess words
      const mult8 = calculateMomentumMultiplier(8, config); // 5 excess words
      
      // Momentum should build: 1.0 -> lower values (faster)
      expect(mult4).toBeLessThan(1.0);
      expect(mult5).toBeLessThan(mult4);
      expect(mult8).toBeLessThan(mult5);
      
      // Should approach maximum boost (0.85)
      expect(mult8).toBeGreaterThanOrEqual(0.85);
    });
    
    it('caps momentum at max boost', () => {
      const mult20 = calculateMomentumMultiplier(20, config);
      expect(mult20).toBeCloseTo(0.85); // 1.0 - 0.15 = 0.85
    });
  });
  
  describe('updateFlowMomentum', () => {
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
        boundaryType: 'none',
        tokenComplexity: 0,
        estimatedSyllables: 1,
        isAbbreviation: false,
        isNumber: false,
        numberType: null,
        isCitation: false,
        isCodeLike: false,
        hasMathSymbols: false,
        hasOpeningPunctuation: false,
        hasClosingPunctuation: false,
        hasDash: false,
        isEasyWord: false,
        ...overrides,
      };
    }
    
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableMomentum: true,
      momentumBuildThreshold: 3,
      momentumMaxBoost: 0.15,
      momentumDecayRate: 0.5,
    };
    
    it('builds momentum on consecutive easy words', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      // Add 5 easy words
      for (let i = 0; i < 5; i++) {
        const token = createToken({ isEasyWord: true });
        updateFlowMomentum(flowState, token, config);
      }
      
      expect(flowState.consecutiveEasyWords).toBe(5);
      expect(flowState.currentMomentum).toBeLessThan(1.0);
    });
    
    it('decays momentum on complex word', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 5,
        currentMomentum: 0.9,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      const complexToken = createToken({ isEasyWord: false });
      updateFlowMomentum(flowState, complexToken, config);
      
      // Should decay by 50% (config.momentumDecayRate)
      expect(flowState.consecutiveEasyWords).toBe(2); // floor(5 * 0.5)
      expect(flowState.currentMomentum).toBeGreaterThan(0.9); // Less momentum
    });
    
    it('resets momentum on paragraph break', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 5,
        currentMomentum: 0.9,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      const paragraphToken = createToken({ isParagraphBreak: true });
      updateFlowMomentum(flowState, paragraphToken, config);
      
      expect(flowState.consecutiveEasyWords).toBe(0);
      expect(flowState.currentMomentum).toBe(1.0);
    });
    
    it('resets momentum on sentence end', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 5,
        currentMomentum: 0.9,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      const sentenceEndToken = createToken({ isSentenceEnd: true });
      updateFlowMomentum(flowState, sentenceEndToken, config);
      
      expect(flowState.consecutiveEasyWords).toBe(0);
      expect(flowState.currentMomentum).toBe(1.0);
    });
  });
  
  describe('updateRollingAverage', () => {
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableAdaptivePacing: true,
      averageWindowSize: 10,
    };
    
    it('maintains sliding window of correct size', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      // Add 15 durations (window size is 10)
      for (let i = 0; i < 15; i++) {
        updateRollingAverage(flowState, 200, 200, config);
      }
      
      expect(flowState.recentDurations.length).toBe(10);
      expect(flowState.recentTargetDurations.length).toBe(10);
    });
    
    it('calculates deviation correctly when running slower', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      // Add durations where actual is 20% slower than target
      for (let i = 0; i < 10; i++) {
        updateRollingAverage(flowState, 240, 200, config); // 20% slower
      }
      
      // Deviation should be positive (too slow)
      expect(flowState.averageDeviation).toBeCloseTo(0.2);
    });
    
    it('calculates deviation correctly when running faster', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      // Add durations where actual is 20% faster than target
      for (let i = 0; i < 10; i++) {
        updateRollingAverage(flowState, 160, 200, config); // 20% faster
      }
      
      // Deviation should be negative (too fast)
      expect(flowState.averageDeviation).toBeCloseTo(-0.2);
    });
  });
  
  describe('calculateAverageCorrection', () => {
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      enableAdaptivePacing: true,
    };
    
    it('returns 1.0 when not enough samples', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [200, 200],
        recentTargetDurations: [200, 200],
        averageDeviation: 0,
      };
      
      expect(calculateAverageCorrection(flowState, config)).toBe(1.0);
    });
    
    it('applies correction when running too slow', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [240, 240, 240, 240, 240],
        recentTargetDurations: [200, 200, 200, 200, 200],
        averageDeviation: 0.2, // 20% too slow
      };
      
      const correction = calculateAverageCorrection(flowState, config);
      
      // Correction should be <1.0 to speed up
      expect(correction).toBeLessThan(1.0);
      expect(correction).toBeGreaterThanOrEqual(0.95); // Clamped to 95%
    });
    
    it('applies correction when running too fast', () => {
      const flowState: FlowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [160, 160, 160, 160, 160],
        recentTargetDurations: [200, 200, 200, 200, 200],
        averageDeviation: -0.2, // 20% too fast
      };
      
      const correction = calculateAverageCorrection(flowState, config);
      
      // Correction should be >1.0 to slow down
      expect(correction).toBeGreaterThan(1.0);
      expect(correction).toBeLessThanOrEqual(1.05); // Clamped to 105%
    });
  });
  
  describe('getFlowAdjustedDuration', () => {
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
        boundaryType: 'none',
        tokenComplexity: 0,
        estimatedSyllables: 1,
        isAbbreviation: false,
        isNumber: false,
        numberType: null,
        isCitation: false,
        isCodeLike: false,
        hasMathSymbols: false,
        hasOpeningPunctuation: false,
        hasClosingPunctuation: false,
        hasDash: false,
        isEasyWord: true,
        ...overrides,
      };
    }
    
    const config: RsvpTimingConfig = {
      ...DEFAULT_TIMING_CONFIG,
      wpm: 300,
      enableAdaptivePacing: true,
      enableMomentum: true,
      targetWpmVariance: 0.20,
    };
    
    it('returns base duration when adaptive pacing disabled', () => {
      const disabledConfig = { ...config, enableAdaptivePacing: false };
      const token = createToken({});
      const flowState: FlowState = {
        consecutiveEasyWords: 5,
        currentMomentum: 0.9,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      const duration = getFlowAdjustedDuration(200, token, flowState, disabledConfig);
      expect(duration).toBe(200);
    });
    
    it('applies momentum multiplier', () => {
      const token = createToken({});
      const flowState: FlowState = {
        consecutiveEasyWords: 5,
        currentMomentum: 0.9, // 10% speed boost
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      const duration = getFlowAdjustedDuration(200, token, flowState, config);
      
      // Should be faster than base (momentum <1.0)
      expect(duration).toBeLessThan(200);
      expect(duration).toBeCloseTo(180); // 200 * 0.9
    });
    
    it('enforces variance bounds', () => {
      const token = createToken({});
      const flowState: FlowState = {
        consecutiveEasyWords: 10,
        currentMomentum: 0.5, // Extreme momentum (would be 50% faster)
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
      
      const duration = getFlowAdjustedDuration(200, token, flowState, config);
      
      // Should be clamped by targetWpmVariance (±20%)
      // Min duration = 200 * (1 - 0.20) = 160
      expect(duration).toBeGreaterThanOrEqual(160);
    });
  });
});

describe('isEasyWord from tokenizer', () => {
  it('identifies easy words in common text', () => {
    const tokens = tokenize('The dog was in the house');
    
    // All should be easy words (common, short, no punctuation)
    // Filter out any paragraph breaks
    const wordTokens = tokens.filter(t => !t.isParagraphBreak);
    expect(wordTokens.every(t => t.isEasyWord)).toBe(true);
  });
  
  it('identifies complex words correctly', () => {
    const tokens = tokenize('The magnificently orchestrated symphony');
    
    // "The" should be easy
    expect(tokens[0].isEasyWord).toBe(true);
    
    // "magnificently", "orchestrated", "symphony" should NOT be easy (too long/complex)
    expect(tokens[1].isEasyWord).toBe(false);
    expect(tokens[2].isEasyWord).toBe(false);
    expect(tokens[3].isEasyWord).toBe(false);
  });
  
  it('identifies words with punctuation as not easy', () => {
    const tokens = tokenize('Hello, world!');
    
    // "Hello," has comma - not easy
    expect(tokens[0].isEasyWord).toBe(false);
    
    // "world!" has exclamation - not easy
    expect(tokens[1].isEasyWord).toBe(false);
  });
});
