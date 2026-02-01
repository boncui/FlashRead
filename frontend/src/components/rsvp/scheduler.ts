/**
 * RSVP Scheduler
 * 
 * Handles the playback timing loop and state management for RSVP reading.
 * Separated from pure timing functions for better organization.
 */

import type { RsvpToken } from './rsvpTokenizer';
import {
  type RsvpTimingConfig,
  type WpmRampState,
  type FlowState,
  getTokenDuration,
  getFlowAdjustedDuration,
  updateFlowMomentum,
  updateRollingAverage,
} from './timing';

/**
 * Telemetry data collected by the scheduler for performance analysis.
 */
export interface SchedulerTelemetry {
  /** Frame-to-frame time deviation from expected 16.67ms (ms) */
  frameJitter: number[];
  /** Count of tokens displayed later than expected (>50ms late) */
  deadlineMisses: number;
  /** Actual WPM achieved, sampled every 10 tokens */
  effectiveWpmSamples: number[];
  /** Times we advanced more than 1 token per frame (catch-up events) */
  catchupEvents: number;
  /** Start time for session duration calculation */
  sessionStartTime: number;
  /** Total tokens displayed */
  tokensDisplayed: number;
}

/** Maximum tokens to catch up in a single frame to prevent freezing */
const MAX_CATCHUP_TOKENS = 10;

/**
 * RSVP Scheduler - handles timing for word display
 * 
 * Features:
 * - Monotonic clock to prevent drift
 * - Visibility change handling (auto-pause when tab hidden)
 * - Multi-token catch-up when returning from background
 * - Optional telemetry instrumentation
 */
export class RsvpScheduler {
  private tokens: RsvpToken[];
  private config: RsvpTimingConfig;
  private currentIndex: number = 0;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private accumulatedTime: number = 0;
  private animationFrameId: number | null = null;
  private onTick: (index: number, token: RsvpToken) => void;
  private onComplete: () => void;
  
  // Visibility handling
  private isHidden: boolean = false;
  private pausedByVisibility: boolean = false;
  private visibilityHandler: (() => void) | null = null;
  
  // Telemetry
  private telemetry: SchedulerTelemetry | null = null;
  private lastFrameTime: number = 0;
  private lastTelemetryIndex: number = 0;
  private lastTelemetryTime: number = 0;
  
  // WPM ramping
  private wpmRamp: WpmRampState | null = null;
  
  // Adaptive flow timing state
  private flowState: FlowState | null = null;
  
  constructor(
    tokens: RsvpToken[],
    config: RsvpTimingConfig,
    onTick: (index: number, token: RsvpToken) => void,
    onComplete: () => void
  ) {
    this.tokens = tokens;
    this.config = config;
    this.onTick = onTick;
    this.onComplete = onComplete;
    
    // Initialize flow state if adaptive pacing is enabled
    if (config.enableAdaptivePacing) {
      this.flowState = {
        consecutiveEasyWords: 0,
        currentMomentum: 1.0,
        recentDurations: [],
        recentTargetDurations: [],
        averageDeviation: 0,
      };
    }
    
    // Set up visibility change handling
    this.setupVisibilityHandling();
  }
  
