import { AlertTriangle, RefreshCw, Stethoscope, XCircle } from 'lucide-react';
import { Button, Card, Space } from 'antd';
import { PageSkeleton } from '../components/PageSkeleton';
import { AdminAssistantConfigPanel } from '../components/admin-assistant/AdminAssistantConfigPanel';
import { AdminAssistantHelpTab } from '../components/admin-assistant/AdminAssistantHelpTab';
import { AdminAssistantMetricsBar } from '../components/admin-assistant/AdminAssistantMetricsBar';
import { AdminAssistantOverrideForm } from '../components/admin-assistant/AdminAssistantOverrideForm';
import { AdminAssistantProbePanel } from '../components/admin-assistant/AdminAssistantProbePanel';
import { WikiRagHelpModal } from '../components/admin-assistant/WikiRagHelpModal';
import { useAdminAssistantPage } from '../components/admin-assistant/useAdminAssistantPage';

export function AdminAssistantPage() {
  const view = useAdminAssistantPage();

  return (
    <div className="page-stack admin-assistant-page">
      <header className="admin-assistant-page-head">
        <div>
          <h2 className="admin-assistant-page-title">Подключение LLM</h2>
          <p className="admin-assistant-lead">
            Временный override без рестарта; постоянные параметры — в <code>app.env</code> на сервере.
          </p>
        </div>
        <ol className="admin-assistant-steps" aria-label="Шаги настройки">
          <li className="admin-assistant-steps__item admin-assistant-steps__item--done">1. Статус</li>
          <li className="admin-assistant-steps__item">2. Настроить</li>
          <li className="admin-assistant-steps__item">3. Проверить</li>
        </ol>
      </header>

      <nav className="admin-assistant-tabs" aria-label="Разделы страницы">
        <button
          type="button"
          className={`admin-assistant-tabs__btn${view.pageTab === 'main' ? ' admin-assistant-tabs__btn--active' : ''}`}
          onClick={() => view.setPageTab('main')}
        >
          Статус и настройка
        </button>
        <button
          type="button"
          className={`admin-assistant-tabs__btn${view.pageTab === 'help' ? ' admin-assistant-tabs__btn--active' : ''}`}
          onClick={() => view.setPageTab('help')}
        >
          Справка и пресеты
        </button>
      </nav>

      <div className="admin-assistant-toolbar">
        <div className="admin-assistant-form-actions" style={{ marginTop: 0 }}>
          <Space>
            <Button
              size="small"
              icon={<Stethoscope size={14} aria-hidden />}
              onClick={() => {
                view.setProbeExpanded(true);
                view.probeMut.mutate();
              }}
              loading={view.probeMut.isPending}
              disabled={view.busy || view.config?.partial}
            >
              {view.probeMut.isPending ? 'Проверка…' : 'Проверить подключение'}
            </Button>
            <Button
              size="small"
              icon={
                <RefreshCw
                  size={14}
                  className={view.isFetching ? 'animate-spin' : undefined}
                  aria-hidden
                />
              }
              onClick={() => void view.refetch()}
              loading={view.isFetching}
            >
              Обновить
            </Button>
          </Space>
        </div>
      </div>

      {view.isError && (
        <div className="admin-assistant-error" role="alert">
          <XCircle size={18} aria-hidden />
          <span>
            {view.error instanceof Error ? view.error.message : 'Не удалось загрузить конфигурацию LLM'}
          </span>
          <Button size="small" onClick={() => void view.refetch()}>
            Повторить
          </Button>
        </div>
      )}

      {view.config?.partial && (
        <div className="admin-assistant-alert admin-assistant-alert--info" role="status">
          <AlertTriangle size={16} aria-hidden />
          <span>
            Backend устарел — доступен только базовый статус. Перезапустите <code>run_local.py</code>{' '}
            для полной конфигурации и probe.
          </span>
        </div>
      )}

      {view.pageTab === 'main' && (
        <div className="admin-assistant-stack">
          {view.isLoading && !view.config ? (
            <Card size="small">
              <PageSkeleton lines={6} />
            </Card>
          ) : view.config ? (
            <div className="admin-assistant-stack">
              <AdminAssistantMetricsBar
                config={view.config}
                statusLevel={view.statusLevel}
                ragDisplay={view.ragDisplay}
                hasOverride={view.hasOverride}
                onWikiRagHelp={() => view.setWikiRagHelpOpen(true)}
              />

              <AdminAssistantProbePanel
                probe={view.probeResult}
                loading={view.probeMut.isPending}
                expanded={view.probeExpanded}
                onToggle={() => view.setProbeExpanded((v) => !v)}
                onFixEmbeddings={() => view.setWikiRagHelpOpen(true)}
              />

              <div className="admin-assistant-grid">
                <AdminAssistantConfigPanel
                  config={view.config}
                  hasOverride={view.hasOverride}
                  onCopy={view.toastCopy}
                />
                <AdminAssistantOverrideForm view={view} />
              </div>
            </div>
          ) : null}
        </div>
      )}

      <WikiRagHelpModal
        open={view.wikiRagHelpOpen}
        onClose={() => view.setWikiRagHelpOpen(false)}
        onApplyEmbeddingPreset={view.applyEmbeddingPreset}
      />

      {view.pageTab === 'help' && <AdminAssistantHelpTab view={view} />}
    </div>
  );
}
