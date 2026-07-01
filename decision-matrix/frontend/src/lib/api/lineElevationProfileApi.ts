import { unwrapApiJobResponse } from '../runApiJob';
import { request } from './client';
import type { ProjectJobCreateResponse } from './jobs';

export type LineProfilePoint = {
  chainage_m: number;
  lon: number;
  lat: number;
  elevation_m: number;
};

export type LineElevationProfile = {
  step_m: number;
  computed_at: string;
  dem_source: string;
  total_length_m: number;
  points: LineProfilePoint[];
};

export type LineElevationProfileComputeResult = {
  computed_count: number;
  points_updated_count?: number;
  dem_fetched: boolean;
  dem_reused: boolean;
  errors: string[];
};

export const lineElevationProfileApi = {
  async compute(projectId: string): Promise<LineElevationProfileComputeResult> {
    const res = await request<LineElevationProfileComputeResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/infrastructure/line-elevation-profile/compute`,
      { method: 'POST' },
    );
    return unwrapApiJobResponse<LineElevationProfileComputeResult>(projectId, res);
  },

  getProfile(projectId: string, objectId: string): Promise<LineElevationProfile> {
    return request(
      `/projects/${projectId}/infrastructure/objects/${objectId}/line-elevation-profile`,
    );
  },
};
