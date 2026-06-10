import { describe, expect, it } from 'vitest';

import { findReusableEmptySession, formatSessionWhen } from './sessionDisplay';
import type { ChatSessionSummary } from './types';

function makeSession(overrides: Partial<ChatSessionSummary> = {}): ChatSessionSummary {
  return {
    id: 's1',
    title: 'Новый чат',
    project_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    message_count: 0,
    ...overrides,
  };
}

describe('sessionDisplay', () => {
  it('findReusableEmptySession picks empty default chat', () => {
    const sessions = [
      makeSession({ id: 'a', title: 'Тарифы', message_count: 2 }),
      makeSession({ id: 'b', message_count: 0 }),
    ];
    expect(findReusableEmptySession(sessions)?.id).toBe('b');
  });

  it('formatSessionWhen returns relative label', () => {
    const label = formatSessionWhen(new Date().toISOString());
    expect(label).toBe('только что');
  });
});
