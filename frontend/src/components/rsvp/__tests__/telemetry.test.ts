import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RsvpTelemetryService,
  DEFAULT_TELEMETRY_CONFIG,
  type RsvpEvent,
} from '../rsvpTelemetry';

describe('RsvpTelemetryService', () => {
  let service: RsvpTelemetryService;
  let mockOnEvent: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockOnEvent = vi.fn();
    service = new RsvpTelemetryService({
      enabled: true,
      batchEvents: false,
      onEvent: mockOnEvent,
    });
  });
  
  afterEach(() => {
    service.destroy();
  });
  
  it('creates with default config when no config provided', () => {
    const defaultService = new RsvpTelemetryService();
    expect(defaultService).toBeDefined();
    defaultService.destroy();
  });
  
  it('does not dispatch events when disabled', () => {
    const disabledService = new RsvpTelemetryService({
      enabled: false,
      onEvent: mockOnEvent,
    });
    
    disabledService.startSession({
      tokenCount: 100,
      initialWpm: 300,
    });
    
    expect(mockOnEvent).not.toHaveBeenCalled();
    disabledService.destroy();
  });
  
  it('dispatches session start event', () => {
    service.startSession({
      documentId: 'doc-123',
      tokenCount: 100,
      initialWpm: 300,
      variant: 'control',
    });
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rsvp_session_start',
      documentId: 'doc-123',
      tokenCount: 100,
      initialWpm: 300,
      variant: 'control',
    }));
  });
  
  it('dispatches session end event', () => {
    service.startSession({
      tokenCount: 100,
      initialWpm: 300,
    });
    
    mockOnEvent.mockClear();
    
    service.endSession({
      tokensRead: 50,
      finalIndex: 49,
      totalTokens: 100,
      avgEffectiveWpm: 280,
      endReason: 'exit',
    });
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rsvp_session_end',
      tokensRead: 50,
      finalIndex: 49,
      completionRate: 0.5,
      endReason: 'exit',
    }));
  });
  
  it('dispatches pause event', () => {
    service.startSession({ tokenCount: 100, initialWpm: 300 });
    mockOnEvent.mockClear();
    
    service.recordPause(25, 'user');
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rsvp_pause',
      tokenIndex: 25,
      reason: 'user',
    }));
  });
  
  it('dispatches speed change event', () => {
    service.startSession({ tokenCount: 100, initialWpm: 300 });
    mockOnEvent.mockClear();
    
    service.recordSpeedChange({
      fromWpm: 300,
      toWpm: 400,
      tokenIndex: 50,
      method: 'keyboard',
    });
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rsvp_speed_change',
      fromWpm: 300,
      toWpm: 400,
      tokenIndex: 50,
      method: 'keyboard',
    }));
  });
  
  it('dispatches rewind event', () => {
    service.startSession({ tokenCount: 100, initialWpm: 300 });
    mockOnEvent.mockClear();
    
    service.recordRewind({
      fromIndex: 50,
      toIndex: 25,
      method: 'click',
    });
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rsvp_rewind',
      fromIndex: 50,
      toIndex: 25,
      method: 'click',
    }));
  });
  
  it('dispatches comprehension probe event', () => {
    service.startSession({ tokenCount: 100, initialWpm: 300 });
    mockOnEvent.mockClear();
    
    service.recordComprehensionProbe({
      tokenIndex: 100,
      correct: true,
      responseTime: 1500,
      probeId: 'probe-1',
    });
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rsvp_comprehension_probe',
      tokenIndex: 100,
      correct: true,
      responseTime: 1500,
      probeId: 'probe-1',
    }));
  });
  
  it('tracks metrics correctly', () => {
    service.startSession({ tokenCount: 100, initialWpm: 300 });
    
    // Record some events
    service.recordPause(25, 'user');
    service.recordResume();
    service.recordPause(50, 'user');
    service.recordResume();
    service.recordSpeedChange({ fromWpm: 300, toWpm: 350, tokenIndex: 30, method: 'drag' });
    service.recordRewind({ fromIndex: 50, toIndex: 25, method: 'click' });
    service.recordRewind({ fromIndex: 75, toIndex: 50, method: 'scroll' });
    
    const metrics = service.getSessionMetrics();
    
    expect(metrics.pauseCount).toBe(2);
    expect(metrics.speedChangeCount).toBe(1);
    expect(metrics.rewindCount).toBe(2);
  });
  
  it('calculates comprehension score', () => {
    service.startSession({ tokenCount: 1000, initialWpm: 300 });
    
    service.recordComprehensionProbe({ tokenIndex: 100, correct: true, responseTime: 1000, probeId: '1' });
    service.recordComprehensionProbe({ tokenIndex: 200, correct: true, responseTime: 1000, probeId: '2' });
    service.recordComprehensionProbe({ tokenIndex: 300, correct: false, responseTime: 1000, probeId: '3' });
    service.recordComprehensionProbe({ tokenIndex: 400, correct: true, responseTime: 1000, probeId: '4' });
    
    const metrics = service.getSessionMetrics();
    expect(metrics.comprehensionScore).toBe(0.75); // 3 out of 4 correct
  });
  
  it('determines when to show comprehension probe', () => {
    const probeService = new RsvpTelemetryService({
      enabled: true,
      enableComprehensionProbes: true,
      comprehensionProbeInterval: 100,
    });
    
    expect(probeService.shouldShowComprehensionProbe(0)).toBe(false);
    expect(probeService.shouldShowComprehensionProbe(50)).toBe(false);
    expect(probeService.shouldShowComprehensionProbe(100)).toBe(true);
    expect(probeService.shouldShowComprehensionProbe(200)).toBe(true);
    expect(probeService.shouldShowComprehensionProbe(150)).toBe(false);
    
    probeService.destroy();
  });
  
  it('does not show probes when disabled', () => {
    const noProbeService = new RsvpTelemetryService({
      enabled: true,
      enableComprehensionProbes: false,
    });
    
    expect(noProbeService.shouldShowComprehensionProbe(100)).toBe(false);
    
    noProbeService.destroy();
  });
  
  it('samples token display events based on rate', () => {
    // Create service with 100% sample rate for testing
    const fullSampleService = new RsvpTelemetryService({
      enabled: true,
      batchEvents: false,
      tokenDisplaySampleRate: 1.0,
      onEvent: mockOnEvent,
    });
    
    fullSampleService.startSession({ tokenCount: 100, initialWpm: 300 });
    mockOnEvent.mockClear();
    
    fullSampleService.recordTokenDisplay({
      tokenIndex: 10,
      actualDuration: 200,
      expectedDuration: 200,
      tokenLength: 5,
      boundaryType: 'none',
    });
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rsvp_token_display',
      tokenIndex: 10,
    }));
    
    fullSampleService.destroy();
  });
  
  it('returns all collected events', () => {
    service.startSession({ tokenCount: 100, initialWpm: 300 });
    service.recordPause(25, 'user');
    service.recordSpeedChange({ fromWpm: 300, toWpm: 350, tokenIndex: 30, method: 'drag' });
    
    const events = service.getEvents();
    
    expect(events.length).toBe(3); // start + pause + speed change
    expect(events[0].type).toBe('rsvp_session_start');
    expect(events[1].type).toBe('rsvp_pause');
    expect(events[2].type).toBe('rsvp_speed_change');
  });
  
  it('can update config', () => {
    service.updateConfig({ variant: 'treatment' });
    
    service.startSession({ tokenCount: 100, initialWpm: 300 });
    
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'treatment',
    }));
  });
});

