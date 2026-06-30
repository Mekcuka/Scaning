import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { PageHeaderOutlet, PageHeaderProvider } from '../components/layout/pageHeaderContext';
import { AntThemeProvider } from '../providers/AntThemeProvider';

export type RenderWithProvidersOptions = RenderOptions & {
  router?: MemoryRouterProps;
  queryClient?: QueryClient;
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    router,
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AntThemeProvider>
          <MemoryRouter {...router}>
            <PageHeaderProvider>
              <PageHeaderOutlet />
              {children}
            </PageHeaderProvider>
          </MemoryRouter>
        </AntThemeProvider>
      </QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
