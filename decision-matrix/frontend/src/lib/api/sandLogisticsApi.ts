import { request } from './client';
import type { ProjectJobCreateResponse } from './jobs';
import type { SandLogisticsResult } from './sandLogistics';

export const sandLogisticsApi = {
  analyzeSandLogistics: (
    projectId: string,
    options?: {
      asOf?: string;
      horizonFrom?: string;
      horizonTo?: string;
      rebuildNetwork?: boolean;
    },
  ) =>
    request<SandLogisticsResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/sand-logistics/analyze`,
      {
        method: 'POST',
        body: JSON.stringify({
          as_of: options?.asOf ?? null,
          horizon_from: options?.horizonFrom ?? null,
          horizon_to: options?.horizonTo ?? null,
          rebuild_network: options?.rebuildNetwork ?? true,
        }),
        timeoutMs: 120_000,
      },
    ),
  getSandLogisticsResult: (projectId: string) =>
    request<SandLogisticsResult | null>(`/projects/${projectId}/sand-logistics/result`, {
      allowNotFound: true,
    }),
};
