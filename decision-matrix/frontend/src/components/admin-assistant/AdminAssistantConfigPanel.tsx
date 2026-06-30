import { Zap } from 'lucide-react';
import { Card } from 'antd';
import type { AssistantLlmConfigDetail } from '../../lib/api';
import { apiKeySourceLabel, ConfigValue, envDiff } from './adminAssistantDisplay';

export function AdminAssistantConfigPanel({
  config,
  hasOverride,
  onCopy,
}: {
  config: AssistantLlmConfigDetail;
  hasOverride: boolean;
  onCopy: (msg: string) => void;
}) {
  return (
    <Card size="small">
      <div className="admin-assistant-card-head">
        <h2>Текущая конфигурация</h2>
        {hasOverride && (
          <span className="admin-assistant-chip admin-assistant-chip--active">
            <Zap size={12} aria-hidden />
            Override
          </span>
        )}
      </div>

      {hasOverride && (
        <div className="admin-assistant-alert admin-assistant-alert--info">
          Effective-значения ниже учитывают временный override. После рестарта backend вернутся
          параметры из <code>app.env</code>.
        </div>
      )}

      <dl className="admin-assistant-kv">
        <div className={`admin-assistant-kv__row${envDiff(config, 'base_url') ? ' admin-assistant-kv__row--diff' : ''}`}>
          <dt className="admin-assistant-kv__key">Base URL</dt>
          <dd className="admin-assistant-kv__value">
            <ConfigValue
              value={config.effective.base_url ?? '—'}
              mono={Boolean(config.effective.base_url)}
              copyValue={config.effective.base_url ?? undefined}
              onCopy={onCopy}
            />
          </dd>
        </div>
        <div className={`admin-assistant-kv__row${envDiff(config, 'model') ? ' admin-assistant-kv__row--diff' : ''}`}>
          <dt className="admin-assistant-kv__key">Модель</dt>
          <dd className="admin-assistant-kv__value">
            <ConfigValue
              value={config.effective.model ?? '—'}
              mono={Boolean(config.effective.model)}
              copyValue={config.effective.model ?? undefined}
              onCopy={onCopy}
            />
          </dd>
        </div>
        <div className={`admin-assistant-kv__row${envDiff(config, 'max_tokens') ? ' admin-assistant-kv__row--diff' : ''}`}>
          <dt className="admin-assistant-kv__key">Max tokens</dt>
          <dd className="admin-assistant-kv__value">
            {config.effective.max_tokens > 0 ? config.effective.max_tokens : '—'}
          </dd>
        </div>
        <div className={`admin-assistant-kv__row${envDiff(config, 'timeout_seconds') ? ' admin-assistant-kv__row--diff' : ''}`}>
          <dt className="admin-assistant-kv__key">Timeout</dt>
          <dd className="admin-assistant-kv__value">
            {config.effective.timeout_seconds > 0
              ? `${config.effective.timeout_seconds} с`
              : '—'}
          </dd>
        </div>
        <div className="admin-assistant-kv__row">
          <dt className="admin-assistant-kv__key">API key</dt>
          <dd className="admin-assistant-kv__value">
            {config.effective.api_key_masked ? (
              <>
                <code>{config.effective.api_key_masked}</code>
                <span className="admin-assistant-chip">
                  {apiKeySourceLabel(config.effective.api_key_source)}
                </span>
              </>
            ) : (
              <span className="admin-assistant-chip">
                {apiKeySourceLabel(config.effective.api_key_source)}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <h3 className="admin-assistant-subhead">Wiki RAG / Embeddings</h3>
      <dl className="admin-assistant-kv">
        <div className="admin-assistant-kv__row">
          <dt className="admin-assistant-kv__key">Embedding URL</dt>
          <dd className="admin-assistant-kv__value">
            {config.embedding_effective?.base_url ?? '—'}
            {config.embedding_effective?.uses_chat_config && (
              <span className="admin-assistant-chip">как chat</span>
            )}
          </dd>
        </div>
        <div className="admin-assistant-kv__row">
          <dt className="admin-assistant-kv__key">Embedding model</dt>
          <dd className="admin-assistant-kv__value">
            <code>
              {config.wiki_rag.embedding_model ?? config.embedding_effective?.model ?? '—'}
            </code>
          </dd>
        </div>
      </dl>

      {hasOverride && (
        <div className="admin-assistant-override-active">
          {Object.entries(config.runtime_override).map(([key, val]) => (
            <span key={key} className="admin-assistant-chip admin-assistant-chip--active">
              {key}={val ?? '—'}
            </span>
          ))}
        </div>
      )}

      <p className="admin-assistant-footnote">
        Постоянные изменения: переменные <code>ASSISTANT_LLM_*</code> и{' '}
        <code>ASSISTANT_WIKI_EMBEDDING_*</code> в <code>app.env</code> и перезапуск контейнера API
        (см. DEPLOY.md).
      </p>
    </Card>
  );
}