  /**
   * Set up visibility change listener to auto-pause/resume on tab switch.
   */
  private setupVisibilityHandling(): void {
    if (typeof document === 'undefined') return;
    
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.isHidden = true;
        if (this.isRunning) {
          this.pausedByVisibility = true;
          this.pause();
        }
      } else {
        this.isHidden = false;
        if (this.pausedByVisibility) {
          this.pausedByVisibility = false;
          this.start();
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }
  
  /**
   * Enable telemetry collection for performance analysis.
   */
  enableTelemetry(): void {
    this.telemetry = {
      frameJitter: [],
      deadlineMisses: 0,
      effectiveWpmSamples: [],
      catchupEvents: 0,
      sessionStartTime: performance.now(),
      tokensDisplayed: 0,
    };
    this.lastFrameTime = 0;
    this.lastTelemetryIndex = 0;
    this.lastTelemetryTime = 0;
  }
  
  /**
   * Get collected telemetry data.
   */
  getTelemetry(): SchedulerTelemetry | null {
    return this.telemetry;
  }
  
  /**
   * Get telemetry summary with computed statistics.
   */
  getTelemetrySummary(): {
    p50Jitter: number;
    p95Jitter: number;
    p99Jitter: number;
    deadlineMisses: number;
    catchupEvents: number;
    avgEffectiveWpm: number;
    tokensDisplayed: number;
    sessionDuration: number;
  } | null {
    if (!this.telemetry) return null;
    
    const jitter = [...this.telemetry.frameJitter].sort((a, b) => a - b);
    const p50 = jitter[Math.floor(jitter.length * 0.5)] || 0;
    const p95 = jitter[Math.floor(jitter.length * 0.95)] || 0;
    const p99 = jitter[Math.floor(jitter.length * 0.99)] || 0;
    
    const avgWpm = this.telemetry.effectiveWpmSamples.length > 0
      ? this.telemetry.effectiveWpmSamples.reduce((a, b) => a + b, 0) / this.telemetry.effectiveWpmSamples.length
      : 0;
    
    return {
      p50Jitter: p50,
      p95Jitter: p95,
      p99Jitter: p99,
      deadlineMisses: this.telemetry.deadlineMisses,
      catchupEvents: this.telemetry.catchupEvents,
      avgEffectiveWpm: avgWpm,
      tokensDisplayed: this.telemetry.tokensDisplayed,
      sessionDuration: performance.now() - this.telemetry.sessionStartTime,
    };
  }
  
  /**
   * Record telemetry for current frame.
   */
  private recordTelemetry(elapsed: number, expectedTime: number, catchupCount: number): void {
    if (!this.telemetry) return;
    
    const now = performance.now();
    
    // Record frame jitter
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      const expectedDelta = 16.67; // 60fps
      this.telemetry.frameJitter.push(Math.abs(frameDelta - expectedDelta));
      
      // Keep array from growing unbounded (keep last 1000 samples)
      if (this.telemetry.frameJitter.length > 1000) {
        this.telemetry.frameJitter.shift();
      }
    }
    this.lastFrameTime = now;
    
    // Record deadline misses (>50ms late)
    if (elapsed > expectedTime + 50) {
      this.telemetry.deadlineMisses++;
    }
    
    // Record catch-up events
    if (catchupCount > 1) {
      this.telemetry.catchupEvents++;
    }
    
    // Record effective WPM every 10 tokens
    this.telemetry.tokensDisplayed++;
    if (this.currentIndex - this.lastTelemetryIndex >= 10) {
      const timeDelta = now - this.lastTelemetryTime;
      if (timeDelta > 0 && this.lastTelemetryTime > 0) {
        const tokensDelta = this.currentIndex - this.lastTelemetryIndex;
        const effectiveWpm = (tokensDelta / timeDelta) * 60_000;
        this.telemetry.effectiveWpmSamples.push(effectiveWpm);
      }
      this.lastTelemetryIndex = this.currentIndex;
      this.lastTelemetryTime = now;
    }
  }
  
  /**
   * Start or resume playback.
   */
  start(): void {
    if (this.isRunning) return;
    if (this.isHidden) return; // Don't start if tab is hidden
    
    if (this.currentIndex >= this.tokens.length) {
      this.currentIndex = 0;
      this.accumulatedTime = 0;
    }
    
    this.isRunning = true;
    this.startTime = performance.now() - this.accumulatedTime;
    
    // Initialize telemetry timing if enabled
    if (this.telemetry && this.lastTelemetryTime === 0) {
      this.lastTelemetryTime = performance.now();
      this.lastTelemetryIndex = this.currentIndex;
    }
    
    this.scheduleNextTick();
  }
  
