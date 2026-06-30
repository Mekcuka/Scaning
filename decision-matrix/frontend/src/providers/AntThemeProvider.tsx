import { useEffect, type ReactNode } from 'react';
import { App, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { useAppStore } from '../store';
import { buildAntTheme } from '../lib/antTheme';
import { ToastBridge } from './ToastBridge';

type Props = {
  children: ReactNode;
};

export function AntThemeProvider({ children }: Props) {
  const themeMode = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
  }, [themeMode]);

  return (
    <ConfigProvider locale={ruRU} theme={buildAntTheme(themeMode)}>
      <App className="app-ant-root">
        <ToastBridge />
        <div className="app-route-host">{children}</div>
      </App>
    </ConfigProvider>
  );
}
