import { describe, expect, it } from 'vitest';
import {
  defaultAdminJobsApi,
  defaultAdminUsersApi,
  defaultAnalysisBatchApi,
  defaultAuthApi,
  defaultAuthSessionApi,
  defaultAutoroadNetworkApi,
  defaultFlowSchematicApi,
  defaultImportWorkflowApi,
  defaultMap3dModelsApi,
  defaultMapAnalysisApi,
  defaultMapDataApi,
  defaultMapMutationsApi,
  defaultMapUndoApi,
  defaultNetworkBuildApi,
  defaultOnePagerListApi,
  defaultProjectJobsApi,
  defaultProjectsDataApi,
  defaultProjectsListApi,
  defaultProjectsMapSettingsApi,
  defaultProjectsPoiWriteApi,
  defaultProjectsRatesApi,
  defaultProjectsWriteApi,
  defaultSandLogisticsApi,
} from './index';
import { adminApi } from '../adminApi';
import { analysisApi } from '../analysisApi';
import { authApi } from '../authApi';
import { flowApi } from '../flowApi';
import { importApi } from '../importApi';
import { jobsApi } from '../jobsApi';
import { mapApi } from '../mapApi';
import { networkApi } from '../networkApi';
import { onePagerApi } from '../onePagerApi';
import { projectsApi } from '../projectsApi';
import { sandLogisticsApi } from '../sandLogisticsApi';

