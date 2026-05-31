import type { ReactElement } from 'react';
import type { MemoryRouterProps } from 'react-router-dom';
import {
  renderWithProviders,
  type RenderWithProvidersOptions,
} from '../renderWithProviders';

export type RenderPageOptions = RenderWithProvidersOptions & {
  route?: string;
  initialEntries?: MemoryRouterProps['initialEntries'];
};

/** Render a page with router path and shared providers. */
export function renderPage(ui: ReactElement, options: RenderPageOptions = {}) {
  const { route, initialEntries, router, ...rest } = options;
  const entries = initialEntries ?? (route ? [route] : ['/']);
  return renderWithProviders(ui, {
    ...rest,
    router: {
      initialEntries: entries,
      ...router,
    },
  });
}
