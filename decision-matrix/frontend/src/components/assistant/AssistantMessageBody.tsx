import { displayAssistantMessage } from '../../lib/assistant/messageContent';
import type { AssistantMessage } from '../../lib/assistant/types';

type Props = {
  message: AssistantMessage;
};

export function AssistantMessageBody({ message }: Props) {
  const { reasoning, content } = displayAssistantMessage(message);
  const hasReasoning = !!reasoning?.trim();

  return (
    <>
      {hasReasoning && (
        <details className="assistant-reasoning">
          <summary className="assistant-reasoning-summary">Размышления модели</summary>
          <div className="assistant-reasoning-text">{reasoning}</div>
        </details>
      )}
      {content ? <div className="assistant-msg-text">{content}</div> : null}
    </>
  );
}
