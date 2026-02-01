/**
 * RSVP Telemetry Service
 * 
 * Provides event dispatch and session tracking for A/B testing
 * and comprehension analysis of the RSVP reader.
 */

import type { RsvpTimingConfig } from './timing';

// ==================== EVENT TYPES ====================

/**
 * Base telemetry event
 */
export interface RsvpTelemetryEvent {
  /** Event type identifier */
  type: string;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Optional document ID */
  documentId?: string;
}

/**
 * Session start event - fired when RSVP player mounts
 */
export interface RsvpSessionStartEvent extends RsvpTelemetryEvent {
  type: 'rsvp_session_start';
  /** Total tokens in document */
  tokenCount: number;
  /** Initial WPM setting */
  initialWpm: number;
  /** Active feature flags/variant */
  variant?: string;
  /** Device type */
  deviceType: 'desktop' | 'mobile' | 'tablet';
  /** Browser info */
  browser?: string;
}

/**
 * Session end event - fired when RSVP player unmounts
 */
export interface RsvpSessionEndEvent extends RsvpTelemetryEvent {
  type: 'rsvp_session_end';
  /** Number of tokens actually displayed */
  tokensRead: number;
  /** Total session duration in ms */
  duration: number;
  /** Final token index */
  finalIndex: number;
  /** Completion rate (0-1) */
  completionRate: number;
  /** Average effective WPM */
  avgEffectiveWpm?: number;
  /** Reason for ending */
  endReason: 'completed' | 'exit' | 'error';
}

/**
 * Pause event - fired when playback is paused
 */
export interface RsvpPauseEvent extends RsvpTelemetryEvent {
  type: 'rsvp_pause';
  /** Token index when paused */
  tokenIndex: number;
  /** Reason for pause */
  reason: 'user' | 'visibility' | 'system';
  /** Pause duration (filled on resume) */
  duration?: number;
}

/**
 * Speed change event - fired when WPM is adjusted
 */
export interface RsvpSpeedChangeEvent extends RsvpTelemetryEvent {
  type: 'rsvp_speed_change';
  /** Previous WPM */
  fromWpm: number;
  /** New WPM */
  toWpm: number;
  /** Token index when changed */
  tokenIndex: number;
  /** Method of change */
  method: 'drag' | 'keyboard' | 'input';
}

/**
 * Rewind event - fired when user jumps backward
 */
export interface RsvpRewindEvent extends RsvpTelemetryEvent {
  type: 'rsvp_rewind';
  /** Token index before rewind */
  fromIndex: number;
  /** Token index after rewind */
  toIndex: number;
  /** Method of rewind */
  method: 'click' | 'scroll' | 'keyboard' | 'progress_bar';
}

/**
 * Token display event - sampled for performance analysis
 */
export interface RsvpTokenDisplayEvent extends RsvpTelemetryEvent {
  type: 'rsvp_token_display';
  /** Token index */
  tokenIndex: number;
  /** Actual display duration in ms */
  actualDuration: number;
  /** Expected duration in ms */
  expectedDuration: number;
  /** Token text (anonymized) */
  tokenLength: number;
  /** Boundary type */
  boundaryType: string;
}

/**
 * Frame jitter event - fired at session end
 */
export interface RsvpFrameJitterEvent extends RsvpTelemetryEvent {
  type: 'rsvp_frame_jitter';
  /** 50th percentile jitter in ms */
  p50: number;
  /** 95th percentile jitter in ms */
  p95: number;
  /** 99th percentile jitter in ms */
  p99: number;
  /** Number of samples */
  sampleCount: number;
  /** Deadline misses count */
  deadlineMisses: number;
  /** Catch-up events count */
  catchupEvents: number;
}

/**
 * Comprehension probe result
 */
export interface RsvpComprehensionProbe extends RsvpTelemetryEvent {
  type: 'rsvp_comprehension_probe';
  /** Token index when probe was shown */
  tokenIndex: number;
  /** Whether user answered correctly */
  correct: boolean;
  /** Response time in ms */
  responseTime: number;
  /** Probe ID for deduplication */
  probeId: string;
}

