import type { ChatSessionSummary } from './types';

export function formatSessionWhen(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'только что';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} мин назад`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} ч назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function sessionListLabel(session: ChatSessionSummary): string {
  const when = formatSessionWhen(session.updated_at);
  const count =
    session.message_count > 0 ? ` · ${session.message_count} сообщ.` : ' · пустой';
  return `${session.title}${count} · ${when}`;
}

export function findReusableEmptySession(
  sessions: ChatSessionSummary[],
): ChatSessionSummary | undefined {
  return sessions.find((s) => s.title === 'Новый чат' && s.message_count === 0);
}
