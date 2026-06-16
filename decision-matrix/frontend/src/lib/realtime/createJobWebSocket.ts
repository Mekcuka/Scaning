import { getAccessToken } from '../authSession';
import { API_BASE } from '../api/client';
import type { JobStepListResponse } from '../api/jobs';

/**
 * WebSocket client for job realtime events.
 *
 * Route: `${wsBase}/api/v1/projects/${projectId}/jobs/ws?token=${token}`
 *
 * Auth via query param (browsers can't set headers on WS handshake).
 * Falls back gracefully — caller (useJobRealtime) handles reconnect + REST poll.
 */

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
const HEARTBEAT_TIMEOUT_MS = 45000;

function toWsBase(apiBase: string): string {
  if (apiBase.startsWith('https://')) return 'wss://' + apiBase.slice('https://'.length);
  if (apiBase.startsWith('http://')) return 'ws://' + apiBase.slice('http://'.length);
  // relative "/api/v1" → use current host
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${apiBase}`;
}

export { toWsBase };

export interface JobWebSocketClient {
  close(): void;
  readonly readyState: number;
}

export interface JobRealtimeHandlers {
  onEvent: (event: Record<string, unknown>) => void;
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
}

export function createJobWebSocket(
  projectId: string,
  handlers: JobRealtimeHandlers,
): JobWebSocketClient {
  const token = getAccessToken();
  const wsBase = toWsBase(API_BASE);
  const url = `${wsBase}/projects/${projectId}/jobs/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  let ws: WebSocket | null = null;
  let reconnectIndex = 0;
  let closed = false;
  let heartbeatTimer: number | null = null;
  let reconnectTimer: number | null = null;

  const clearTimers = () => {
    if (heartbeatTimer !== null) {
      window.clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    if (reconnectIndex >= RECONNECT_DELAYS.length) {
      reconnectIndex = RECONNECT_DELAYS.length - 1;
    }
    const delay = RECONNECT_DELAYS[reconnectIndex];
    reconnectIndex += 1;
    reconnectTimer = window.setTimeout(connect, delay);
  };

  const armHeartbeat = () => {
    clearTimers();
    heartbeatTimer = window.setTimeout(() => {
      // No message received for HEARTBEAT_TIMEOUT_MS — reconnect
      ws?.close(4000, 'heartbeat timeout');
    }, HEARTBEAT_TIMEOUT_MS);
  };

  const connect = () => {
    if (closed) return;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectIndex = 0;
      armHeartbeat();
      handlers.onOpen?.();
    };

    ws.onmessage = (ev: MessageEvent) => {
      armHeartbeat();
      try {
        const data = JSON.parse(ev.data) as Record<string, unknown>;
        // Ignore protocol pings
        if (data.type === 'ping' || data.type === 'pong' || data.type === 'ready') return;
        handlers.onEvent(data);
      } catch {
        /* malformed */
      }
    };

    ws.onerror = (ev: Event) => {
      handlers.onError?.(ev);
    };

    ws.onclose = (ev: CloseEvent) => {
      clearTimers();
      handlers.onClose?.(ev);
      // Auth failures (4401/4403) — do not reconnect
      if (ev.code === 4401 || ev.code === 4403) return;
      scheduleReconnect();
    };
  };

  connect();

  return {
    close() {
      closed = true;
      clearTimers();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'client closed');
      }
      ws = null;
    },
    get readyState() {
      return ws?.readyState ?? WebSocket.CLOSED;
    },
  };
}

/**
 * REST fallback: fetch steps snapshot for a job.
 */
export async function fetchJobSteps(
  projectId: string,
  jobId: string,
): Promise<JobStepListResponse> {
  const token = getAccessToken();
  const url = `${API_BASE}/projects/${projectId}/jobs/${jobId}/steps`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`fetchJobSteps failed: ${res.status}`);
  return res.json();
}