  /**
   * Pause playback.
   */
  pause(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.accumulatedTime = performance.now() - this.startTime;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Stop and reset to beginning.
   */
  stop(): void {
    this.pause();
    this.currentIndex = 0;
    this.accumulatedTime = 0;
  }
  
  /**
   * Jump to a specific token index.
   */
  jumpTo(index: number): void {
    const wasRunning = this.isRunning;
    this.pause();
    
    this.currentIndex = Math.max(0, Math.min(index, this.tokens.length - 1));
    this.accumulatedTime = this.calculateTimeToIndex(this.currentIndex);
    
    if (this.tokens[this.currentIndex]) {
      this.onTick(this.currentIndex, this.tokens[this.currentIndex]);
    }
    
    if (wasRunning) {
      this.start();
    }
  }
  
  /**
   * Update WPM on the fly with optional smooth ramping.
   */
  updateConfig(config: Partial<RsvpTimingConfig>): void {
    // Check if WPM is changing and smooth ramp is enabled
    if (
      config.wpm !== undefined && 
      config.wpm !== this.config.wpm && 
      this.config.enableSmoothWpmRamp &&
      this.isRunning
    ) {
      // Start smooth ramp instead of instant change
      this.wpmRamp = {
        targetWpm: config.wpm,
        startWpm: this.getEffectiveWpm(),
        rampStartTime: performance.now(),
        rampDuration: this.config.wpmRampDuration,
      };
      
      // Update config but don't pause - ramp handles the transition
      this.config = { ...this.config, ...config };
      return;
    }
    
    // For non-WPM changes or when smooth ramp is disabled, use old behavior
    const wasRunning = this.isRunning;
    if (wasRunning) this.pause();
    
    this.config = { ...this.config, ...config };
    
    // Clear any active ramp when WPM changes without ramping
    if (config.wpm !== undefined) {
      this.wpmRamp = null;
    }
    
    // Recalculate accumulated time for current position
    this.accumulatedTime = this.calculateTimeToIndex(this.currentIndex);
    
    if (wasRunning) this.start();
  }
  
  /**
   * Get the current effective WPM, accounting for any active ramp.
   */
  getEffectiveWpm(): number {
    if (!this.wpmRamp) return this.config.wpm;
    
    const now = performance.now();
    const elapsed = now - this.wpmRamp.rampStartTime;
    const t = Math.min(1, elapsed / this.wpmRamp.rampDuration);
    
    // Ease-out cubic: fast start, gentle end
    // f(t) = 1 - (1-t)^3
    const eased = 1 - Math.pow(1 - t, 3);
    
    const currentWpm = this.wpmRamp.startWpm + 
      (this.wpmRamp.targetWpm - this.wpmRamp.startWpm) * eased;
    
    // Clear ramp when complete
    if (t >= 1) {
      this.wpmRamp = null;
    }
    
    return currentWpm;
  }
  
  /**
   * Check if a WPM ramp is currently active.
   */
  isRamping(): boolean {
    return this.wpmRamp !== null;
  }
  
  /**
   * Get current timing config, with effective WPM if ramping.
   */
  private getCurrentConfig(): RsvpTimingConfig {
    return {
      ...this.config,
      wpm: this.getEffectiveWpm(),
    };
  }
  
  /**
   * Get current state.
   */
  getState(): { index: number; isRunning: boolean; progress: number; isPausedByVisibility: boolean } {
    return {
      index: this.currentIndex,
      isRunning: this.isRunning,
      progress: this.tokens.length > 0 
        ? (this.currentIndex / this.tokens.length) * 100 
        : 0,
      isPausedByVisibility: this.pausedByVisibility,
    };
  }
  
  /**
   * Check if currently paused due to tab visibility.
   */
  isPausedByVisibility(): boolean {
    return this.pausedByVisibility;
  }
  
  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.pause();
    this.tokens = [];
    
    // Remove visibility listener
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
  
  private calculateTimeToIndex(targetIndex: number): number {
    let time = 0;
    for (let i = 0; i < targetIndex && i < this.tokens.length; i++) {
      time += this.getTokenDurationWithFlow(this.tokens[i], this.config);
    }
    return time;
  }
  
  /**
   * Get token duration with flow adjustments if adaptive pacing is enabled.
   */
  private getTokenDurationWithFlow(token: RsvpToken, config: RsvpTimingConfig): number {
    // Get base duration from existing cadence model
    const baseDuration = getTokenDuration(token, config);
    
    // Apply flow adjustments if enabled
    if (this.flowState) {
      return getFlowAdjustedDuration(baseDuration, token, this.flowState, config);
    }
    
    return baseDuration;
  }
  
  private scheduleNextTick(): void {
    if (!this.isRunning) return;
    
    this.animationFrameId = requestAnimationFrame(() => {
      if (!this.isRunning) return;
      
      const elapsed = performance.now() - this.startTime;
      
      // Use effective config which accounts for WPM ramping
      const effectiveConfig = this.getCurrentConfig();
      let timeAtCurrentIndex = this.calculateTimeToIndexWithConfig(this.currentIndex, effectiveConfig);
      
      // Allow catching up multiple tokens (e.g., after returning from background tab)
      // but cap to prevent UI freeze
      let catchupCount = 0;
      
      while (catchupCount < MAX_CATCHUP_TOKENS && this.currentIndex < this.tokens.length - 1) {
        const token = this.tokens[this.currentIndex];
        const baseDuration = getTokenDuration(token, effectiveConfig);
        
        // Apply flow adjustments and update flow state
        let tokenDuration = baseDuration;
        if (this.flowState) {
          // Update momentum before calculating duration
          updateFlowMomentum(this.flowState, token, effectiveConfig);
          
          // Get flow-adjusted duration
          tokenDuration = getFlowAdjustedDuration(baseDuration, token, this.flowState, effectiveConfig);
          
          // Update rolling average after using the duration
          updateRollingAverage(this.flowState, tokenDuration, baseDuration, effectiveConfig);
        }
        
        const timeAtNextIndex = timeAtCurrentIndex + tokenDuration;
        
        if (elapsed < timeAtNextIndex) break;
        
        this.currentIndex++;
        timeAtCurrentIndex = timeAtNextIndex;
        catchupCount++;
      }
      
      // Fire tick for current position
      if (this.tokens[this.currentIndex]) {
        this.onTick(this.currentIndex, this.tokens[this.currentIndex]);
      }
      
      // Record telemetry if enabled
      this.recordTelemetry(elapsed, timeAtCurrentIndex, catchupCount);
      
      // Check for completion
      if (this.currentIndex >= this.tokens.length - 1) {
        const token = this.tokens[this.currentIndex];
        const baseDuration = getTokenDuration(token, effectiveConfig);
        let finalDuration = baseDuration;
        
        if (this.flowState) {
          finalDuration = getFlowAdjustedDuration(baseDuration, token, this.flowState, effectiveConfig);
        }
        
        if (elapsed >= timeAtCurrentIndex + finalDuration) {
          this.isRunning = false;
          this.onComplete();
          return;
        }
      }
      
      // Schedule next frame
      this.scheduleNextTick();
    });
  }
  
  /**
   * Calculate time to index using a specific config (for ramping support).
   */
  private calculateTimeToIndexWithConfig(targetIndex: number, config: RsvpTimingConfig): number {
    let time = 0;
    for (let i = 0; i < targetIndex && i < this.tokens.length; i++) {
      time += this.getTokenDurationWithFlow(this.tokens[i], config);
    }
    return time;
  }
}
