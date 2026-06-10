import { request } from './client';
import type { AdminJobsHealthResponse, ProjectJobAdminItem, ProjectJobAdminListResponse } from './jobs';
import { assistantApi } from '../assistant/assistantApi';
import type { AssistantStatus } from '../assistant/types';

export type AdminUserRow = {
  id: string;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
  project_count: number;
};

export type AssistantLlmEffectiveConfig = {
  base_url: string | null;
  model: string | null;
  api_key_masked: string | null;
  api_key_source: 'env' | 'override' | 'none' | string;
  max_tokens: number;
  timeout_seconds: number;
};

export type AssistantLlmEmbeddingEffectiveConfig = {
  base_url: string | null;
  model: string | null;
  api_key_masked: string | null;
  uses_chat_config: boolean;
};

export type AssistantLlmEnvConfig = {
  base_url: string | null;
  model: string | null;
  max_tokens: number;
  timeout_seconds: number;
  api_key_configured: boolean;
  embedding_base_url?: string | null;
  embedding_model?: string | null;
  embedding_api_key_configured?: boolean;
};

export type AssistantLlmWikiRagStatus = {
  enabled: boolean;
  embedding_ready: boolean | null;
  rag_mode?: string | null;
  embedding_model?: string | null;
};

export type AssistantLlmProbeSlice = {
  ok: boolean;
  http_status: number | null;
  hint_ru: string;
};

export type AssistantLlmProbeDetail = {
  chat: {
    ok: boolean;
    models: AssistantLlmProbeSlice;
    completion: AssistantLlmProbeSlice;
  };
  embeddings: AssistantLlmProbeSlice;
  rag_mode: string;
  provider_ready: boolean;
  /** true when built from GET llm-config (POST /llm-probe unavailable). */
  fallback?: boolean;
};

export type AssistantLlmConfigDetail = {
  provider_ready: boolean;
  chat_enabled: boolean;
  effective: AssistantLlmEffectiveConfig;
  embedding_effective: AssistantLlmEmbeddingEffectiveConfig;
  env: AssistantLlmEnvConfig;
  runtime_override: Record<string, string | null>;
  wiki_rag: AssistantLlmWikiRagStatus;
  probe_detail?: AssistantLlmProbeDetail | null;
  /** true when built from /assistant/status (GET admin config unavailable). */
  partial?: boolean;
};

export type AssistantLlmConfigUpdate = {
  base_url?: string | null;
  model?: string | null;
  api_key?: string | null;
  max_tokens?: number | null;
  timeout_seconds?: number | null;
  embedding_base_url?: string | null;
  embedding_api_key?: string | null;
  embedding_model?: string | null;
};

export type AssistantLlmTestResult = {
  ok: boolean;
  latency_ms: number | null;
  model: string | null;
  reply: string | null;
  error: string | null;
};

export type AssistantLlmLocalPreset = {
  name: string;
  base_url: string;
  model: string;
  embedding_model?: string;
  note?: string;
};

const LLM_PRESETS_STORAGE_KEY = 'atlas-grid-admin-llm-presets';

function maskApiKeyHint(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (raw.length <= 4) return '***';
  return `***…${raw.slice(-4)}`;
}

/** Fallback when backend has POST/DELETE but not yet GET /admin/assistant/llm-config. */
export function llmConfigFromAssistantStatus(status: AssistantStatus): AssistantLlmConfigDetail {
  const override = status.llm_override ?? {};
  const hasOverride = Object.keys(override).length > 0;
  const maskedOverride: Record<string, string | null> = {};
  for (const [key, val] of Object.entries(override)) {
    maskedOverride[key] = key === 'api_key' ? maskApiKeyHint(val) : val;
  }
  return {
    provider_ready: status.provider_ready,
    chat_enabled: status.enabled,
    effective: {
      base_url: status.base_url,
      model: status.model,
      api_key_masked: hasOverride ? maskApiKeyHint(override.api_key) : null,
      api_key_source: override.api_key ? 'override' : status.base_url ? 'env' : 'none',
      max_tokens: 0,
      timeout_seconds: 0,
    },
    embedding_effective: {
      base_url: status.base_url,
      model: null,
      api_key_masked: null,
      uses_chat_config: true,
    },
    env: {
      base_url: status.base_url,
      model: status.model,
      max_tokens: 0,
      timeout_seconds: 0,
      api_key_configured: false,
    },
    runtime_override: maskedOverride,
    wiki_rag: { enabled: false, embedding_ready: null },
    partial: true,
  };
}

async function fetchAssistantLlmConfig(): Promise<AssistantLlmConfigDetail> {
  try {
    return await request<AssistantLlmConfigDetail>('/admin/assistant/llm-config');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!/method not allowed/i.test(msg)) throw err;
    const status = await assistantApi.getStatus();
    return llmConfigFromAssistantStatus(status);
  }
}

function isMissingAdminProbeEndpoint(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /not found|404|method not allowed|405/i.test(msg);
}

