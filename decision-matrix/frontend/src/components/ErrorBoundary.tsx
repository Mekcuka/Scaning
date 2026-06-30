import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from 'antd';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Change to reset after a caught error (e.g. route pathname). */
  resetKey?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught UI error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-8 max-w-lg mx-auto">
          <h1 className="text-lg font-semibold mb-2">Произошла ошибка</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Обновите страницу. Если проблема повторяется, обратитесь к администратору.
          </p>
          <Button type="primary" onClick={() => window.location.reload()}>
            Обновить
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
