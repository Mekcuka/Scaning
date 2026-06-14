import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { assistantApi } from './assistantApi';
import { findReusableEmptySession } from './sessionDisplay';
import type { AssistantMessage } from './types';

const SESSION_STORAGE_KEY = 'assistant-chat-session-id';

function readStoredSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSessionId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function toAssistantMessages(
  rows: Array<{ role: 'user' | 'assistant'; content: string; reasoning?: string | null }>,
): AssistantMessage[] {
  return rows.map((row) => ({
    role: row.role,
    content: row.content,
    reasoning: row.reasoning ?? null,
  }));
}

export function useAssistantChatSession(
  open: boolean,
  projectId: string | null,
  historyEnabled: boolean,
) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(() => readStoredSessionId());

  const { data: sessions = [] } = useQuery({
    queryKey: ['assistantSessions'],
    queryFn: () => assistantApi.listSessions(),
    enabled: open && historyEnabled,
    staleTime: 15_000,
  });

  const { data: loadedMessages, isFetching: loadingMessages } = useQuery({
    queryKey: ['assistantSessionMessages', sessionId],
    queryFn: () => assistantApi.getSessionMessages(sessionId!),
    enabled: open && historyEnabled && !!sessionId,
    staleTime: 0,
  });

  const selectSession = useCallback((id: string | null) => {
    setSessionId(id);
    writeStoredSessionId(id);
  }, []);

  const createSession = useCallback(async () => {
    const created = await assistantApi.createSession({ project_id: projectId });
    await queryClient.invalidateQueries({ queryKey: ['assistantSessions'] });
    selectSession(created.id);
    return created.id;
  }, [projectId, queryClient, selectSession]);

  const startNewChat = useCallback(async () => {
    const reusable = findReusableEmptySession(sessions);
    if (reusable) {
      selectSession(reusable.id);
      return reusable.id;
    }
    return createSession();
  }, [createSession, selectSession, sessions]);

  const deleteSessionById = useCallback(
    async (id: string) => {
      await assistantApi.deleteSession(id);
      queryClient.setQueryData<typeof sessions>(
        ['assistantSessions'],
        (current) => current?.filter((s) => s.id !== id) ?? [],
      );
      queryClient.removeQueries({ queryKey: ['assistantSessionMessages', id] });
      await queryClient.invalidateQueries({ queryKey: ['assistantSessions'] });

      if (sessionId !== id) return;

      const fresh =
        queryClient.getQueryData<typeof sessions>(['assistantSessions']) ??
        (await queryClient.fetchQuery({
          queryKey: ['assistantSessions'],
          queryFn: () => assistantApi.listSessions(),
        }));

      if (fresh.length > 0) {
        selectSession(fresh[0].id);
        return;
      }
      // Last session removed — welcome screen; session is created on first message.
      selectSession(null);
    },
    [queryClient, selectSession, sessionId],
  );

  const applySessionFromResponse = useCallback(
    (id: string | null | undefined) => {
      const nextId = id ?? sessionId;
      if (nextId) {
        void queryClient.invalidateQueries({
          queryKey: ['assistantSessionMessages', nextId],
        });
      }
      if (!id || id === sessionId) return;
      selectSession(id);
      void queryClient.invalidateQueries({ queryKey: ['assistantSessions'] });
    },
    [queryClient, selectSession, sessionId],
  );

  useEffect(() => {
    if (!open || !historyEnabled) return;

    if (!sessionId) {
      if (sessions.length > 0) {
        selectSession(sessions[0].id);
      }
      return;
    }

    if (!sessions.some((s) => s.id === sessionId)) {
      if (sessions.length > 0) {
        selectSession(sessions[0].id);
      } else {
        selectSession(null);
      }
    }
  }, [open, historyEnabled, sessionId, sessions, selectSession]);

  return {
    sessionId,
    sessions,
    loadedMessages: loadedMessages ? toAssistantMessages(loadedMessages.messages) : undefined,
    loadingMessages,
    selectSession,
    startNewChat,
    deleteSessionById,
    applySessionFromResponse,
  };
}
