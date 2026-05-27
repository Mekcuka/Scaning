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

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>
);