/**
 * Union of all telemetry events
 */
export type RsvpEvent = 
  | RsvpSessionStartEvent
  | RsvpSessionEndEvent
  | RsvpPauseEvent
  | RsvpSpeedChangeEvent
  | RsvpRewindEvent
  | RsvpTokenDisplayEvent
  | RsvpFrameJitterEvent
  | RsvpComprehensionProbe;

// ==================== TELEMETRY SERVICE ====================

/**
 * Telemetry configuration
 */
export interface RsvpTelemetryConfig {
  /** Enable telemetry collection */
  enabled: boolean;
  /** A/B test variant identifier */
  variant?: string;
  /** Sample rate for token display events (0-1) */
  tokenDisplaySampleRate: number;
  /** Enable comprehension probes */
  enableComprehensionProbes: boolean;
  /** Tokens between comprehension probes */
  comprehensionProbeInterval: number;
  /** Custom event handler */
  onEvent?: (event: RsvpEvent) => void;
  /** Batch events for network efficiency */
  batchEvents: boolean;
  /** Batch flush interval in ms */
  batchFlushInterval: number;
}

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: RsvpTelemetryConfig = {
  enabled: false,
  tokenDisplaySampleRate: 0.1, // 10% sample rate
  enableComprehensionProbes: false,
  comprehensionProbeInterval: 500, // Every 500 tokens
  batchEvents: true,
  batchFlushInterval: 5000, // 5 seconds
};

/**
 * Session metrics computed from telemetry
 */
export interface RsvpSessionMetrics {
  /** Total session duration in ms */
  totalDuration: number;
  /** Tokens displayed */
  tokensDisplayed: number;
  /** Completion rate (0-1) */
  completionRate: number;
  /** Average effective WPM */
  avgEffectiveWpm: number;
  /** Rewind count */
  rewindCount: number;
  /** Speed change count */
  speedChangeCount: number;
  /** Pause count */
  pauseCount: number;
  /** Total pause duration in ms */
  totalPauseDuration: number;
  /** Comprehension score (if probes enabled) */
  comprehensionScore?: number;
  /** Frame jitter p50 */
  frameJitterP50?: number;
  /** Deadline miss rate */
  deadlineMissRate?: number;
}

/**
 * RSVP Telemetry Service
 * 
 * Collects and dispatches telemetry events for RSVP sessions.
 * Supports A/B testing, performance monitoring, and comprehension tracking.
 */
export class RsvpTelemetryService {
  private config: RsvpTelemetryConfig;
  private documentId?: string;
  private sessionStartTime: number = 0;
  private events: RsvpEvent[] = [];
  private eventBatch: RsvpEvent[] = [];
  private batchFlushTimer: NodeJS.Timeout | null = null;
  private pauseStartTime: number = 0;
  private lastTokenDisplayTime: number = 0;
  private tokenDisplayCount: number = 0;
  
  // Metrics tracking
  private rewindCount: number = 0;
  private speedChangeCount: number = 0;
  private pauseCount: number = 0;
  private totalPauseDuration: number = 0;
  private correctProbes: number = 0;
  private totalProbes: number = 0;
  
