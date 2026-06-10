import type { AssistantMessage, ChatMessage } from './types';

export type ParsedAssistantContent = {
  reasoning: string | null;
  content: string;
};

const THINK_INNER = /<\s*think\s*>([\s\S]*?)<\s*\/\s*think\s*>/gi;
const REASONING_INNER = /<reasoning>([\s\S]*?)<\/reasoning>/gi;
const REDACTED_INNER =
  /<\s*redacted_reasoning\s*>([\s\S]*?)<\s*\/\s*redacted_reasoning\s*>/gi;

function extractBlocks(text: string, pattern: RegExp): string[] {
  const parts: string[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const inner = match[1]?.trim();
    if (inner) parts.push(inner);
  }
  return parts;
}

function mergeReasoningParts(...parts: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    merged.push(trimmed);
  }
  return merged.join('\n\n').trim() || null;
}

/** Client-side fallback if backend did not split reasoning (older API). */
export function splitReasoningAnswer(text: string): ParsedAssistantContent {
  const patterns = [THINK_INNER, REASONING_INNER, REDACTED_INNER];
  const reasoningParts: string[] = [];
  let answer = text;
  for (const pattern of patterns) {
    reasoningParts.push(...extractBlocks(answer, pattern));
    pattern.lastIndex = 0;
    answer = answer.replace(pattern, '');
  }

  return {
    reasoning: reasoningParts.join('\n\n').trim() || null,
    content: answer.trim(),
  };
}

export function displayAssistantMessage(message: {
  content: string;
  reasoning?: string | null;
}): ParsedAssistantContent {
  const fromContent = splitReasoningAnswer(message.content);
  return {
    reasoning: mergeReasoningParts(message.reasoning, fromContent.reasoning),
    content: fromContent.content,
  };
}

/** History for API: only clean answer text, never reasoning or think blocks. */
export function toChatHistory(messages: AssistantMessage[]): ChatMessage[] {
  return messages
    .map((m) => {
      if (m.role === 'assistant') {
        const { content } = displayAssistantMessage(m);
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    })
    .filter((m) => m.content.trim().length > 0);
}

export function normalizeAssistantMessage(message: AssistantMessage): AssistantMessage {
  if (message.role !== 'assistant') return message;
  const parsed = displayAssistantMessage(message);
  return {
    ...message,
    content: parsed.content,
    reasoning: parsed.reasoning,
  };
}
