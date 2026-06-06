import { describe, expect, it } from 'vitest';
import {
  defaultMapDataApi,
  defaultProjectsDataApi,
  defaultProjectsListApi,
} from './index';
import { mapApi } from '../mapApi';
import { projectsApi } from '../projectsApi';

describe('API ports (DIP)', () => {
  it('default list port delegates to projectsApi.projects', () => {
    expect(defaultProjectsListApi.projects).toBe(projectsApi.projects);
  });

  it('default data port delegates to projectsApi.getPois', () => {
    expect(defaultProjectsDataApi.getPois).toBe(projectsApi.getPois);
  });

  it('default map data port delegates to mapApi infra/layers', () => {
    expect(defaultMapDataApi.getInfraObjects).toBe(mapApi.getInfraObjects);
    expect(defaultMapDataApi.getLayers).toBe(mapApi.getLayers);
  });
});
