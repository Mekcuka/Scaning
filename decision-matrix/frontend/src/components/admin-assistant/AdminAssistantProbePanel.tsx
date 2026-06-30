import { ChevronDown, Loader2 } from 'lucide-react';
import { Card } from 'antd';
import type { AssistantLlmProbeDetail, AssistantLlmProbeSlice } from '../../lib/api';

function statusChip(slice: AssistantLlmProbeSlice) {
  if (slice.ok) {
    return (
      <span className="admin-assistant-probe-table__chip admin-assistant-probe-table__chip--ok">
        OK{slice.http_status != null ? ` ${slice.http_status}` : ''}
      </span>
    );
  }
  return (
    <span className="admin-assistant-probe-table__chip admin-assistant-probe-table__chip--bad">
      {slice.http_status != null ? `HTTP ${slice.http_status}` : 'Ошибка'}
    </span>
  );
}

function ProbeRow({
  label,
  slice,
  onFix,
}: {
  label: string;
  slice: AssistantLlmProbeSlice;
  onFix?: () => void;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{statusChip(slice)}</td>
      <td className="admin-assistant-probe-table__hint">{slice.hint_ru}</td>
      <td className="admin-assistant-probe-table__action">
        {!slice.ok && onFix ? (
          <button type="button" className="admin-assistant-metric-action" onClick={onFix}>
            Как исправить
          </button>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

type Props = {
  probe: AssistantLlmProbeDetail | null;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onFixEmbeddings?: () => void;
};

export function AdminAssistantProbePanel({
  probe,
  loading,
  expanded,
  onToggle,
  onFixEmbeddings,
}: Props) {
  return (
    <Card size="small" className="admin-assistant-probe-panel">
      <button
        type="button"
        className="admin-assistant-probe-panel__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="admin-assistant-probe-panel__title">
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Проверка подключения…
            </>
          ) : (
            'Детали проверки'
          )}
        </span>
        {probe?.fallback && (
          <span className="admin-assistant-chip">упрощённый режим</span>
        )}
        <ChevronDown size={18} className={expanded ? 'admin-assistant-probe-panel__chev--open' : undefined} />
      </button>
      {expanded && (
        <div className="admin-assistant-probe-panel__body">
          {loading && !probe ? (
            <p className="admin-assistant-field__hint">Запрос к LLM и embeddings…</p>
          ) : probe ? (
            <>
              {probe.fallback && (
                <div className="admin-assistant-alert admin-assistant-alert--info">
                  Детальный probe недоступен — показан статус из конфигурации. Перезапустите backend
                  (run_local.py).
                </div>
              )}
              <table className="admin-assistant-probe-table">
                <thead>
                  <tr>
                    <th scope="col">Проверка</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Подсказка</th>
                    <th scope="col">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  <ProbeRow label="Chat /models" slice={probe.chat.models} />
                  <ProbeRow label="Chat /completion" slice={probe.chat.completion} />
                  <ProbeRow
                    label="Embeddings"
                    slice={probe.embeddings}
                    onFix={!probe.embeddings.ok ? onFixEmbeddings : undefined}
                  />
                  <tr>
                    <th scope="row">RAG mode</th>
                    <td colSpan={3}>
                      <code>{probe.rag_mode}</code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            <p className="admin-assistant-field__hint">
              Нажмите «Проверить подключение», чтобы увидеть HTTP-коды и подсказки.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
