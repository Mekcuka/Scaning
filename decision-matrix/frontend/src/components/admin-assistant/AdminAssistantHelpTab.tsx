import { Bot, CheckCircle2, ChevronDown, Copy, XCircle } from 'lucide-react';
import { Button, Card } from 'antd';
import { LLM_PROVIDERS } from './adminAssistantConstants';
import { copyText } from './adminAssistantDisplay';
import type { AdminAssistantPageView } from './useAdminAssistantPage';

export function AdminAssistantHelpTab({ view }: { view: AdminAssistantPageView }) {
  const {
    localPresets,
    providersOpen,
    setProvidersOpen,
    applyProviderPreset,
    mcpOpen,
    setMcpOpen,
    assistantStatus,
    config,
    toastCopy,
  } = view;

  return (
    <div className="admin-assistant-stack">
      <Card size="small">
        <div className="admin-assistant-card-head">
          <h2>Справка: провайдеры LLM</h2>
          <Button type="text" size="small" onClick={() => setProvidersOpen((v) => !v)} aria-expanded={providersOpen}>
            {providersOpen ? 'Свернуть' : 'Развернуть'}
          </Button>
        </div>
        {localPresets.length > 0 && (
          <div className="admin-assistant-local-presets">
            <span className="admin-assistant-field__label">Локальные пресеты</span>
            <div className="admin-assistant-override-active">
              {localPresets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="admin-assistant-chip"
                  onClick={() => applyProviderPreset(p.base_url, p.model, p.embedding_model)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {providersOpen && (
          <div className="admin-assistant-provider-grid">
            {LLM_PROVIDERS.map((p) => (
              <article key={p.name} className="admin-assistant-provider-card">
                <div className="admin-assistant-provider-card__head">
                  <span className="admin-assistant-provider-card__name">{p.name}</span>
                  <Button
                    size="small"
                    onClick={() =>
                      applyProviderPreset(
                        p.base_url,
                        p.model_hint,
                        'embedding_model' in p ? p.embedding_model : undefined,
                      )
                    }
                  >
                    Подставить
                  </Button>
                </div>
                <dl>
                  <div>
                    <dt>Base URL</dt>
                    <dd>
                      <code>{p.base_url}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>API key</dt>
                    <dd>
                      <code>{p.api_key}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Пример модели</dt>
                    <dd>
                      <code>{p.model_hint}</code>
                    </dd>
                  </div>
                </dl>
                <p className="admin-assistant-provider-card__note">{p.note}</p>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card size="small">
        <button
          type="button"
          className="admin-assistant-mcp-toggle"
          onClick={() => setMcpOpen((v) => !v)}
          aria-expanded={mcpOpen}
        >
          <Bot size={18} aria-hidden />
          Cursor MCP (Atlas Grid)
          <ChevronDown size={18} aria-hidden />
        </button>
        {mcpOpen && (
          <div className="admin-assistant-mcp-body">
            <p>
              {assistantStatus?.mcp_setup_hint_ru ??
                'Выполните scripts/get-atlas-grid-token.ps1 и перезагрузите MCP в Cursor (Settings → Tools & MCP).'}
            </p>
            {assistantStatus?.mcp_url && (
              <p className="flex flex-wrap items-center gap-2" style={{ color: 'var(--text)' }}>
                <span>URL:</span>
                <code>{assistantStatus.mcp_url}</code>
                <button
                  type="button"
                  className="admin-assistant-copy-btn"
                  title="Копировать URL"
                  aria-label="Копировать MCP URL"
                  onClick={() => void copyText(assistantStatus.mcp_url!, toastCopy)}
                >
                  <Copy size={13} aria-hidden />
                </button>
                {assistantStatus.mcp_token_ttl_minutes ? (
                  <span>· токен ~{assistantStatus.mcp_token_ttl_minutes} мин</span>
                ) : null}
              </p>
            )}
            {!assistantStatus?.provider_ready && config && !config.provider_ready && (
              <p className="flex items-center gap-1" style={{ color: '#b91c1c' }}>
                <XCircle size={14} aria-hidden />
                LLM недоступен — чат может не отвечать, MCP read-only tools работают отдельно.
              </p>
            )}
            {assistantStatus?.provider_ready && (
              <p className="flex items-center gap-1" style={{ color: '#15803d' }}>
                <CheckCircle2 size={14} aria-hidden />
                Публичный статус assistant: провайдер отвечает на probe.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
