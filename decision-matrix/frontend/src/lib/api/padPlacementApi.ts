import { request } from './client';
import type { ProjectJobCreateResponse } from './jobs';
import type {
  PadPlacementApplyResponse,
  PadPlacementComputeResponse,
  PadPlacementGeoJson,
  PadPlacementParams,
} from '../padPlacementTypes';

/** Pad placement compute/apply and design-from-bottomholes on large GS pads. */
const PAD_PLACEMENT_TIMEOUT_MS = 600_000;

export type PadPlacementComputeRequest = {
  bottomhole_ids: string[];
  params?: PadPlacementParams;
  subtype?: 'oil_pad' | 'gas_pad';
};

export const padPlacementApi = {
  request: (projectId: string, body: PadPlacementComputeRequest) =>
    request<{
      request_id: string;
      logical_well_count: number;
      estimated_partitions: number;
      sync_allowed: boolean;
      warnings: string[];
    }>(`/projects/${projectId}/pad-placement/request`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  compute: (projectId: string, body: PadPlacementComputeRequest, opts?: { async?: boolean }) =>
    request<PadPlacementComputeResponse | ProjectJobCreateResponse>(
      `/projects/${projectId}/pad-placement/compute${opts?.async ? '?async=true' : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        timeoutMs: PAD_PLACEMENT_TIMEOUT_MS,
      },
    ),

  getCompute: (projectId: string, requestId: string) =>
    request<PadPlacementComputeResponse>(`/projects/${projectId}/pad-placement/compute/${requestId}`),

  previewGeoJson: (projectId: string, requestId: string, variantIndex: number) =>
    request<PadPlacementGeoJson>(
      `/projects/${projectId}/pad-placement/preview/${requestId}/${variantIndex}/geojson`,
    ),

  apply: (
    projectId: string,
    body: { request_id: string; variant_index: number },
    opts?: { async?: boolean },
  ) =>
    request<PadPlacementApplyResponse | ProjectJobCreateResponse>(
      `/projects/${projectId}/pad-placement/apply${opts?.async ? '?async=true' : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        timeoutMs: PAD_PLACEMENT_TIMEOUT_MS,
      },
    ),
};
