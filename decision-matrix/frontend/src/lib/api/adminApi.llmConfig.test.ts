import { describe, expect, it, vi, beforeEach } from 'vitest';
import { llmConfigFromAssistantStatus } from './adminApi';
import { assistantApi } from '../assistant/assistantApi';

vi.mock('./client', () => ({
  request: vi.fn(),
}));

vi.mock('../assistant/assistantApi', () => ({
  assistantApi: { getStatus: vi.fn() },
}));

describe('fetchAssistantLlmConfig fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('falls back to assistant status on Method Not Allowed', async () => {
    const { request } = await import('./client');
    vi.mocked(request).mockRejectedValue(new Error('Method Not Allowed'));
    vi.mocked(assistantApi.getStatus).mockResolvedValue({
      enabled: true,
      model: 'test-model',
      provider_ready: true,
      base_url: 'https://openrouter.ai/api/v1',
      llm_override: { api_key: 'secret-key-9999' },
    });

    const { adminApi } = await import('./adminApi');
    const cfg = await adminApi.getAssistantLlmConfig();

    expect(cfg.partial).toBe(true);
    expect(cfg.effective.model).toBe('test-model');
    expect(cfg.runtime_override.api_key).toBe('***…9999');
    expect(JSON.stringify(cfg)).not.toContain('secret-key');
  });
});

describe('llmConfigFromAssistantStatus', () => {
  it('masks api key in override snapshot', () => {
    const cfg = llmConfigFromAssistantStatus({
      enabled: true,
      model: 'm',
      provider_ready: false,
      base_url: 'http://localhost/v1',
      llm_override: { api_key: 'abcd1234' },
    });
    expect(cfg.effective.api_key_masked).toBe('***…1234');
  });
});
