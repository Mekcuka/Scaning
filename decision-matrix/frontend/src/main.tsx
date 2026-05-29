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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);
