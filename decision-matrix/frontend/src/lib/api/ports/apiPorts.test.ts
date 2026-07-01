import { describe, expect, it } from 'vitest';
import {
  defaultAdminJobsApi,
  defaultAuthApi,
  defaultMapAnalysisApi,
  defaultMapDataApi,
  defaultMapUndoApi,
  defaultProjectsListApi,
  defaultSandLogisticsApi,
} from './index';
import { adminApi } from '../adminApi';
import { analysisApi } from '../analysisApi';
import { authApi } from '../authApi';
import { mapApi } from '../mapApi';
import { networkApi } from '../networkApi';
import { projectsApi } from '../projectsApi';
import { sandLogisticsApi } from '../sandLogisticsApi';

describe('API ports (DIP)', () => {
  it('default ports re-export live api module methods', () => {
    const pairs: Array<[unknown, unknown]> = [
      [defaultProjectsListApi.projects, projectsApi.projects],
      [defaultMapDataApi.getLayers, mapApi.getLayers],
      [defaultMapAnalysisApi.getPoiAnalysis, analysisApi.getPoiAnalysis],
      [defaultSandLogisticsApi.analyzeSandLogistics, sandLogisticsApi.analyzeSandLogistics],
      [defaultAuthApi.login, authApi.login],
      [defaultAdminJobsApi.adminCancelJob, adminApi.adminCancelJob],
    ];
    for (const [portFn, apiFn] of pairs) {
      expect(portFn).toBe(apiFn);
    }
  });

  it('map undo port composes mutations from multiple apis', () => {
    expect(defaultMapUndoApi.createInfraObject).toBe(mapApi.createInfraObject);
    expect(defaultMapUndoApi.deletePoi).toBe(projectsApi.deletePoi);
    expect(defaultMapUndoApi.buildNetwork).toBe(networkApi.buildNetwork);
  });
});
