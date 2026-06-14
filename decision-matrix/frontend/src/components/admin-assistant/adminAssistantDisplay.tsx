import { Copy } from 'lucide-react';
import type { AssistantLlmConfigDetail } from '../../lib/api';

export function apiKeySourceLabel(source: string): string {
  switch (source) {
    case 'env':
      return 'из .env / app.env';
    case 'override':
      return 'временный override';
    default:
      return 'не задан';
  }
}

export function wikiRagLabel(rag: AssistantLlmConfigDetail['wiki_rag']): {
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

export function configStatusLevel(
  config: AssistantLlmConfigDetail,
  ragTone: 'ok' | 'warn' | 'muted',
): 'ok' | 'warn' | 'bad' {
  if (!config.provider_ready) return 'bad';
  if (ragTone === 'warn') return 'warn';
  return 'ok';
}

export async function copyText(text: string, onDone: (msg: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    onDone('Скопировано в буфер обмена');
  } catch {
    onDone('Не удалось скопировать');
  }
}

export function envDiff(
  config: AssistantLlmConfigDetail,
  field: keyof AssistantLlmConfigDetail['env'],
): boolean {
  if (config.partial) return false;
  const eff = config.effective;
  if (field === 'base_url') return eff.base_url !== config.env.base_url;
  if (field === 'model') return eff.model !== config.env.model;
  if (field === 'max_tokens') return eff.max_tokens !== config.env.max_tokens;
  if (field === 'timeout_seconds') return eff.timeout_seconds !== config.env.timeout_seconds;
  return false;
}

export function ConfigValue({
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
        onClick={() => void copyText(copyValue, onCopy)}
      >
        <Copy size={13} aria-hidden />
      </button>
    </>
  );
}
