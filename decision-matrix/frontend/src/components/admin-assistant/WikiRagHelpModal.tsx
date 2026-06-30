import { createPortal } from 'react-dom';
import { Button, Space } from 'antd';

import { AppModal } from '../AppModal';

type Props = {
  open: boolean;
  onClose: () => void;
  onApplyEmbeddingPreset?: () => void;
};

export function WikiRagHelpModal({ open, onClose, onApplyEmbeddingPreset }: Props) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <AppModal
      title="Wiki RAG: как исправить embeddings"
      titleId="wiki-rag-help-title"
      onClose={onClose}
      size="md"
      footer={
        <Space>
          {onApplyEmbeddingPreset ? (
            <Button onClick={onApplyEmbeddingPreset}>Подставить nomic-embed-text</Button>
          ) : null}
          <Button type="primary" onClick={onClose}>
            Понятно
          </Button>
        </Space>
      }
    >
      <ul className="admin-assistant-help-list">
        <li>
          Убедитесь, что <code>ASSISTANT_WIKI_RAG_ENABLED=true</code> и провайдер отвечает на{' '}
          <code>POST /embeddings</code> с моделью из <code>ASSISTANT_WIKI_EMBEDDING_MODEL</code>.
        </li>
        <li>
          LM Studio: загрузите embedding-модель (например nomic-embed-text) параллельно с
          chat-моделью или задайте отдельный <code>ASSISTANT_WIKI_EMBEDDING_BASE_URL</code> на Ollama.
        </li>
        <li>
          Пока embeddings недоступны, поиск wiki работает по ключевым словам — чат не ломается, но
          качество контекста ниже.
        </li>
        <li>Откройте «Детали проверки» — строка Embeddings покажет HTTP-код и подсказку.</li>
      </ul>
    </AppModal>,
    document.body,
  );
}
