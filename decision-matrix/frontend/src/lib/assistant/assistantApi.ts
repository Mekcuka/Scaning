import { getAccessToken } from '../authSession';
import {
  API_BASE,
  ensureMutatingSessionHeaders,
  formatApiError,
  getCsrfToken,
  request,
  storeCsrfFromResponse,
} from '../api/client';
import type { AssistantStatus, ChatRequest, ChatResponse, PendingAction } from './types';

const CHAT_STREAM_TIMEOUT_MS = 130_000;

export type ChatStreamCallbacks = {
  onToken?: (delta: string) => void;
  onToolStart?: (name: string) => void;
  onToolDone?: (payload: { name: string; ok: boolean; code?: string | null }) => void;
  onPendingAction?: (action: PendingAction) => void;
  onDone?: (response: ChatResponse) => void;
  onError?: (message: string, code?: string | null) => void;
};

function parseSseBlock(block: string, callbacks: ChatStreamCallbacks): void {
  let event = 'message';
  let dataLine = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLine = line.slice(5).trim();
    }
  }
  if (!dataLine) return;

  const parsed = JSON.parse(dataLine) as Record<string, unknown>;
  switch (event) {
    case 'token':
      if (typeof parsed.delta === 'string') {
        callbacks.onToken?.(parsed.delta);
      }
      break;
    case 'tool_start':
      if (typeof parsed.name === 'string') {
        callbacks.onToolStart?.(parsed.name);
      }
      break;
    case 'tool_done':
      if (typeof parsed.name === 'string' && typeof parsed.ok === 'boolean') {
        callbacks.onToolDone?.({
          name: parsed.name,
          ok: parsed.ok,
          code: typeof parsed.code === 'string' ? parsed.code : null,
        });
      }
      break;
    case 'pending_action':
      callbacks.onPendingAction?.(parsed as PendingAction);
      break;
    case 'done':
      callbacks.onDone?.(parsed as ChatResponse);
      break;
    case 'error': {
      const message = typeof parsed.message === 'string' ? parsed.message : 'Ошибка помощника';
      const code = typeof parsed.code === 'string' ? parsed.code : null;
      callbacks.onError?.(message, code);
      break;
    }
    default:
      break;
  }
}

export async function postChatStream(
  body: ChatRequest,
  callbacks: ChatStreamCallbacks,
): Promise<void> {
  const path = '/assistant/chat/stream';
  await ensureMutatingSessionHeaders(path, 'POST');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const accessToken = getAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_STREAM_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
      signal: controller.signal,
    });
    storeCsrfFromResponse(res);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: null }));
      throw new Error(formatApiError(err.detail, `HTTP ${res.status}`));
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Потоковый ответ недоступен');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep = buffer.indexOf('\n\n');
      while (sep >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (block.trim()) {
          parseSseBlock(block, callbacks);
        }
        sep = buffer.indexOf('\n\n');
      }
    }

    if (buffer.trim()) {
      parseSseBlock(buffer, callbacks);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Операция заняла больше 130 с. Попробуйте ещё раз.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const assistantApi = {
  getStatus: () => request<AssistantStatus>('/assistant/status'),
  postChat: (body: ChatRequest) =>
    request<ChatResponse>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: CHAT_STREAM_TIMEOUT_MS,
    }),
  postChatStream,
};
