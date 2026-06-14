export const LLM_PROVIDERS = [
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

export type AdminAssistantPageTab = 'main' | 'help';
export type AdminAssistantOverrideTab = 'chat' | 'rag';

export interface AdminAssistantOverrideFormState {
  base_url: string;
  model: string;
  api_key: string;
  max_tokens: string;
  timeout_seconds: string;
  embedding_base_url: string;
  embedding_api_key: string;
  embedding_model: string;
  use_chat_for_embeddings: boolean;
}

export const EMPTY_OVERRIDE_FORM: AdminAssistantOverrideFormState = {
  base_url: '',
  model: '',
  api_key: '',
  max_tokens: '',
  timeout_seconds: '',
  embedding_base_url: '',
  embedding_api_key: '',
  embedding_model: '',
  use_chat_for_embeddings: true,
};
