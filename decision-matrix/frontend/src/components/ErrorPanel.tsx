import { Alert, Button } from 'antd';

type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorPanel({ message, onRetry }: Props) {
  return (
    <Alert
      type="error"
      showIcon
      message={message}
      action={
        onRetry ? (
          <Button size="small" onClick={() => onRetry()}>
            Повторить
          </Button>
        ) : undefined
      }
    />
  );
}
