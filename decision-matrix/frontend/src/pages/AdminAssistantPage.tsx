import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Save,
  Server,
  Stethoscope,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AdminAssistantModelField } from '../components/admin-assistant/AdminAssistantModelField';
import { AdminAssistantProbePanel } from '../components/admin-assistant/AdminAssistantProbePanel';
import { WikiRagHelpModal } from '../components/admin-assistant/WikiRagHelpModal';
import { PageSkeleton } from '../components/PageSkeleton';
import { assistantApi } from '../lib/assistant/assistantApi';
import {
  api,
  loadLlmLocalPresets,
  saveLlmLocalPreset,
  type AssistantLlmConfigDetail,
  type AssistantLlmConfigUpdate,
  type AssistantLlmLocalPreset,
  type AssistantLlmProbeDetail,
} from '../lib/api';
import { useAppStore } from '../store';

const LLM_PROVIDERS = [
  {
    name: 'Ollama',
    base_url: 'http://127.0.0.1:11434/v1',
    api_key: 'ollama',
    model_hint: 'qwen2.5:7b',
    embedding_model: 'nomic-embed-text',
    note: 'Локально: ollama pull … && ollama serve',
  },
  {
    name: 'LM Studio',
    base_url: 'http://127.0.0.1:1234/v1',
    api_key: 'lm-studio',
    model_hint: 'имя модели в LM Studio',
    embedding_model: 'nomic-embed-text',
    note: 'Local Server → OpenAI compatible. Для embeddings загрузите embedding-модель (nomic-embed-text).',
  },
  {
    name: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    api_key: '<ключ openrouter.ai>',
    model_hint: 'nvidia/nemotron-nano-9b-v2:free',
    note: 'Prod: не используйте openrouter/free — возможен content-safety router',
  },
  {
    name: 'Z.AI',
    base_url: 'https://api.z.ai/api/paas/v4',
    api_key: '<ключ z.ai>',
    model_hint: 'glm-5.1',
    note: 'Облачный GLM',
  },
] as const;

function apiKeySourceLabel(source: string): string {
  switch (source) {
    case 'env':
      return 'из .env / app.env';
    case 'override':
      return 'временный override';
    default:
      return 'не задан';
  }
}

function wikiRagLabel(rag: AssistantLlmConfigDetail['wiki_rag']): {
  text: string;
  tone: 'ok' | 'warn' | 'muted';
} {
  if (!rag.enabled) return { text: 'Выключен', tone: 'muted' };
  const mode = rag.rag_mode ?? '';
  if (rag.embedding_ready || mode.includes('embedding')) {
    return { text: 'Embeddings OK', tone: 'ok' };
  }
  return { text: 'Поиск wiki: только ключевые слова', tone: 'warn' };
}

function configStatusLevel(config: AssistantLlmConfigDetail, ragTone: 'ok' | 'warn' | 'muted'): 'ok' | 'warn' | 'bad' {
  if (!config.provider_ready) return 'bad';
  if (ragTone === 'warn') return 'warn';
  return 'ok';
}

async function copyText(text: string, onDone: (msg: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    onDone('Скопировано в буфер обмена');
  } catch {
    onDone('Не удалось скопировать');
  }
}

function ConfigValue({
  value,
  mono = false,
  copyValue,
  onCopy,
}: {
  value: string;
  mono?: boolean;
  copyValue?: string;
  onCopy: (msg: string) => void;
}) {
  const content = mono ? <code>{value}</code> : <span>{value}</span>;
  if (!copyValue) return content;
  return (
    <>
      {content}
      <button
        type="button"
        className="admin-assistant-copy-btn"
        title="Копировать"
        aria-label="Копировать"
        onClick={() => void copyText(copyValue, onDone)}
      >
        <Copy size={13} aria-hidden />
      </button>
    </>
  );

  function onDone(msg: string) {
    onCopy(msg);
  }
}

