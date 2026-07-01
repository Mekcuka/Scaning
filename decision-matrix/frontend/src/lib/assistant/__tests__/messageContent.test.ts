import { describe, expect, it } from 'vitest';

import {
  displayAssistantMessage,
  splitReasoningAnswer,
  toChatHistory,
} from '../messageContent';

describe('splitReasoningAnswer', () => {
  it('extracts think blocks from answer text', () => {
    const thinkOpen = '<' + 'think' + '>';
    const thinkClose = '</' + 'think' + '>';
    const parsed = splitReasoningAnswer(
      `Сначала ${thinkOpen}Нужно посчитать проекты.${thinkClose}В системе 3 проекта.`,
    );
    expect(parsed.reasoning).toContain('посчитать');
    expect(parsed.content).toContain('В системе 3 проекта.');
  });

  it('returns full text as content when no think blocks', () => {
    const parsed = splitReasoningAnswer('Простой ответ.');
    expect(parsed.reasoning).toBeNull();
    expect(parsed.content).toBe('Простой ответ.');
  });
});

describe('displayAssistantMessage', () => {
  it('prefers explicit reasoning field from API', () => {
    const parsed = displayAssistantMessage({
      content: 'Ответ.',
      reasoning: 'Шаг 1',
    });
    expect(parsed.reasoning).toBe('Шаг 1');
    expect(parsed.content).toBe('Ответ.');
  });

  it('strips think blocks from content even when reasoning field is set', () => {
    const thinkOpen = '<' + 'think' + '>';
    const thinkClose = '</' + 'think' + '>';
    const parsed = displayAssistantMessage({
      content: `${thinkOpen}скрытое${thinkClose}Видимый ответ.`,
      reasoning: 'из API',
    });
    expect(parsed.content).toBe('Видимый ответ.');
    expect(parsed.reasoning).toContain('скрытое');
    expect(parsed.reasoning).toContain('из API');
  });
});

describe('toChatHistory', () => {
  it('sends only cleaned assistant answers to the API', () => {
    const thinkOpen = '<' + 'think' + '>';
    const thinkClose = '</' + 'think' + '>';
    const history = toChatHistory([
      { role: 'user', content: 'Привет' },
      {
        role: 'assistant',
        content: `${thinkOpen}думаю${thinkClose}Итог.`,
        reasoning: 'думаю',
      },
    ]);
    expect(history).toEqual([
      { role: 'user', content: 'Привет' },
      { role: 'assistant', content: 'Итог.' },
    ]);
  });
});