function probeDetailFromConfig(cfg: AssistantLlmConfigDetail): AssistantLlmProbeDetail {
  const chatOk = cfg.provider_ready;
  const embedOk = Boolean(cfg.wiki_rag.embedding_ready);
  const hintBase =
    'Детальный probe недоступен — перезапустите backend (run_local.py) для POST /admin/assistant/llm-probe.';
  return {
    provider_ready: chatOk,
    rag_mode: cfg.wiki_rag.rag_mode ?? 'unknown',
    chat: {
      ok: chatOk,
      models: {
        ok: chatOk,
        http_status: chatOk ? 200 : null,
        hint_ru: chatOk
          ? `Chat (models): OK (краткий статус из llm-config). ${hintBase}`
          : `Chat (models): недоступен. ${hintBase}`,
      },
      completion: {
        ok: chatOk,
        http_status: chatOk ? 200 : null,
        hint_ru: chatOk
          ? `Chat (completion): OK (краткий статус из llm-config).`
          : `Chat (completion): проверьте модель и API key. ${hintBase}`,
      },
    },
    embeddings: {
      ok: embedOk,
      http_status: embedOk ? 200 : null,
      hint_ru: embedOk
        ? 'Embeddings: OK (из llm-config).'
        : `Embeddings: не готовы — TF-IDF fallback. ${hintBase}`,
    },
    fallback: true,
  };
}

async function probeAssistantLlm(): Promise<AssistantLlmProbeDetail> {
  try {
    return await request<AssistantLlmProbeDetail>('/admin/assistant/llm-probe', {
      method: 'POST',
      timeoutMs: 90_000,
    });
  } catch (err) {
    if (!isMissingAdminProbeEndpoint(err)) throw err;
    const cfg = await fetchAssistantLlmConfig();
    return probeDetailFromConfig(cfg);
  }
}

async function testAssistantLlm(): Promise<AssistantLlmTestResult> {
  try {
    return await request<AssistantLlmTestResult>('/admin/assistant/llm-test', {
      method: 'POST',
      timeoutMs: 90_000,
    });
  } catch (err) {
    if (!isMissingAdminProbeEndpoint(err)) throw err;
    throw new Error(
      'Сервер API устарел: нет POST /admin/assistant/llm-test. Перезапустите backend (run_local.py).',
    );
  }
}

export function loadLlmLocalPresets(): AssistantLlmLocalPreset[] {
  try {
    const raw = localStorage.getItem(LLM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AssistantLlmLocalPreset =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as AssistantLlmLocalPreset).name === 'string' &&
        typeof (item as AssistantLlmLocalPreset).base_url === 'string',
    );
  } catch {
    return [];
  }
}

export function saveLlmLocalPreset(preset: AssistantLlmLocalPreset): void {
  const existing = loadLlmLocalPresets().filter((p) => p.name !== preset.name);
  localStorage.setItem(LLM_PRESETS_STORAGE_KEY, JSON.stringify([preset, ...existing].slice(0, 20)));
}

export const adminApi = {
  adminUsers: async () => {
    const rows = await request<
      Array<{
        id: string;
        email: string;
        username: string;
        role: string;
        is_active: boolean;
        created_at: string;
        project_count?: number;
      }>
    >('/admin/users');
    return rows.map((row) => ({
      ...row,
      project_count: typeof row.project_count === 'number' ? row.project_count : 0,
    }));
  },
  updateAdminUser: (id: string, data: { role?: string; is_active?: boolean }) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminStats: () => request<{ users: number; projects: number; pois: number }>('/admin/stats'),
  adminListJobs: (params?: {
    status?: string[];
    job_type?: string;
    project_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status?.length) {
      for (const s of params.status) q.append('status', s);
    }
    if (params?.job_type) q.set('job_type', params.job_type);
    if (params?.project_id) q.set('project_id', params.project_id);
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request<ProjectJobAdminListResponse>(`/admin/jobs${qs ? `?${qs}` : ''}`);
  },
  adminJobsHealth: () => request<AdminJobsHealthResponse>('/admin/jobs/health'),
  adminCancelJob: (jobId: string) =>
    request<ProjectJobAdminItem>(`/admin/jobs/${jobId}/cancel`, { method: 'POST' }),
  getAssistantLlmConfig: () => fetchAssistantLlmConfig(),
  updateAssistantLlmConfig: (body: AssistantLlmConfigUpdate) =>
    request<{ applied: Record<string, string | null> }>('/admin/assistant/llm-config', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resetAssistantLlmConfig: () =>
    request<{ applied: Record<string, string | null> }>('/admin/assistant/llm-config', {
      method: 'DELETE',
    }),
  probeAssistantLlm: () => probeAssistantLlm(),
  testAssistantLlm: () => testAssistantLlm(),
  listAssistantLlmModels: () =>
    request<{ models: string[] }>('/admin/assistant/llm-models'),
};
