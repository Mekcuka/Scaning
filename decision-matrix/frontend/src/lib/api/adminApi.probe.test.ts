import { describe, expect, it, vi, beforeEach } from 'vitest';

const { requestMock, getStatusMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  getStatusMock: vi.fn(),
}));

vi.mock('./client', () => ({
  request: requestMock,
}));

vi.mock('../assistant/assistantApi', () => ({
  assistantApi: {
    getStatus: getStatusMock,
  },
}));

describe('probeAssistantLlm fallback', () => {
  beforeEach(() => {
    requestMock.mockReset();
    getStatusMock.mockReset();
  });

  it('falls back to llm-config when probe endpoint is missing', async () => {
    requestMock.mockImplementation(async (path: string) => {
      if (path === '/admin/assistant/llm-probe') {
        throw new Error('Not Found');
      }
      if (path === '/admin/assistant/llm-config') {
        return {
          provider_ready: false,
          chat_enabled: true,
          effective: {
            base_url: 'http://127.0.0.1:1234/v1',
            model: 'test',
            api_key_masked: null,
            api_key_source: 'env',
            max_tokens: 1024,
            timeout_seconds: 120,
          },
          embedding_effective: {
            base_url: 'http://127.0.0.1:1234/v1',
            model: 'nomic-embed-text',
            api_key_masked: null,
            uses_chat_config: true,
          },
          env: {
            base_url: 'http://127.0.0.1:1234/v1',
            model: 'test',
            max_tokens: 1024,
            timeout_seconds: 120,
            api_key_configured: true,
          },
          runtime_override: {},
          wiki_rag: { enabled: true, embedding_ready: false, rag_mode: 'tfidf' },
        };
      }
      throw new Error(`unexpected ${path}`);
    });

    const { adminApi } = await import('./adminApi');
    const result = await adminApi.probeAssistantLlm();

    expect(result.fallback).toBe(true);
    expect(result.rag_mode).toBe('tfidf');
    expect(result.embeddings.ok).toBe(false);
  });
});
