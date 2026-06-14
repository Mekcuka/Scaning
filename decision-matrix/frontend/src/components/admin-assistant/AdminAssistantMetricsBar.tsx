import {
  BookOpen,
  CircleHelp,
  MessageSquare,
  Server,
  Zap,
} from 'lucide-react';
import type { AssistantLlmConfigDetail } from '../../lib/api';

export function AdminAssistantMetricsBar({
  config,
  statusLevel,
  ragDisplay,
  hasOverride,
  onWikiRagHelp,
}: {
  config: AssistantLlmConfigDetail;
  statusLevel: 'ok' | 'warn' | 'bad';
  ragDisplay: { text: string; tone: 'ok' | 'warn' | 'muted' } | null;
  hasOverride: boolean;
  onWikiRagHelp: () => void;
}) {
  return (
    <div className={`admin-assistant-metrics admin-assistant-metrics--${statusLevel}`} role="status">
      <div className="admin-assistant-metric">
        <Server
          size={18}
          className={`admin-assistant-metric__icon ${config.provider_ready ? 'admin-assistant-metric__icon--ok' : 'admin-assistant-metric__icon--bad'}`}
          aria-hidden
        />
        <div>
          <div className="admin-assistant-metric__label">LLM-провайдер</div>
          <div className="admin-assistant-metric__value">
            {config.provider_ready ? 'Доступен' : 'Недоступен'}
          </div>
        </div>
      </div>
      <div className="admin-assistant-metric">
        <MessageSquare
          size={18}
          className={`admin-assistant-metric__icon ${config.chat_enabled ? 'admin-assistant-metric__icon--ok' : 'admin-assistant-metric__icon--bad'}`}
          aria-hidden
        />
        <div>
          <div className="admin-assistant-metric__label">Веб-чат</div>
          <div className="admin-assistant-metric__value">
            {config.chat_enabled ? 'Включён' : 'Выключен'}
          </div>
        </div>
      </div>
      <div className="admin-assistant-metric">
        <BookOpen
          size={18}
          className={`admin-assistant-metric__icon ${
            ragDisplay?.tone === 'ok'
              ? 'admin-assistant-metric__icon--ok'
              : ragDisplay?.tone === 'warn'
                ? 'admin-assistant-metric__icon--bad'
                : ''
          }`}
          aria-hidden
        />
        <div>
          <div className="admin-assistant-metric__label">Wiki RAG</div>
          <div className="admin-assistant-metric__value">{ragDisplay?.text}</div>
          {(config.wiki_rag.rag_mode && config.wiki_rag.enabled) || ragDisplay?.tone === 'warn' ? (
            <div className="admin-assistant-metric__footer">
              {config.wiki_rag.rag_mode && config.wiki_rag.enabled && (
                <span className="admin-assistant-metric__meta">mode: {config.wiki_rag.rag_mode}</span>
              )}
              {ragDisplay?.tone === 'warn' && (
                <button type="button" className="admin-assistant-metric-action" onClick={onWikiRagHelp}>
                  <CircleHelp size={13} aria-hidden />
                  Как исправить
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <div className="admin-assistant-metric">
        <Zap
          size={18}
          className={`admin-assistant-metric__icon ${hasOverride ? 'admin-assistant-metric__icon--ok' : ''}`}
          aria-hidden
        />
        <div>
          <div className="admin-assistant-metric__label">Runtime override</div>
          <div className="admin-assistant-metric__value">{hasOverride ? 'Активен' : 'Не задан'}</div>
        </div>
      </div>
    </div>
  );
}