describe('API ports (DIP)', () => {
  it('default list port delegates to projectsApi.projects', () => {
    expect(defaultProjectsListApi.projects).toBe(projectsApi.projects);
  });

  it('default data port delegates to projectsApi detail queries', () => {
    expect(defaultProjectsDataApi.getPois).toBe(projectsApi.getPois);
    expect(defaultProjectsDataApi.getProject).toBe(projectsApi.getProject);
  });

  it('default map data port delegates to mapApi infra/layers/3d', () => {
    expect(defaultMapDataApi.getInfraObjects).toBe(mapApi.getInfraObjects);
    expect(defaultMapDataApi.getLayers).toBe(mapApi.getLayers);
    expect(defaultMapDataApi.updateLayer).toBe(mapApi.updateLayer);
    expect(defaultMapDataApi.listMap3dCustomModels).toBe(mapApi.listMap3dCustomModels);
  });

  it('default sand logistics port delegates to sandLogisticsApi', () => {
    expect(defaultSandLogisticsApi.getSandLogisticsResult).toBe(
      sandLogisticsApi.getSandLogisticsResult,
    );
    expect(defaultSandLogisticsApi.analyzeSandLogistics).toBe(sandLogisticsApi.analyzeSandLogistics);
  });

  it('default flow port delegates to flowApi schematic methods', () => {
    expect(defaultFlowSchematicApi.getFlowSchematic).toBe(flowApi.getFlowSchematic);
    expect(defaultFlowSchematicApi.saveFlowSchematic).toBe(flowApi.saveFlowSchematic);
  });

  it('default one-pager list port delegates to onePagerApi', () => {
    expect(defaultOnePagerListApi.getOnePagers).toBe(onePagerApi.getOnePagers);
    expect(defaultOnePagerListApi.deleteOnePager).toBe(onePagerApi.deleteOnePager);
  });

  it('default map analysis port delegates to analysisApi', () => {
    expect(defaultMapAnalysisApi.getPoiAnalysis).toBe(analysisApi.getPoiAnalysis);
    expect(defaultMapAnalysisApi.overrideAnalysis).toBe(analysisApi.overrideAnalysis);
  });

  it('default project jobs port delegates to jobsApi', () => {
    expect(defaultProjectJobsApi.getActiveProjectJob).toBe(jobsApi.getActiveProjectJob);
    expect(defaultProjectJobsApi.getProjectJob).toBe(jobsApi.getProjectJob);
  });

  it('default analysis batch port delegates to analysisApi', () => {
    expect(defaultAnalysisBatchApi.analyzeAllPois).toBe(analysisApi.analyzeAllPois);
  });

  it('default map mutations port delegates to mapApi', () => {
    expect(defaultMapMutationsApi.createInfraObject).toBe(mapApi.createInfraObject);
    expect(defaultMapMutationsApi.updateInfraObject).toBe(mapApi.updateInfraObject);
    expect(defaultMapMutationsApi.batchPasteMapObjects).toBe(mapApi.batchPasteMapObjects);
    expect(defaultMapMutationsApi.batchDeleteMapObjects).toBe(mapApi.batchDeleteMapObjects);
  });

  it('default projects write port delegates to projectsApi', () => {
    expect(defaultProjectsWriteApi.createProject).toBe(projectsApi.createProject);
    expect(defaultProjectsWriteApi.deleteProject).toBe(projectsApi.deleteProject);
  });

  it('default projects rates port delegates to projectsApi', () => {
    expect(defaultProjectsRatesApi.getRates).toBe(projectsApi.getRates);
    expect(defaultProjectsRatesApi.updateDistanceDefaults).toBe(projectsApi.updateDistanceDefaults);
  });

  it('default POI write port delegates to projectsApi', () => {
    expect(defaultProjectsPoiWriteApi.createPoi).toBe(projectsApi.createPoi);
    expect(defaultProjectsPoiWriteApi.updatePoi).toBe(projectsApi.updatePoi);
    expect(defaultProjectsPoiWriteApi.deletePoi).toBe(projectsApi.deletePoi);
  });

  it('default map settings port delegates to projectsApi', () => {
    expect(defaultProjectsMapSettingsApi.getDistanceDefaults).toBe(projectsApi.getDistanceDefaults);
  });

  it('default autoroad network port delegates to networkApi', () => {
    expect(defaultAutoroadNetworkApi.autoroadConnect).toBe(networkApi.autoroadConnect);
    expect(defaultAutoroadNetworkApi.autoroadNetworkApply).toBe(networkApi.autoroadNetworkApply);
  });

  it('default network build port delegates to networkApi', () => {
    expect(defaultNetworkBuildApi.buildNetwork).toBe(networkApi.buildNetwork);
  });

  it('default map undo port composes mutations, POI write, and network build', () => {
    expect(defaultMapUndoApi.createInfraObject).toBe(mapApi.createInfraObject);
    expect(defaultMapUndoApi.deletePoi).toBe(projectsApi.deletePoi);
    expect(defaultMapUndoApi.buildNetwork).toBe(networkApi.buildNetwork);
  });

  it('default import workflow port delegates to importApi', () => {
    expect(defaultImportWorkflowApi.importCsv).toBe(importApi.importCsv);
    expect(defaultImportWorkflowApi.syncImportConnection).toBe(importApi.syncImportConnection);
  });

  it('default map3d models port delegates to mapApi', () => {
    expect(defaultMap3dModelsApi.uploadMap3dCustomModel).toBe(mapApi.uploadMap3dCustomModel);
  });

  it('default admin ports delegate to adminApi', () => {
    expect(defaultAdminUsersApi.adminUsers).toBe(adminApi.adminUsers);
    expect(defaultAdminJobsApi.adminCancelJob).toBe(adminApi.adminCancelJob);
  });

  it('default auth session port delegates to authApi', () => {
    expect(defaultAuthSessionApi.me).toBe(authApi.me);
  });

  it('default auth port delegates login/register to authApi', () => {
    expect(defaultAuthApi.login).toBe(authApi.login);
    expect(defaultAuthApi.register).toBe(authApi.register);
  });

  it('default map analysis port includes getCandidates', () => {
    expect(defaultMapAnalysisApi.getCandidates).toBe(analysisApi.getCandidates);
  });

  it('default project jobs port includes list and cancel', () => {
    expect(defaultProjectJobsApi.listProjectJobs).toBe(jobsApi.listProjectJobs);
    expect(defaultProjectJobsApi.cancelProjectJob).toBe(jobsApi.cancelProjectJob);
  });
});
