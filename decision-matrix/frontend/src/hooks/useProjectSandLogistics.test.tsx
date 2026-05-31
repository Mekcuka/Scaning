import type { ReactNode } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useProjectSandLogistics } from './useProjectSandLogistics';
import { createTestQueryClient } from '../test/renderWithProviders';
import {
  normalizeSandLogisticsResult,
  saveSandLogisticsToSession,
} from '../lib/sandLogisticsResult';

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useProjectSandLogistics', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('loads cached result from session', async () => {
    saveSandLogisticsToSession(
      'p-sand',
      normalizeSandLogisticsResult({ subnets: [], warnings: [] }),
    );
    const { result } = renderHook(() => useProjectSandLogistics('p-sand'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.subnets).toEqual([]);
  });

  it('returns null when projectId is missing', async () => {
    const { result } = renderHook(() => useProjectSandLogistics(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
