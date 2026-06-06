import { isNotFoundApiError, request } from './client';
import type { InfrastructureNetwork, NetworkEdge, NetworkNode } from './importTypes';
import type { ProjectJobCreateResponse } from './jobs';
import type {
  AutoroadConnectResult,
  AutoroadNetworkApplyResult,
  NetworkPlanRequest,
  NetworkPlanResponse,
} from './network';

export const networkApi = {
  autoroadConnect: (
    projectId: string,
    data: { object_ids: string[]; dry_run?: boolean },
    opts?: { timeoutMs?: number },
  ) =>
    request<AutoroadConnectResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/infrastructure/autoroad-connect`,
      {
        method: 'POST',
        body: JSON.stringify(data),
        timeoutMs: opts?.timeoutMs ?? 120_000,
      },
    ),
  autoroadNetworkSolverStatus: () =>
    request<{
      steinerpy: boolean;
      geosteiner: boolean;
      default_solver: string;
    }>('/autoroad-network/solver-status'),

  autoroadNetworkBuildRequest: (
    projectId: string,
    data: { object_ids: string[]; full_network_rebuild?: boolean },
    opts?: { timeoutMs?: number },
  ) =>
    request<NetworkPlanRequest>(`/projects/${projectId}/autoroad-network/request`, {
      method: 'POST',
      body: JSON.stringify({
        object_ids: data.object_ids,
        full_network_rebuild: data.full_network_rebuild ?? true,
      }),
      timeoutMs: opts?.timeoutMs ?? 120_000,
    }),

  autoroadNetworkCompute: (
    projectId: string,
    planRequest: NetworkPlanRequest,
    opts?: { timeoutMs?: number },
  ) =>
    request<NetworkPlanResponse>(`/projects/${projectId}/autoroad-network/compute`, {
      method: 'POST',
      body: JSON.stringify(planRequest),
      timeoutMs: opts?.timeoutMs ?? 120_000,
    }),

  autoroadNetworkApply: (
    projectId: string,
    data: {
      object_ids: string[];
      plan: NetworkPlanResponse;
      full_network_rebuild?: boolean;
    },
    opts?: { timeoutMs?: number },
  ) =>
    request<AutoroadNetworkApplyResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/autoroad-network/apply`,
      {
        method: 'POST',
        body: JSON.stringify({
          object_ids: data.object_ids,
          plan: data.plan,
          full_network_rebuild: data.full_network_rebuild ?? true,
        }),
        timeoutMs: opts?.timeoutMs ?? 120_000,
      },
    ),

  /** @deprecated Use buildRequest + compute */
  autoroadNetworkPlan: async (
    projectId: string,
    data: { object_ids: string[] },
    opts?: { timeoutMs?: number },
  ) => {
    const timeoutMs = opts?.timeoutMs ?? 120_000;
    try {
      return await request<AutoroadConnectResult>(`/projects/${projectId}/autoroad-network/plan`, {
        method: 'POST',
        body: JSON.stringify({ ...data, dry_run: true, full_network_rebuild: true }),
        timeoutMs,
      });
    } catch (err) {
      if (!isNotFoundApiError(err)) throw err;
      return request<AutoroadConnectResult>(
        `/projects/${projectId}/infrastructure/autoroad-connect`,
        {
          method: 'POST',
          body: JSON.stringify({ ...data, dry_run: true }),
          timeoutMs,
        },
      );
    }
  },
  buildNetwork: (projectId: string) =>
    request<InfrastructureNetwork>(`/projects/${projectId}/infrastructure/networks/build`, {
      method: 'POST',
    }),
  getNetworks: (projectId: string) =>
    request<InfrastructureNetwork[]>(`/projects/${projectId}/infrastructure/networks`),
  getNetworkNodes: (projectId: string, networkId: string) =>
    request<NetworkNode[]>(`/projects/${projectId}/infrastructure/networks/${networkId}/nodes`),
  getNetworkEdges: (projectId: string, networkId: string) =>
    request<NetworkEdge[]>(`/projects/${projectId}/infrastructure/networks/${networkId}/edges`),
};
