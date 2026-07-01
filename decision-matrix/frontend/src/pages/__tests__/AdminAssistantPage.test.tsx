import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminAssistantPage } from '../AdminAssistantPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore, seedAuthUser } from '../../test/pages/seedAppStore';
import { api } from '../../lib/api';
import { assistantApi } from '../../lib/assistant/assistantApi';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

vi.mock('../../lib/assistant/assistantApi', () => ({
  assistantApi: {
    getStatus: vi.fn(),
  },
}));

const MOCK_LLM_CONFIG = {
  provider_ready: true,
  chat_enabled: true,
  effective: {
    base_url: 'https://openrouter.ai/api/v1',
    model: 'nvidia/nemotron-nano-9b-v2:free',
    api_key_masked: '***abcd',
    api_key_source: 'env',
    max_tokens: 4096,
    timeout_seconds: 120,
  },
  embedding_effective: {
    base_url: 'https://openrouter.ai/api/v1',
    model: 'text-embedding-3-small',
    api_key_masked: null,
    uses_chat_config: true,
  },
  env: {
    base_url: 'https://openrouter.ai/api/v1',
    model: 'nvidia/nemotron-nano-9b-v2:free',
    max_tokens: 4096,
    timeout_seconds: 120,
    api_key_configured: true,
  },
  runtime_override: {},
  wiki_rag: { enabled: true, embedding_ready: true, rag_mode: 'embedding', embedding_model: 'text-embedding-3-small' },
};

describe('AdminAssistantPage', () => {
  beforeEach(() => {
    seedAppStore();
    seedAuthUser({ role: 'admin' });
    vi.mocked(api.getAssistantLlmConfig).mockResolvedValue(MOCK_LLM_CONFIG);
    vi.mocked(api.probeAssistantLlm).mockResolvedValue({
      provider_ready: true,
      fallback: false,
      rag_mode: 'embedding',
      chat: {
        models: { ok: true, http_status: 200, hint_ru: 'OK' },
        completion: { ok: true, http_status: 200, hint_ru: 'OK' },
      },
      embeddings: { ok: true, http_status: 200, hint_ru: 'OK' },
    });
    vi.mocked(assistantApi.getStatus).mockResolvedValue({
      enabled: true,
      model: 'nvidia/nemotron-nano-9b-v2:free',
      provider_ready: true,
      base_url: 'https://openrouter.ai/api/v1',
      mcp_url: 'http://127.0.0.1:8000/api/v1/mcp',
      mcp_token_ttl_minutes: 60,
      mcp_setup_hint_ru: 'scripts/get-atlas-grid-token.ps1',
    });
  });

  it('renders LLM config for admin without exposing full api key', async () => {
    renderPage(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="assistant" element={<AdminAssistantPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/admin/assistant'] },
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Текущая конфигурация' })).toBeInTheDocument(),
    );

    await waitFor(() => expect(screen.getByText('Доступен')).toBeInTheDocument());
    expect(screen.getByText('Включён')).toBeInTheDocument();
    expect(screen.getAllByText(/nvidia\/nemotron-nano-9b-v2:free/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\*\*\*abcd/)).toBeInTheDocument();

    const secretKey = 'sk-super-secret-openrouter-key-12345';
    expect(document.body.textContent).not.toContain(secretKey);
  });

  it('shows provider reference table', async () => {
    const user = userEvent.setup();
    renderPage(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="assistant" element={<AdminAssistantPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/admin/assistant'] },
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Текущая конфигурация' })).toBeInTheDocument(),
    );

    const tabNav = screen.getAllByRole('navigation', { name: 'Разделы страницы' })[0]!;
    await user.click(within(tabNav).getByRole('button', { name: 'Справка и пресеты' }));
    await user.click(screen.getAllByRole('button', { name: 'Развернуть' })[0]!);

    await waitFor(() =>
      expect(
        screen.getAllByRole('heading', { name: 'Справка: провайдеры LLM' })[0],
      ).toBeInTheDocument(),
    );

    expect(screen.getAllByText('OpenRouter')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Ollama')[0]).toBeInTheDocument();
  });
});
