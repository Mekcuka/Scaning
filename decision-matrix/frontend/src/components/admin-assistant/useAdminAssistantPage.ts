import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { assistantApi } from '../../lib/assistant/assistantApi';
import {
  api,
  loadLlmLocalPresets,
  saveLlmLocalPreset,
  type AssistantLlmConfigUpdate,
  type AssistantLlmLocalPreset,
  type AssistantLlmProbeDetail,
} from '../../lib/api';
import { useAppStore } from '../../store';
import {
  configStatusLevel,
  wikiRagLabel,
} from './adminAssistantDisplay';
import {
  EMPTY_OVERRIDE_FORM,
  type AdminAssistantOverrideFormState,
  type AdminAssistantOverrideTab,
  type AdminAssistantPageTab,
} from './adminAssistantConstants';

export function useAdminAssistantPage() {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const overrideFormRef = useRef<HTMLFormElement>(null);
  const autoProbeDoneRef = useRef(false);

  const [overrideHighlight, setOverrideHighlight] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [probeResult, setProbeResult] = useState<AssistantLlmProbeDetail | null>(null);
  const [wikiRagHelpOpen, setWikiRagHelpOpen] = useState(false);
  const [pageTab, setPageTab] = useState<AdminAssistantPageTab>('main');
  const [overrideTab, setOverrideTab] = useState<AdminAssistantOverrideTab>('chat');
  const [probeExpanded, setProbeExpanded] = useState(true);
  const [embeddingsOpen, setEmbeddingsOpen] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);
  const [localPresets, setLocalPresets] = useState<AssistantLlmLocalPreset[]>(() => loadLlmLocalPresets());
  const [overrideForm, setOverrideForm] = useState<AdminAssistantOverrideFormState>(EMPTY_OVERRIDE_FORM);

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

  return {
    overrideFormRef,
    overrideHighlight,
    mcpOpen,
    setMcpOpen,
    probeResult,
    wikiRagHelpOpen,
    setWikiRagHelpOpen,
    pageTab,
    setPageTab,
    overrideTab,
    setOverrideTab,
    probeExpanded,
    setProbeExpanded,
    embeddingsOpen,
    setEmbeddingsOpen,
    providersOpen,
    setProvidersOpen,
    localPresets,
    overrideForm,
    setOverrideForm,
    config,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    assistantStatus,
    updateMut,
    resetMut,
    probeMut,
    testMut,
    busy,
    hasOverride,
    canApplyOverride,
    applyProviderPreset,
    applyEmbeddingPreset,
    saveCurrentAsPreset,
    toastCopy,
    ragDisplay,
    modelOptions,
    statusLevel,
    buildOverrideBody,
  };
}

export type AdminAssistantPageView = ReturnType<typeof useAdminAssistantPage>;
