import { useMemo } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AssistantLlmProbeDetail, AssistantLlmProbeSlice } from '../../lib/api';
import { AppDataTable } from '../AppDataTable';

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

type ProbeTableRow = {
  key: string;
  label: string;
  slice?: AssistantLlmProbeSlice;
  ragMode?: string;
  onFix?: () => void;
};

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
  const probeRows = useMemo<ProbeTableRow[]>(() => {
    if (!probe) return [];
    return [
      { key: 'models', label: 'Chat /models', slice: probe.chat.models },
      { key: 'completion', label: 'Chat /completion', slice: probe.chat.completion },
      {
        key: 'embeddings',
        label: 'Embeddings',
        slice: probe.embeddings,
        onFix: !probe.embeddings.ok ? onFixEmbeddings : undefined,
      },
      { key: 'rag', label: 'RAG mode', ragMode: probe.rag_mode },
    ];
  }, [onFixEmbeddings, probe]);

  const columns = useMemo<ColumnsType<ProbeTableRow>>(
    () => [
      {
        title: 'Проверка',
        dataIndex: 'label',
        key: 'label',
        onCell: (row) => (row.ragMode == null ? { scope: 'row' as const } : {}),
      },
      {
        title: 'Статус',
        key: 'status',
        render: (_, row) => {
          if (row.ragMode != null) return <code>{row.ragMode}</code>;
          return row.slice ? statusChip(row.slice) : null;
        },
      },
      {
        title: 'Подсказка',
        key: 'hint',
        className: 'admin-assistant-probe-table__hint',
        render: (_, row) => row.slice?.hint_ru ?? (row.ragMode != null ? '—' : null),
      },
      {
        title: 'Действие',
        key: 'action',
        className: 'admin-assistant-probe-table__action',
        render: (_, row) => {
          if (row.ragMode != null) return '—';
          if (row.slice && !row.slice.ok && row.onFix) {
            return (
              <Button type="link" size="small" className="admin-assistant-metric-action" onClick={row.onFix}>
                Как исправить
              </Button>
            );
          }
          return '—';
        },
      },
    ],
    [],
  );

  return (
    <Card size="small" className="admin-assistant-probe-panel">
      <Button
        type="text"
        block
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
      </Button>
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
              <AppDataTable
                className="admin-assistant-probe-table"
                rowKey="key"
                columns={columns}
                dataSource={probeRows}
              />
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
