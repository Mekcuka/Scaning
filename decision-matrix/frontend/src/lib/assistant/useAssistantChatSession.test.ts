import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { assistantApi } from './assistantApi';
import { useAssistantChatSession } from './useAssistantChatSession';

vi.mock('./assistantApi', () => ({
  assistantApi: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSessionMessages: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAssistantChatSession', () => {
  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('after deleting the last session stays on welcome screen (no auto-create)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const only = {
      id: 'sess-1',
      title: 'Единственный чат',
      message_count: 2,
      updated_at: new Date().toISOString(),
      project_id: null,
    };

    vi.mocked(assistantApi.listSessions).mockImplementation(async () =>
      vi.mocked(assistantApi.deleteSession).mock.calls.length > 0 ? [] : [only],
    );
    vi.mocked(assistantApi.getSessionMessages).mockResolvedValue({
      session_id: only.id,
      messages: [{ role: 'user', content: 'hi' }],
    });
    vi.mocked(assistantApi.deleteSession).mockResolvedValue(undefined);
    vi.mocked(assistantApi.createSession).mockResolvedValue({
      id: 'sess-new',
      title: 'Новый чат',
      message_count: 0,
      updated_at: new Date().toISOString(),
      project_id: null,
    });

    sessionStorage.setItem('assistant-chat-session-id', only.id);

    const { result } = renderHook(
      () => useAssistantChatSession(true, null, true),
      { wrapper: wrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.sessionId).toBe(only.id));

    await act(async () => {
      await result.current.deleteSessionById(only.id);
    });

    await waitFor(() => {
      expect(result.current.sessionId).toBeNull();
      expect(result.current.sessions).toHaveLength(0);
    });
    expect(assistantApi.createSession).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('assistant-chat-session-id')).toBeNull();
  });
});
