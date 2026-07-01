import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createJobWebSocket, toWsBase } from '../createJobWebSocket';

vi.mock('../../authSession', () => ({
  getAccessToken: () => 'test-token',
}));

function makeMockSocket() {
  const socket = {
    readyState: 0,
    onopen: null as null | (() => void),
    onmessage: null as null | ((ev: MessageEvent) => void),
    onerror: null as null | ((ev: Event) => void),
    onclose: null as null | ((ev: CloseEvent) => void),
    close: vi.fn(),
    fire(type: 'open' | 'message' | 'error' | 'close', payload?: string) {
      if (type === 'open' && this.onopen) this.onopen();
      if (type === 'message' && this.onmessage)
        this.onmessage({ data: payload ?? '{}' } as MessageEvent);
      if (type === 'error' && this.onerror) this.onerror(new Event('error'));
      if (type === 'close' && this.onclose)
        this.onclose(new CloseEvent('close', { code: 1000 }));
    },
  };
  return socket;
}

describe('toWsBase', () => {
  it('converts https URL to wss', () => {
    expect(toWsBase('https://api.example.com/api/v1')).toBe('wss://api.example.com/api/v1');
  });

  it('converts http URL to ws', () => {
    expect(toWsBase('http://localhost:8000/api/v1')).toBe('ws://localhost:8000/api/v1');
  });
});

describe('createJobWebSocket', () => {
  let mockSocket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = makeMockSocket();
    vi.stubGlobal('WebSocket', vi.fn(() => mockSocket));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends events to onEvent handler, ignoring pings', () => {
    const onEvent = vi.fn();
    createJobWebSocket('proj-1', { onEvent });

    mockSocket.fire('message', JSON.stringify({ type: 'ping' }));
    expect(onEvent).not.toHaveBeenCalled();

    mockSocket.fire('message', JSON.stringify({ type: 'job.progress', progress: 0.5 }));
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ type: 'job.progress', progress: 0.5 });
  });

  it('calls onOpen when socket opens', () => {
    const onOpen = vi.fn();
    createJobWebSocket('proj-1', { onEvent: () => {}, onOpen });

    mockSocket.fire('open');
    expect(onOpen).toHaveBeenCalled();
  });

  it('does not reconnect on 4401 (auth failure)', () => {
    const onClose = vi.fn();
    createJobWebSocket('proj-1', { onEvent: () => {}, onClose });

    // Simulate auth-fail close
    if (mockSocket.onclose) {
      mockSocket.onclose(new CloseEvent('close', { code: 4401 }));
    }
    expect(onClose).toHaveBeenCalled();

    // Advance timers — no reconnect should occur (WebSocket not re-called)
    const wsCallsBefore = (global.WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    vi.advanceTimersByTime(20000);
    const wsCallsAfter = (global.WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(wsCallsAfter).toBe(wsCallsBefore);
  });

  it('close() prevents further reconnects', () => {
    const client = createJobWebSocket('proj-1', { onEvent: () => {} });
    client.close();

    const wsCallsBefore = (global.WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    vi.advanceTimersByTime(30000);
    const wsCallsAfter = (global.WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(wsCallsAfter).toBe(wsCallsBefore);
  });
});
