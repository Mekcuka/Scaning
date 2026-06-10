import type { AssistantStatus } from './types';

/** Map backend/SSE chat errors to user-facing Russian messages. */
export function formatAssistantChatError(
  message: string,
  code?: string | null,
  status?: AssistantStatus | null,
): string {
  const lower = message.toLowerCase();
  const baseUrl = status?.base_url ?? '';

  if (code === 'llm_rate_limit' || lower.includes('429')) {
    const model = status?.model ? ` (${status.model})` : '';
    if (baseUrl.includes('openrouter')) {
      return (
        `OpenRouter временно ограничил запросы${model} — лимит бесплатной модели исчерпан. ` +
        'Подождите 1–2 минуты, смените ASSISTANT_LLM_MODEL в .env или добавьте кредиты на openrouter.ai.'
      );
    }
    return (
      'Провайдер LLM временно ограничил число запросов. Подождите и повторите или смените модель.'
    );
  }

  if (code === 'llm_auth' || lower.includes('401') || lower.includes('403')) {
    return 'Неверный API-ключ LLM. Проверьте ASSISTANT_LLM_API_KEY в backend/.env и перезапустите сервер.';
  }

  if (code === 'llm_connection' || code === 'llm_config') {
    return formatLlmUnavailableHint(status);
  }

  if (code === 'llm_timeout') {
    return 'Таймаут ответа LLM. Попробуйте короче вопрос или увеличьте ASSISTANT_LLM_TIMEOUT_SECONDS.';
  }

  if (code === 'llm_http' || lower.includes('llm error')) {
    if (lower.includes('429')) {
      return formatAssistantChatError(message, 'llm_rate_limit', status);
    }
    return message.length > 20 ? message : formatLlmUnavailableHint(status);
  }

  if (lower.includes('503') && lower.includes('llm')) {
    return formatLlmUnavailableHint(status);
  }

  return message;
}

export function formatLlmUnavailableHint(status?: AssistantStatus | null): string {
  const baseUrl = status?.base_url ?? '';
  if (baseUrl.includes('openrouter')) {
    return (
      'LLM (OpenRouter) недоступен или отклонил запрос. Проверьте ASSISTANT_LLM_API_KEY и модель в backend/.env.'
    );
  }
  if (baseUrl.includes('11434')) {
    return 'LLM недоступен. Запустите Ollama: ollama serve и модель из ASSISTANT_LLM_MODEL.';
  }
  if (baseUrl.includes('1234')) {
    return 'LLM недоступен. Запустите LM Studio Local Server на http://127.0.0.1:1234.';
  }
  if (baseUrl) {
    return `LLM недоступен. Проверьте настройки API на сервере (${baseUrl}).`;
  }
  return 'Помощник недоступен — проверьте настройки LLM API на сервере (backend/.env).';
}