describe('RsvpTelemetryService batching', () => {
  it('batches events when enabled', () => {
    vi.useFakeTimers();
    const mockOnEvent = vi.fn();
    
    const batchService = new RsvpTelemetryService({
      enabled: true,
      batchEvents: true,
      batchFlushInterval: 1000,
      onEvent: mockOnEvent,
    });
    
    batchService.startSession({ tokenCount: 100, initialWpm: 300 });
    batchService.recordPause(25, 'user');
    
    // Events should not be dispatched yet
    expect(mockOnEvent).not.toHaveBeenCalled();
    
    // Advance time to trigger flush
    vi.advanceTimersByTime(1000);
    
    // Events should now be dispatched
    expect(mockOnEvent).toHaveBeenCalledTimes(2);
    
    batchService.destroy();
    vi.useRealTimers();
  });
});

describe('DEFAULT_TELEMETRY_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_TELEMETRY_CONFIG.enabled).toBe(false);
    expect(DEFAULT_TELEMETRY_CONFIG.tokenDisplaySampleRate).toBe(0.1);
    expect(DEFAULT_TELEMETRY_CONFIG.enableComprehensionProbes).toBe(false);
    expect(DEFAULT_TELEMETRY_CONFIG.batchEvents).toBe(true);
    expect(DEFAULT_TELEMETRY_CONFIG.batchFlushInterval).toBe(5000);
  });
});
