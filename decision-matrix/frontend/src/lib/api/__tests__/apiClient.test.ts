import { describe, expect, it } from 'vitest';
import { adminApi } from '../adminApi';
import { analysisApi } from '../analysisApi';
import { authApi } from '../authApi';
import { api } from '../apiClient';
import { flowApi } from '../flowApi';
import { importApi } from '../importApi';
import { jobsApi } from '../jobsApi';
import { mapApi } from '../mapApi';
import { networkApi } from '../networkApi';
import { onePagerApi } from '../onePagerApi';
import { projectsApi } from '../projectsApi';
import { sandLogisticsApi } from '../sandLogisticsApi';

const DOMAIN_APIS = [
  authApi,
  adminApi,
  projectsApi,
  analysisApi,
  mapApi,
  networkApi,
  importApi,
  jobsApi,
  sandLogisticsApi,
  flowApi,
  onePagerApi,
] as const;

describe('apiClient compose', () => {
  it('exposes every domain method on the legacy api object', () => {
    for (const domainApi of DOMAIN_APIS) {
      for (const key of Object.keys(domainApi)) {
        expect(typeof api[key as keyof typeof api]).toBe('function');
      }
    }
  });

  it('has no duplicate keys across domain apis', () => {
    const seen = new Set<string>();
    for (const domainApi of DOMAIN_APIS) {
      for (const key of Object.keys(domainApi)) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
