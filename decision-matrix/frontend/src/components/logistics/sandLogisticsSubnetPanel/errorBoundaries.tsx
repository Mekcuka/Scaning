import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ChartsErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sand logistics charts:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="text-sm text-[var(--text-muted)] col-span-full">
          Не удалось отобразить диаграммы. Данные доступны в таблицах ниже.
        </p>
      );
    }
    return this.props.children;
  }
}

export class SchematicErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sand logistics schematic:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="text-sm text-[var(--text-muted)] py-4">
          Не удалось построить схему. Проверьте сеть на карте и таблицы ниже.
        </p>
      );
    }
    return this.props.children;
  }
}
