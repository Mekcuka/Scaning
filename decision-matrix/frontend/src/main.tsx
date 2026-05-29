import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useAuthStore, useAppStore } from './store';
import './index.css';

function Bootstrap() {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    fetchUser();
  }, [fetchUser, theme]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`).catch(() => undefined);
  }, []);

  return <App />;
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

type RootHandle = ReturnType<typeof createRoot>;
const rootKey = '__spprReactRoot';
const existingRoot = (rootEl as HTMLElement & { [rootKey]?: RootHandle })[rootKey];
const root = existingRoot ?? createRoot(rootEl);
(rootEl as HTMLElement & { [rootKey]?: RootHandle })[rootKey] = root;

root.render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount();
    delete (rootEl as HTMLElement & { [rootKey]?: RootHandle })[rootKey];
  });
}