export function AdminAssistantPage() {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const overrideFormRef = useRef<HTMLFormElement>(null);
  const [overrideHighlight, setOverrideHighlight] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [probeResult, setProbeResult] = useState<AssistantLlmProbeDetail | null>(null);
  const [wikiRagHelpOpen, setWikiRagHelpOpen] = useState(false);
  const [pageTab, setPageTab] = useState<'main' | 'help'>('main');
  const [overrideTab, setOverrideTab] = useState<'chat' | 'rag'>('chat');
  const [probeExpanded, setProbeExpanded] = useState(true);
  const [embeddingsOpen, setEmbeddingsOpen] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);
  const autoProbeDoneRef = useRef(false);
  const [localPresets, setLocalPresets] = useState<AssistantLlmLocalPreset[]>(() => loadLlmLocalPresets());
  const [overrideForm, setOverrideForm] = useState({
    base_url: '',
    model: '',
    api_key: '',
    max_tokens: '',
    timeout_seconds: '',
    embedding_base_url: '',
    embedding_api_key: '',
    embedding_model: '',
    use_chat_for_embeddings: true,
  });

  const {
    data: config,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-assistant-llm'],
    queryFn: () => api.getAssistantLlmConfig(),
  });

  const { data: llmModels } = useQuery({
    queryKey: ['admin-assistant-llm-models', config?.effective.base_url],
    queryFn: () => api.listAssistantLlmModels(),
    enabled: Boolean(config && !config.partial),
    staleTime: 60_000,
  });

  const { data: assistantStatus } = useQuery({
    queryKey: ['assistantStatus'],
    queryFn: () => assistantApi.getStatus(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!config || config.partial) return;
    const emb = config.embedding_effective;
    setOverrideForm((prev) => ({
      ...prev,
      base_url: config.effective.base_url ?? config.env.base_url ?? '',
      model: config.effective.model ?? config.env.model ?? '',
      max_tokens: String(config.effective.max_tokens || config.env.max_tokens || ''),
      timeout_seconds: String(config.effective.timeout_seconds || config.env.timeout_seconds || ''),
      embedding_base_url: emb?.uses_chat_config !== false ? '' : (emb?.base_url ?? ''),
      embedding_model: emb?.model ?? config.wiki_rag.embedding_model ?? '',
      use_chat_for_embeddings: emb?.uses_chat_config !== false,
      api_key: '',
      embedding_api_key: '',
    }));
    if (config.probe_detail) {
      setProbeResult(config.probe_detail);
    }
  }, [config]);

  const updateMut = useMutation({
    mutationFn: (body: AssistantLlmConfigUpdate) => api.updateAssistantLlmConfig(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-assistant-llm'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-assistant-llm-models'] });
      await queryClient.invalidateQueries({ queryKey: ['assistantStatus'] });
      pushToast('success', 'Временные параметры LLM применены');
      setOverrideForm((prev) => ({ ...prev, api_key: '', embedding_api_key: '' }));
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось применить override');
    },
  });

  const resetMut = useMutation({
    mutationFn: () => api.resetAssistantLlmConfig(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-assistant-llm'] });
      await queryClient.invalidateQueries({ queryKey: ['assistantStatus'] });
      pushToast('success', 'Override сброшен — используются значения из .env');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сбросить override');
    },
  });

  const probeMut = useMutation({
    mutationFn: () => api.probeAssistantLlm(),
    onSuccess: async (data) => {
      setProbeResult(data);
      await queryClient.invalidateQueries({ queryKey: ['admin-assistant-llm'] });
      if (data.fallback) {
        pushToast(
          'info',
          'Детальный probe недоступен на этом backend — показан статус из llm-config. Перезапустите run_local.py.',
        );
      } else {
        pushToast(
          data.provider_ready ? 'success' : 'error',
          data.provider_ready ? 'Подключение OK' : 'Есть проблемы с подключением',
        );
      }
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Probe не удался');
    },
  });

  useEffect(() => {
    if (!config || config.partial || autoProbeDoneRef.current) return;
    autoProbeDoneRef.current = true;
    if (!config.probe_detail) {
      probeMut.mutate();
    }
  }, [config, probeMut]);

  const testMut = useMutation({
    mutationFn: () => api.testAssistantLlm(),
    onSuccess: (data) => {
      if (data.ok) {
        pushToast('success', `Тест OK (${data.latency_ms} ms): ${data.reply ?? '—'}`);
      } else {
        pushToast('error', data.error ?? 'Тестовый запрос не удался');
      }
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Тестовый запрос не удался');
    },
  });

  const busy = updateMut.isPending || resetMut.isPending || probeMut.isPending || testMut.isPending;
  const hasOverride = Boolean(config && Object.keys(config.runtime_override).length > 0);
  const canApplyOverride =
    overrideForm.base_url.trim() !== '' ||
    overrideForm.model.trim() !== '' ||
    overrideForm.api_key.trim() !== '' ||
    overrideForm.max_tokens.trim() !== '' ||
    overrideForm.timeout_seconds.trim() !== '' ||
    overrideForm.embedding_base_url.trim() !== '' ||
    overrideForm.embedding_api_key.trim() !== '' ||
    overrideForm.embedding_model.trim() !== '' ||
    !overrideForm.use_chat_for_embeddings;

  const applyProviderPreset = (baseUrl: string, model: string, embeddingModel?: string) => {
    setPageTab('main');
    setOverrideTab('chat');
    setOverrideForm((f) => ({
      ...f,
      base_url: baseUrl,
      model,
      embedding_model: embeddingModel ?? f.embedding_model,
    }));
    setOverrideHighlight(true);
    window.setTimeout(() => setOverrideHighlight(false), 1200);
    overrideFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    pushToast('info', 'Параметры подставлены в форму override — укажите API key и нажмите «Применить»');
  };

  const applyEmbeddingPreset = () => {
    setPageTab('main');
    setOverrideTab('rag');
    setEmbeddingsOpen(true);
    setOverrideForm((f) => ({
      ...f,
      embedding_model: 'nomic-embed-text',
      use_chat_for_embeddings: true,
    }));
    setWikiRagHelpOpen(false);
    pushToast('info', 'nomic-embed-text подставлен в форму Embeddings');
  };

  const saveCurrentAsPreset = () => {
    const name = window.prompt('Имя пресета (только в этом браузере, без секретов):');
    if (!name?.trim()) return;
    const preset: AssistantLlmLocalPreset = {
      name: name.trim(),
      base_url: overrideForm.base_url.trim(),
      model: overrideForm.model.trim(),
      embedding_model: overrideForm.embedding_model.trim() || undefined,
    };
    saveLlmLocalPreset(preset);
    setLocalPresets(loadLlmLocalPresets());
    pushToast('success', `Пресет «${preset.name}» сохранён локально`);
  };

  const toastCopy = (msg: string) => {
    pushToast(msg.includes('Не удалось') ? 'error' : 'success', msg);
  };

  const ragDisplay = config ? wikiRagLabel(config.wiki_rag) : null;
  const modelOptions = llmModels?.models ?? [];
  const statusLevel = config && ragDisplay ? configStatusLevel(config, ragDisplay.tone) : 'ok';
  const envDiff = (field: keyof AssistantLlmConfigDetail['env']) => {
    if (!config || config.partial) return false;
    const eff = config.effective;
    if (field === 'base_url') return eff.base_url !== config.env.base_url;
    if (field === 'model') return eff.model !== config.env.model;
    if (field === 'max_tokens') return eff.max_tokens !== config.env.max_tokens;
    if (field === 'timeout_seconds') return eff.timeout_seconds !== config.env.timeout_seconds;
    return false;
  };

  const buildOverrideBody = (): AssistantLlmConfigUpdate => {
    const body: AssistantLlmConfigUpdate = {};
    if (overrideForm.base_url.trim()) body.base_url = overrideForm.base_url.trim();
    if (overrideForm.model.trim()) body.model = overrideForm.model.trim();
    if (overrideForm.api_key.trim()) body.api_key = overrideForm.api_key.trim();
    if (overrideForm.max_tokens.trim()) body.max_tokens = Number(overrideForm.max_tokens.trim());
    if (overrideForm.timeout_seconds.trim()) body.timeout_seconds = Number(overrideForm.timeout_seconds.trim());
    if (overrideForm.use_chat_for_embeddings) {
      body.embedding_base_url = '';
      body.embedding_api_key = '';
    } else {
      if (overrideForm.embedding_base_url.trim()) {
        body.embedding_base_url = overrideForm.embedding_base_url.trim();
      }
      if (overrideForm.embedding_api_key.trim()) {
        body.embedding_api_key = overrideForm.embedding_api_key.trim();
      }
    }
    if (overrideForm.embedding_model.trim()) {
      body.embedding_model = overrideForm.embedding_model.trim();
    }
    return body;
  };

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
          className={`admin-assistant-tabs__btn${pageTab === 'main' ? ' admin-assistant-tabs__btn--active' : ''}`}
          onClick={() => setPageTab('main')}
        >
          Статус и настройка
        </button>
        <button
          type="button"
          className={`admin-assistant-tabs__btn${pageTab === 'help' ? ' admin-assistant-tabs__btn--active' : ''}`}
          onClick={() => setPageTab('help')}
        >
          Справка и пресеты
        </button>
      </nav>

      <div className="admin-assistant-toolbar">
        <div className="admin-assistant-form-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setProbeExpanded(true);
              probeMut.mutate();
            }}
            disabled={busy || config?.partial}
          >
            <Stethoscope size={14} aria-hidden />
            {probeMut.isPending ? 'Проверка…' : 'Проверить подключение'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            Обновить
          </button>
        </div>
      </div>

      {isError && (
        <div className="admin-assistant-error" role="alert">
          <XCircle size={18} aria-hidden />
          <span>{error instanceof Error ? error.message : 'Не удалось загрузить конфигурацию LLM'}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refetch()}>
            Повторить
          </button>
        </div>
      )}

      {config?.partial && (
        <div className="admin-assistant-alert admin-assistant-alert--info" role="status">
          <AlertTriangle size={16} aria-hidden />
          <span>
            Backend устарел — доступен только базовый статус. Перезапустите{' '}
            <code>run_local.py</code> для полной конфигурации и probe.
          </span>
        </div>
      )}

      {pageTab === 'main' && (
        <div className="admin-assistant-stack">
          {isLoading && !config ? (
            <div className="card">
              <PageSkeleton lines={6} />
            </div>
          ) : config ? (
            <div className="admin-assistant-stack">
              <div
                className={`admin-assistant-metrics admin-assistant-metrics--${statusLevel}`}
                role="status"
              >
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
                {(config.wiki_rag.rag_mode && config.wiki_rag.enabled) ||
                ragDisplay?.tone === 'warn' ? (
                  <div className="admin-assistant-metric__footer">
                    {config.wiki_rag.rag_mode && config.wiki_rag.enabled && (
                      <span className="admin-assistant-metric__meta">
                        mode: {config.wiki_rag.rag_mode}
                      </span>
                    )}
                    {ragDisplay?.tone === 'warn' && (
                      <button
                        type="button"
                        className="admin-assistant-metric-action"
                        onClick={() => setWikiRagHelpOpen(true)}
                      >
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
                <div className="admin-assistant-metric__value">
                  {hasOverride ? 'Активен' : 'Не задан'}
                </div>
              </div>
            </div>
              </div>

              <AdminAssistantProbePanel
                probe={probeResult}
                loading={probeMut.isPending}
                expanded={probeExpanded}
                onToggle={() => setProbeExpanded((v) => !v)}
                onFixEmbeddings={() => setWikiRagHelpOpen(true)}
              />

              <div className="admin-assistant-grid">
            <section className="card">
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
                  Effective-значения ниже учитывают временный override. После рестарта backend
                  вернутся параметры из <code>app.env</code>.
                </div>
              )}

              <dl className="admin-assistant-kv">
                <div className={`admin-assistant-kv__row${envDiff('base_url') ? ' admin-assistant-kv__row--diff' : ''}`}>
                  <dt className="admin-assistant-kv__key">Base URL</dt>
                  <dd className="admin-assistant-kv__value">
                    <ConfigValue
                      value={config.effective.base_url ?? '—'}
                      mono={Boolean(config.effective.base_url)}
                      copyValue={config.effective.base_url ?? undefined}
                      onCopy={toastCopy}
                    />
                  </dd>
                </div>
                <div className={`admin-assistant-kv__row${envDiff('model') ? ' admin-assistant-kv__row--diff' : ''}`}>
                  <dt className="admin-assistant-kv__key">Модель</dt>
                  <dd className="admin-assistant-kv__value">
                    <ConfigValue
                      value={config.effective.model ?? '—'}
                      mono={Boolean(config.effective.model)}
                      copyValue={config.effective.model ?? undefined}
                      onCopy={toastCopy}
                    />
                  </dd>
                </div>
                <div className={`admin-assistant-kv__row${envDiff('max_tokens') ? ' admin-assistant-kv__row--diff' : ''}`}>
                  <dt className="admin-assistant-kv__key">Max tokens</dt>
                  <dd className="admin-assistant-kv__value">
                    {config.effective.max_tokens > 0 ? config.effective.max_tokens : '—'}
                  </dd>
                </div>
                <div className={`admin-assistant-kv__row${envDiff('timeout_seconds') ? ' admin-assistant-kv__row--diff' : ''}`}>
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
            </section>

            <section className="card admin-assistant-override-card">
              <div className="admin-assistant-card-head">
                <h2>Временный override</h2>
              </div>

              <div className="admin-assistant-alert">
                <AlertTriangle size={16} aria-hidden />
                <span>
                  Действует только в памяти процесса до рестарта backend. Не записывает ключ в файл и
                  не заменяет <code>app.env</code>.
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
                  <input
                    className="input input--mono"
                    value={overrideForm.base_url}
                    onChange={(e) => setOverrideForm((f) => ({ ...f, base_url: e.target.value }))}
                    placeholder="https://openrouter.ai/api/v1"
                    disabled={busy}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
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
                    <input
                      className="input input--mono"
                      type="number"
                      min={1}
                      value={overrideForm.max_tokens}
                      onChange={(e) => setOverrideForm((f) => ({ ...f, max_tokens: e.target.value }))}
                      placeholder="1024"
                      disabled={busy}
                    />
                  </label>
                  <label className="admin-assistant-field">
                    <span className="admin-assistant-field__label">Timeout (с)</span>
                    <input
                      className="input input--mono"
                      type="number"
                      min={1}
                      value={overrideForm.timeout_seconds}
                      onChange={(e) =>
                        setOverrideForm((f) => ({ ...f, timeout_seconds: e.target.value }))
                      }
                      placeholder="120"
                      disabled={busy}
                    />
                  </label>
                </div>
                <label className="admin-assistant-field">
                  <span className="admin-assistant-field__label inline-flex items-center gap-1">
                    <KeyRound size={14} aria-hidden />
                    API key
                  </span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={overrideForm.api_key}
                    onChange={(e) => setOverrideForm((f) => ({ ...f, api_key: e.target.value }))}
                    placeholder="Пусто — не менять текущий ключ"
                    disabled={busy}
                  />
                </label>
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
                    className={embeddingsOpen || !overrideForm.use_chat_for_embeddings ? 'admin-assistant-probe-panel__chev--open' : undefined}
                  />
                  Отдельные параметры embeddings
                </button>
                {(embeddingsOpen || !overrideForm.use_chat_for_embeddings) && (
                  <>
                    {!overrideForm.use_chat_for_embeddings && (
                      <>
                        <label className="admin-assistant-field">
                          <span className="admin-assistant-field__label">Embedding base URL</span>
                          <input
                            className="input input--mono"
                            value={overrideForm.embedding_base_url}
                            onChange={(e) =>
                              setOverrideForm((f) => ({ ...f, embedding_base_url: e.target.value }))
                            }
                            placeholder="http://127.0.0.1:11434/v1"
                            disabled={busy}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </label>
                        <label className="admin-assistant-field">
                          <span className="admin-assistant-field__label">Embedding API key</span>
                          <input
                            className="input"
                            type="password"
                            value={overrideForm.embedding_api_key}
                            onChange={(e) =>
                              setOverrideForm((f) => ({ ...f, embedding_api_key: e.target.value }))
                            }
                            placeholder="Пусто — не менять"
                            disabled={busy}
                            autoComplete="new-password"
                          />
                        </label>
                      </>
                    )}
                    <label className="admin-assistant-field">
                      <span className="admin-assistant-field__label">Embedding model</span>
                      <input
                        className="input input--mono"
                        value={overrideForm.embedding_model}
                        onChange={(e) =>
                          setOverrideForm((f) => ({ ...f, embedding_model: e.target.value }))
                        }
                        placeholder="nomic-embed-text"
                        disabled={busy}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <span className="admin-assistant-field__hint">
                        LM Studio: загрузите embedding-модель или укажите отдельный Ollama endpoint.
                      </span>
                    </label>
                  </>
                )}
                  </>
                )}
                </div>

                <div className="admin-assistant-form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy || config.partial}
                    onClick={() => testMut.mutate()}
                  >
                    {testMut.isPending ? 'Тест…' : 'Тестовый запрос'}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy || !canApplyOverride}>
                    {updateMut.isPending ? 'Применение…' : 'Применить'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy || !hasOverride}
                    onClick={() => resetMut.mutate()}
                  >
                    {resetMut.isPending ? 'Сброс…' : 'Сбросить override'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy || !overrideForm.base_url.trim()}
                    onClick={saveCurrentAsPreset}
                    title="Сохранить в localStorage (без секретов)"
                  >
                    <Save size={14} aria-hidden />
                    Сохранить пресет
                  </button>
                </div>
              </form>
            </section>
          </div>
            </div>
          ) : null}
        </div>
      )}

      <WikiRagHelpModal
        open={wikiRagHelpOpen}
        onClose={() => setWikiRagHelpOpen(false)}
        onApplyEmbeddingPreset={applyEmbeddingPreset}
      />

      {pageTab === 'help' && (
        <div className="admin-assistant-stack">
      <section className="card">
        <div className="admin-assistant-card-head">
          <h2>Справка: провайдеры LLM</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setProvidersOpen((v) => !v)}
            aria-expanded={providersOpen}
          >
            {providersOpen ? 'Свернуть' : 'Развернуть'}
          </button>
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
                  onClick={() =>
                    applyProviderPreset(p.base_url, p.model, p.embedding_model)
                  }
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
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    applyProviderPreset(
                      p.base_url,
                      p.model_hint,
                      'embedding_model' in p ? p.embedding_model : undefined,
                    )
                  }
                >
                  Подставить
                </button>
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
      </section>

      <section className="card">
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
      </section>
        </div>
      )}
    </div>
  );
}
