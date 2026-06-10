import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageSquare, Plus, Send, Trash2, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { useAssistantChatContext } from '../../lib/assistant/assistantContext';
import { assistantApi } from '../../lib/assistant/assistantApi';
import { getQuickCommands, toolLabel } from '../../lib/assistant/toolLabels';
import type { AssistantMessage, PendingAction, ToolCallSummary } from '../../lib/assistant/types';
import {
  formatAssistantChatError,
  formatLlmUnavailableHint,
} from '../../lib/assistant/chatErrors';
import { normalizeAssistantMessage, toChatHistory } from '../../lib/assistant/messageContent';
import { useAssistantChatSession } from '../../lib/assistant/useAssistantChatSession';
import { AssistantMessageBody } from './AssistantMessageBody';
import { AssistantSessionMenu } from './AssistantSessionMenu';
import { DeleteChatConfirmModal } from './DeleteChatConfirmModal';
import { useActiveProject } from '../../hooks/useActiveProject';
import { usePermissions } from '../../hooks/usePermissions';
import { useAppStore } from '../../store';

function formatToolLog(tools: ToolCallSummary[]): string {
  return tools
    .map((t) => `${toolLabel(t.name)} ${t.ok ? '✓' : '✗'}`)
    .join(', ');
}

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mcpHintOpen, setMcpHintOpen] = useState(false);
  const [sessionMutating, setSessionMutating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sendInFlightRef = useRef(false);
  const wasOpenRef = useRef(false);
  const prevSessionIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);
  const { projectId } = useActiveProject();
  const { pathname } = useLocation();
  const { role } = usePermissions();
  const chatContext = useAssistantChatContext();
  const assistantUiContext = useAppStore((s) => s.assistantUiContext);

  const { data: status } = useQuery({
    queryKey: ['assistantStatus'],
    queryFn: () => assistantApi.getStatus(),
    staleTime: 30_000,
  });

  const chatAvailable = status?.enabled && status?.provider_ready;
  const historyEnabled = status?.chat_history_enabled !== false;

  const {
    sessionId,
    sessions,
    loadedMessages,
    loadingMessages,
    selectSession,
    startNewChat,
    deleteSessionById,
    applySessionFromResponse,
  } = useAssistantChatSession(open, projectId, historyEnabled);

  useEffect(() => {
    if (!open || !historyEnabled || loadingMessages || streaming || loading) return;
    if (!sessionId) {
      if (prevSessionIdRef.current !== null) {
        prevSessionIdRef.current = null;
        setMessages([]);
        setPendingAction(null);
      }
      return;
    }
    if (!loadedMessages) return;

    const sessionChanged = prevSessionIdRef.current !== sessionId;
    if (sessionChanged) {
      prevSessionIdRef.current = sessionId;
      setMessages(loadedMessages);
      setPendingAction(null);
      stickToBottomRef.current = true;
      return;
    }

    // Same session: do not overwrite an active/local transcript (fixes post-stream wipe).
    setMessages((prev) => (prev.length === 0 ? loadedMessages : prev));
  }, [open, historyEnabled, sessionId, loadedMessages, loadingMessages, streaming, loading]);

  const quickCommands = useMemo(
    () =>
      getQuickCommands({
        pathname,
        role,
        hasProject: !!projectId,
      }),
    [pathname, role, projectId],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleBodyScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 48;
  }, []);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const el = bodyRef.current;
    if (!el) return;

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (justOpened) {
      stickToBottomRef.current = true;
    }

    if (!stickToBottomRef.current && !justOpened) return;

    const scrollToEnd = (behavior: ScrollBehavior) => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    };

    scrollToEnd(justOpened ? 'auto' : 'smooth');
    const rafId = requestAnimationFrame(() => scrollToEnd('auto'));
    return () => cancelAnimationFrame(rafId);
  }, [open, messages, pendingAction, loading, streamingStatus]);

  const sendMessage = async (text: string, confirmActionId?: string) => {
    if (!text.trim() && !confirmActionId) return;
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setLoading(true);
    setError(null);
    const userMsg: AssistantMessage = { role: 'user', content: text.trim() || 'Подтверждаю' };
    const historyForApi = toChatHistory(messages);
    const history = confirmActionId ? historyForApi : [...historyForApi, userMsg];
    const withPlaceholder: AssistantMessage[] = confirmActionId
      ? messages
      : [...messages, userMsg];
    const withAssistant: AssistantMessage[] = [
      ...withPlaceholder,
      { role: 'assistant', content: '', reasoning: '' },
    ];

    stickToBottomRef.current = true;
    if (!confirmActionId) {
      setMessages(withAssistant);
      setInput('');
    } else {
      setMessages([...messages, { role: 'assistant', content: '', reasoning: '' }]);
    }
    setStreaming(true);
    setStreamingStatus(null);

    const appendToken = (delta: string) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: last.content + delta };
        }
        return next;
      });
    };

    const appendReasoningToken = (delta: string) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            reasoning: `${last.reasoning ?? ''}${delta}`,
          };
        }
        return next;
      });
    };

    try {
      await assistantApi.postChatStream(
        {
          messages: history,
          ...chatContext,
          confirm_action_id: confirmActionId ?? null,
          session_id: historyEnabled ? sessionId : null,
        },
        {
          onToken: appendToken,
          onReasoningToken: appendReasoningToken,
          onToolStart: (name) => setStreamingStatus(`Выполняю: ${toolLabel(name)}…`),
          onToolDone: () => setStreamingStatus(null),
          onPendingAction: (action) => setPendingAction(action),
          onDone: (res) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = normalizeAssistantMessage({
                  ...last,
                  content: res.message.content || last.content,
                  reasoning: res.message.reasoning ?? last.reasoning ?? null,
                  tools: res.tool_calls_made.length > 0 ? res.tool_calls_made : undefined,
                });
              }
              return next;
            });
            setPendingAction(res.pending_action);
            setStreamingStatus(null);
            applySessionFromResponse(res.session_id);
          },
          onError: (message, code) => {
            throw Object.assign(new Error(formatAssistantChatError(message, code, status)), {
              chatErrorCode: code,
            });
          },
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка помощника';
      setMessages(withPlaceholder);
      setError(formatAssistantChatError(msg, undefined, status));
    } finally {
      sendInFlightRef.current = false;
      setLoading(false);
      setStreaming(false);
      setStreamingStatus(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !input.trim()) return;
    void sendMessage(input);
  };

  const handleConfirm = () => {
    if (!pendingAction || loading) return;
    void sendMessage('Подтверждаю операцию', pendingAction.action_id);
    setPendingAction(null);
  };

  const handleCancelPending = () => setPendingAction(null);

  const handleNewChat = useCallback(() => {
    if (sessionMutating) return;
    void (async () => {
      setSessionMutating(true);
      try {
        if (historyEnabled) {
          await startNewChat();
          prevSessionIdRef.current = null;
        }
        setMessages([]);
        setPendingAction(null);
        setError(null);
        setInput('');
        stickToBottomRef.current = true;
      } finally {
        setSessionMutating(false);
      }
    })();
  }, [historyEnabled, sessionMutating, startNewChat]);

  const requestDeleteSession = useCallback(
    (id: string, title: string) => {
      if (!historyEnabled || sessionMutating) return;
      setDeleteTarget({ id, title });
    },
    [historyEnabled, sessionMutating],
  );

  const handleDeleteChat = useCallback(() => {
    if (!historyEnabled || !sessionId || sessionMutating) {
      if (!historyEnabled) {
        setMessages([]);
        setPendingAction(null);
        setError(null);
      }
      return;
    }
    const current = sessions.find((s) => s.id === sessionId);
    requestDeleteSession(sessionId, current?.title ?? 'Текущий диалог');
  }, [historyEnabled, requestDeleteSession, sessionId, sessionMutating, sessions]);

  const confirmDeleteSession = useCallback(() => {
    if (!deleteTarget || sessionMutating) return;
    void (async () => {
      setSessionMutating(true);
      try {
        const { id } = deleteTarget;
        await deleteSessionById(id);
        if (id === sessionId) {
          prevSessionIdRef.current = null;
          setMessages([]);
          setPendingAction(null);
          setError(null);
          setInput('');
        }
        setDeleteTarget(null);
      } finally {
        setSessionMutating(false);
      }
    })();
  }, [deleteSessionById, deleteTarget, sessionId, sessionMutating]);

  return (
    <div className="assistant-anchor" ref={anchorRef}>
      <button
        type="button"
        className="btn btn-ghost p-2 shrink-0 relative"
        title="AI-помощник"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MessageSquare size={18} />
        {status?.enabled && !status.provider_ready && (
          <span className="assistant-badge assistant-badge--warn" title="LLM недоступен" />
        )}
      </button>
      {open && (
        <div className="assistant-panel" ref={panelRef} role="dialog" aria-label="AI-помощник">
          <div className="assistant-panel-head">
            <div className="assistant-panel-head-row">
              <h2 className="assistant-panel-title">AI-помощник</h2>
              <div className="assistant-panel-head-actions">
              {historyEnabled && (
                <button
                  type="button"
                  className="btn btn-ghost p-1"
                  onClick={handleNewChat}
                  aria-label="Новый чат"
                  title="Новый чат"
                  disabled={loading || streaming || sessionMutating}
                >
                  <Plus size={16} />
                </button>
              )}
              {historyEnabled && sessionId && (
                <button
                  type="button"
                  className="btn btn-ghost p-1"
                  onClick={handleDeleteChat}
                  aria-label="Удалить диалог"
                  title="Удалить диалог"
                  disabled={loading || streaming || sessionMutating}
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost p-1"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
              </div>
            </div>
            {historyEnabled && (
              <AssistantSessionMenu
                sessions={sessions}
                sessionId={sessionId}
                disabled={loading || streaming || sessionMutating}
                onSelect={(id) => {
                  prevSessionIdRef.current = null;
                  selectSession(id);
                }}
                onNewChat={handleNewChat}
                onRequestDelete={requestDeleteSession}
              />
            )}
          </div>
          <div className="assistant-panel-body" ref={bodyRef} onScroll={handleBodyScroll}>
            {!status?.enabled && (
              <p className="assistant-hint">Чат отключён на сервере (ASSISTANT_CHAT_ENABLED=false).</p>
            )}
            {status?.enabled && !status.provider_ready && (
              <>
                <p className="assistant-hint">{formatLlmUnavailableHint(status)}</p>
                {role === 'admin' && (
                  <p className="assistant-hint">
                    <Link to="/admin/assistant">Настройки LLM (admin)</Link> — проверка подключения и
                    временный override.
                  </p>
                )}
              </>
            )}
            {status?.enabled && status.mcp_url && (
              <div className="assistant-mcp-hint">
                <button
                  type="button"
                  className="assistant-mcp-hint-toggle"
                  onClick={() => setMcpHintOpen((v) => !v)}
                  aria-expanded={mcpHintOpen}
                >
                  Подключение Cursor MCP
                </button>
                {mcpHintOpen && (
                  <div className="assistant-mcp-hint-body">
                    <p className="assistant-hint">
                      {status.mcp_setup_hint_ru ??
                        'Выполните scripts/get-atlas-grid-token.ps1 и перезагрузите MCP в Cursor.'}
                    </p>
                    <p className="assistant-hint">
                      URL: <code>{status.mcp_url}</code>
                      {status.mcp_token_ttl_minutes
                        ? ` · токен ~${status.mcp_token_ttl_minutes} мин`
                        : null}
                    </p>
                  </div>
                )}
              </div>
            )}
            {messages.length === 0 && chatAvailable && (
              <>
                <p className="assistant-hint">
                  Спросите о проектах, POI, задачах, тарифах или результатах расчётов. Контекст:{' '}
                  {chatContext.project_name ??
                    (projectId ? `проект ${projectId.slice(0, 8)}…` : 'проект не выбран')}
                  {assistantUiContext.selectedPoiName
                    ? `, POI «${assistantUiContext.selectedPoiName}»`
                    : assistantUiContext.selectedPoiId
                      ? ', POI выбран'
                      : ''}
                  {chatContext.active_tab ? `, раздел ${chatContext.active_tab}` : ''}.
                </p>
                {quickCommands.length > 0 && (
                  <div className="assistant-chips">
                    {quickCommands.map((cmd) => (
                      <button
                        key={cmd.label}
                        type="button"
                        className="assistant-chip"
                        disabled={loading}
                        onClick={() => void sendMessage(cmd.message)}
                      >
                        {cmd.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {streamingStatus && (
              <p className="assistant-hint assistant-streaming-status">{streamingStatus}</p>
            )}
            {messages.map((m, i) => {
              const isStreamingMsg =
                streaming && m.role === 'assistant' && i === messages.length - 1;
              return (
                <div
                  key={`${m.role}-${i}`}
                  className={`assistant-msg assistant-msg--${m.role}${
                    isStreamingMsg ? ' assistant-streaming' : ''
                  }`}
                >
                  <span className="assistant-msg-role">
                    {m.role === 'user' ? 'Вы' : 'Помощник'}
                  </span>
                  {m.role === 'assistant' ? (
                    <AssistantMessageBody message={m} />
                  ) : (
                    <div className="assistant-msg-text">{m.content}</div>
                  )}
                  {m.role === 'assistant' &&
                    isStreamingMsg &&
                    !m.content &&
                    !m.reasoning &&
                    !streamingStatus && (
                      <Loader2 size={14} className="animate-spin assistant-streaming-spinner" />
                    )}
                  {m.tools && m.tools.length > 0 && (
                    <div className="assistant-tool-log">Использовано: {formatToolLog(m.tools)}</div>
                  )}
                </div>
              );
            })}
            {pendingAction && (
              <div className="assistant-pending">
                <p className="assistant-pending-title">
                  {toolLabel(pendingAction.tool)}
                </p>
                <p className="assistant-pending-desc">{pendingAction.description}</p>
                <div className="assistant-pending-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={loading}
                    onClick={handleConfirm}
                  >
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={loading}
                    onClick={handleCancelPending}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
            {error && <p className="assistant-error">{error}</p>}
          </div>
          <form className="assistant-panel-foot" onSubmit={handleSubmit}>
            <input
              className="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chatAvailable ? 'Сообщение…' : 'LLM недоступен'}
              disabled={!chatAvailable || loading}
            />
            <button
              type="submit"
              className="btn btn-primary p-2 shrink-0"
              disabled={!chatAvailable || loading || !input.trim()}
              aria-label="Отправить"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      )}
      {deleteTarget && (
        <DeleteChatConfirmModal
          title={deleteTarget.title}
          isPending={sessionMutating}
          onClose={() => {
            if (!sessionMutating) setDeleteTarget(null);
          }}
          onConfirm={confirmDeleteSession}
        />
      )}
    </div>
  );
}
