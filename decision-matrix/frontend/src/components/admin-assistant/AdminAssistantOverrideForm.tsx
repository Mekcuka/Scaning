import { AlertTriangle, ChevronDown, KeyRound, Save } from 'lucide-react';
import { Button, Card, Input, Space } from 'antd';import { AdminAssistantModelField } from './AdminAssistantModelField';
import type { AdminAssistantPageView } from './useAdminAssistantPage';

export function AdminAssistantOverrideForm({ view }: { view: AdminAssistantPageView }) {
  const {
    overrideFormRef,
    overrideHighlight,
    overrideTab,
    setOverrideTab,
    overrideForm,
    setOverrideForm,
    config,
    modelOptions,
    busy,
    canApplyOverride,
    hasOverride,
    embeddingsOpen,
    setEmbeddingsOpen,
    updateMut,
    resetMut,
    testMut,
    buildOverrideBody,
    saveCurrentAsPreset,
  } = view;

  if (!config) return null;

  return (
    <Card size="small" className="admin-assistant-override-card">
      <div className="admin-assistant-card-head">
        <h2>Временный override</h2>
      </div>

      <div className="admin-assistant-alert">
        <AlertTriangle size={16} aria-hidden />
        <span>
          Действует только в памяти процесса до рестарта backend. Не записывает ключ в файл и не
          заменяет <code>app.env</code>.
        </span>
      </div>

      <nav className="admin-assistant-tabs admin-assistant-tabs--inner" aria-label="Параметры override">
        <button
          type="button"
          className={`admin-assistant-tabs__btn${overrideTab === 'chat' ? ' admin-assistant-tabs__btn--active' : ''}`}
          onClick={() => setOverrideTab('chat')}
        >
          Chat LLM
        </button>
        <button
          type="button"
          className={`admin-assistant-tabs__btn${overrideTab === 'rag' ? ' admin-assistant-tabs__btn--active' : ''}`}
          onClick={() => setOverrideTab('rag')}
        >
          Wiki RAG / Embeddings
        </button>
      </nav>

      <form
        ref={overrideFormRef}
        className={`admin-assistant-form${overrideHighlight ? ' admin-assistant-form--highlight' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          updateMut.mutate(buildOverrideBody());
        }}
      >
        <div className="admin-assistant-form-fields">
          {overrideTab === 'chat' && (
            <>
              <label className="admin-assistant-field">
                <span className="admin-assistant-field__label">Base URL</span>
                <Input
                  className="input--mono"
                  value={overrideForm.base_url}
                  onChange={(e) => setOverrideForm((f) => ({ ...f, base_url: e.target.value }))}
                  placeholder="https://openrouter.ai/api/v1"
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                />              </label>
              <label className="admin-assistant-field">
                <span className="admin-assistant-field__label">Model</span>
                <AdminAssistantModelField
                  value={overrideForm.model}
                  options={modelOptions}
                  disabled={busy}
                  onChange={(model) => setOverrideForm((f) => ({ ...f, model }))}
                />
              </label>
              <div className="admin-assistant-form-row">
                <label className="admin-assistant-field">
                  <span className="admin-assistant-field__label">Max tokens</span>
                  <Input
                    className="input--mono"
                    type="number"
                    min={1}
                    value={overrideForm.max_tokens}
                    onChange={(e) => setOverrideForm((f) => ({ ...f, max_tokens: e.target.value }))}
                    placeholder="1024"
                    disabled={busy}
                  />                </label>
                <label className="admin-assistant-field">
                  <span className="admin-assistant-field__label">Timeout (с)</span>
                  <Input
                    className="input--mono"
                    type="number"
                    min={1}
                    value={overrideForm.timeout_seconds}
                    onChange={(e) =>
                      setOverrideForm((f) => ({ ...f, timeout_seconds: e.target.value }))
                    }
                    placeholder="120"
                    disabled={busy}
                  />                </label>
              </div>
              <label className="admin-assistant-field">
                <span className="admin-assistant-field__label inline-flex items-center gap-1">
                  <KeyRound size={14} aria-hidden />
                  API key
                </span>
                <Input.Password
                  autoComplete="new-password"
                  value={overrideForm.api_key}
                  onChange={(e) => setOverrideForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder="Пусто — не менять текущий ключ"
                  disabled={busy}
                />              </label>
            </>
          )}

          {overrideTab === 'rag' && (
            <>
              <label className="admin-assistant-field admin-assistant-field--checkbox">
                <input
                  type="checkbox"
                  checked={overrideForm.use_chat_for_embeddings}
                  onChange={(e) =>
                    setOverrideForm((f) => ({ ...f, use_chat_for_embeddings: e.target.checked }))
                  }
                  disabled={busy}
                />
                <span>Использовать те же URL и ключ, что для чата</span>
              </label>
              <button
                type="button"
                className="admin-assistant-embed-toggle"
                onClick={() => setEmbeddingsOpen((v) => !v)}
                aria-expanded={embeddingsOpen || !overrideForm.use_chat_for_embeddings}
              >
                <ChevronDown
                  size={16}
                  className={
                    embeddingsOpen || !overrideForm.use_chat_for_embeddings
                      ? 'admin-assistant-probe-panel__chev--open'
                      : undefined
                  }
                />
                Отдельные параметры embeddings
              </button>
              {(embeddingsOpen || !overrideForm.use_chat_for_embeddings) && (
                <>
                  {!overrideForm.use_chat_for_embeddings && (
                    <>
                      <label className="admin-assistant-field">
                        <span className="admin-assistant-field__label">Embedding base URL</span>
                        <Input
                          className="input--mono"
                          value={overrideForm.embedding_base_url}
                          onChange={(e) =>
                            setOverrideForm((f) => ({ ...f, embedding_base_url: e.target.value }))
                          }
                          placeholder="http://127.0.0.1:11434/v1"
                          disabled={busy}
                          autoComplete="off"
                          spellCheck={false}
                        />                      </label>
                      <label className="admin-assistant-field">
                        <span className="admin-assistant-field__label">Embedding API key</span>
                        <Input.Password
                          value={overrideForm.embedding_api_key}
                          onChange={(e) =>
                            setOverrideForm((f) => ({ ...f, embedding_api_key: e.target.value }))
                          }
                          placeholder="Пусто — не менять"
                          disabled={busy}
                          autoComplete="new-password"
                        />                      </label>
                    </>
                  )}
                  <label className="admin-assistant-field">
                    <span className="admin-assistant-field__label">Embedding model</span>
                    <Input
                      className="input--mono"
                      value={overrideForm.embedding_model}
                      onChange={(e) =>
                        setOverrideForm((f) => ({ ...f, embedding_model: e.target.value }))
                      }
                      placeholder="nomic-embed-text"
                      disabled={busy}
                      autoComplete="off"
                      spellCheck={false}
                    />                    <span className="admin-assistant-field__hint">
                      LM Studio: загрузите embedding-модель или укажите отдельный Ollama endpoint.
                    </span>
                  </label>
                </>
              )}
            </>
          )}
        </div>

        <div className="admin-assistant-form-actions">
          <Space wrap>
            <Button disabled={busy || config.partial} loading={testMut.isPending} onClick={() => testMut.mutate()}>
              {testMut.isPending ? 'Тест…' : 'Тестовый запрос'}
            </Button>
            <Button type="primary" htmlType="submit" loading={updateMut.isPending} disabled={busy || !canApplyOverride}>
              {updateMut.isPending ? 'Применение…' : 'Применить'}
            </Button>
            <Button disabled={busy || !hasOverride} loading={resetMut.isPending} onClick={() => resetMut.mutate()}>
              {resetMut.isPending ? 'Сброс…' : 'Сбросить override'}
            </Button>
            <Button
              type="text"
              size="small"
              icon={<Save size={14} aria-hidden />}
              disabled={busy || !overrideForm.base_url.trim()}
              onClick={saveCurrentAsPreset}
              title="Сохранить в localStorage (без секретов)"
            >
              Сохранить пресет
            </Button>
          </Space>
        </div>
      </form>
    </Card>
  );
}
