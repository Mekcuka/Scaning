type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorPanel({ message, onRetry }: Props) {
  return (
    <div className="p-6 rounded border" style={{ borderColor: 'var(--border)' }} role="alert">
      <p className="text-sm mb-3">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRetry()}>
          Повторить
        </button>
      ) : null}
    </div>
  );
}