  constructor(config: Partial<RsvpTelemetryConfig> = {}) {
    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };
  }
  
  /**
   * Start a new telemetry session
   */
  startSession(params: {
    documentId?: string;
    tokenCount: number;
    initialWpm: number;
    variant?: string;
  }): void {
    if (!this.config.enabled) return;
    
    this.documentId = params.documentId;
    this.sessionStartTime = performance.now();
    this.events = [];
    this.resetMetrics();
    
    const event: RsvpSessionStartEvent = {
      type: 'rsvp_session_start',
      timestamp: Date.now(),
      documentId: this.documentId,
      tokenCount: params.tokenCount,
      initialWpm: params.initialWpm,
      variant: params.variant || this.config.variant,
      deviceType: this.detectDeviceType(),
      browser: this.detectBrowser(),
    };
    
    this.dispatchEvent(event);
    this.startBatchFlush();
  }
  
  /**
   * End the telemetry session
   */
  endSession(params: {
    tokensRead: number;
    finalIndex: number;
    totalTokens: number;
    avgEffectiveWpm?: number;
    endReason: 'completed' | 'exit' | 'error';
  }): void {
    if (!this.config.enabled) return;
    
    const duration = performance.now() - this.sessionStartTime;
    
    const event: RsvpSessionEndEvent = {
      type: 'rsvp_session_end',
      timestamp: Date.now(),
      documentId: this.documentId,
      tokensRead: params.tokensRead,
      duration,
      finalIndex: params.finalIndex,
      completionRate: params.totalTokens > 0 ? params.tokensRead / params.totalTokens : 0,
      avgEffectiveWpm: params.avgEffectiveWpm,
      endReason: params.endReason,
    };
    
    this.dispatchEvent(event);
    this.flushBatch();
    this.stopBatchFlush();
  }
  
  /**
   * Record a pause event
   */
  recordPause(tokenIndex: number, reason: 'user' | 'visibility' | 'system'): void {
    if (!this.config.enabled) return;
    
    this.pauseStartTime = performance.now();
    this.pauseCount++;
    
    const event: RsvpPauseEvent = {
      type: 'rsvp_pause',
      timestamp: Date.now(),
      documentId: this.documentId,
      tokenIndex,
      reason,
    };
    
    this.dispatchEvent(event);
  }
  
  /**
   * Record resume from pause
   */
  recordResume(): void {
    if (!this.config.enabled || this.pauseStartTime === 0) return;
    
    const pauseDuration = performance.now() - this.pauseStartTime;
    this.totalPauseDuration += pauseDuration;
    this.pauseStartTime = 0;
  }
  
  /**
   * Record a speed change event
   */
  recordSpeedChange(params: {
    fromWpm: number;
    toWpm: number;
    tokenIndex: number;
    method: 'drag' | 'keyboard' | 'input';
  }): void {
    if (!this.config.enabled) return;
    
    this.speedChangeCount++;
    
    const event: RsvpSpeedChangeEvent = {
      type: 'rsvp_speed_change',
      timestamp: Date.now(),
      documentId: this.documentId,
      ...params,
    };
    
    this.dispatchEvent(event);
  }
  
  /**
   * Record a rewind event
   */
  recordRewind(params: {
    fromIndex: number;
    toIndex: number;
    method: 'click' | 'scroll' | 'keyboard' | 'progress_bar';
  }): void {
    if (!this.config.enabled) return;
    
    // Only count as rewind if going backward
    if (params.toIndex < params.fromIndex) {
      this.rewindCount++;
    }
    
    const event: RsvpRewindEvent = {
      type: 'rsvp_rewind',
      timestamp: Date.now(),
      documentId: this.documentId,
      ...params,
    };
    
    this.dispatchEvent(event);
  }
  
  /**
   * Record a token display (sampled)
   */
  recordTokenDisplay(params: {
    tokenIndex: number;
    actualDuration: number;
    expectedDuration: number;
    tokenLength: number;
    boundaryType: string;
  }): void {
    if (!this.config.enabled) return;
    
    this.tokenDisplayCount++;
    
    // Only sample based on rate
    if (Math.random() > this.config.tokenDisplaySampleRate) return;
    
    const event: RsvpTokenDisplayEvent = {
      type: 'rsvp_token_display',
      timestamp: Date.now(),
      documentId: this.documentId,
      ...params,
    };
    
    this.dispatchEvent(event);
    this.lastTokenDisplayTime = performance.now();
  }
  
  /**
   * Record frame jitter metrics
   */
  recordFrameJitter(params: {
    p50: number;
    p95: number;
    p99: number;
    sampleCount: number;
    deadlineMisses: number;
    catchupEvents: number;
  }): void {
    if (!this.config.enabled) return;
    
    const event: RsvpFrameJitterEvent = {
      type: 'rsvp_frame_jitter',
      timestamp: Date.now(),
      documentId: this.documentId,
      ...params,
    };
    
    this.dispatchEvent(event);
  }
  
  /**
   * Record comprehension probe result
   */
  recordComprehensionProbe(params: {
    tokenIndex: number;
    correct: boolean;
    responseTime: number;
    probeId: string;
  }): void {
    if (!this.config.enabled) return;
    
    this.totalProbes++;
    if (params.correct) this.correctProbes++;
    
    const event: RsvpComprehensionProbe = {
      type: 'rsvp_comprehension_probe',
      timestamp: Date.now(),
      documentId: this.documentId,
      ...params,
    };
    
    this.dispatchEvent(event);
  }
  
  /**
   * Check if a comprehension probe should be shown
   */
  shouldShowComprehensionProbe(tokenIndex: number): boolean {
    if (!this.config.enabled || !this.config.enableComprehensionProbes) return false;
    return tokenIndex > 0 && tokenIndex % this.config.comprehensionProbeInterval === 0;
  }
  
  /**
   * Get session metrics summary
   */
  getSessionMetrics(): RsvpSessionMetrics {
    const duration = performance.now() - this.sessionStartTime;
    const activeReadingTime = duration - this.totalPauseDuration;
    
    return {
      totalDuration: duration,
      tokensDisplayed: this.tokenDisplayCount,
      completionRate: 0, // Filled by caller
      avgEffectiveWpm: activeReadingTime > 0 
        ? (this.tokenDisplayCount / activeReadingTime) * 60_000 
        : 0,
      rewindCount: this.rewindCount,
      speedChangeCount: this.speedChangeCount,
      pauseCount: this.pauseCount,
      totalPauseDuration: this.totalPauseDuration,
      comprehensionScore: this.totalProbes > 0 
        ? this.correctProbes / this.totalProbes 
        : undefined,
    };
  }
  
  /**
   * Get all collected events
   */
  getEvents(): RsvpEvent[] {
    return [...this.events];
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<RsvpTelemetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  // ==================== PRIVATE METHODS ====================
  
  private dispatchEvent(event: RsvpEvent): void {
    this.events.push(event);
    
    if (this.config.batchEvents) {
      this.eventBatch.push(event);
    } else if (this.config.onEvent) {
      this.config.onEvent(event);
    }
  }
  
  private startBatchFlush(): void {
    if (!this.config.batchEvents || !this.config.onEvent) return;
    
    this.batchFlushTimer = setInterval(() => {
      this.flushBatch();
    }, this.config.batchFlushInterval);
  }
  
  private stopBatchFlush(): void {
    if (this.batchFlushTimer) {
      clearInterval(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }
  }
  
  private flushBatch(): void {
    if (this.eventBatch.length === 0 || !this.config.onEvent) return;
    
    for (const event of this.eventBatch) {
      this.config.onEvent(event);
    }
    this.eventBatch = [];
  }
  
  private resetMetrics(): void {
    this.rewindCount = 0;
    this.speedChangeCount = 0;
    this.pauseCount = 0;
    this.totalPauseDuration = 0;
    this.correctProbes = 0;
    this.totalProbes = 0;
    this.tokenDisplayCount = 0;
    this.pauseStartTime = 0;
    this.lastTokenDisplayTime = 0;
  }
  
  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof window === 'undefined') return 'desktop';
    
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
    return 'desktop';
  }
  
  private detectBrowser(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'chrome';
    if (ua.includes('Safari')) return 'safari';
    if (ua.includes('Firefox')) return 'firefox';
    if (ua.includes('Edge')) return 'edge';
    return 'unknown';
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopBatchFlush();
    this.flushBatch();
    this.events = [];
    this.eventBatch = [];
  }
}
