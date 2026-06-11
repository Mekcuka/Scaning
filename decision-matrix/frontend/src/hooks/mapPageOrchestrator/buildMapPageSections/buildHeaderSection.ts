import type { MapPageHeaderProps } from '../../../pages/map/MapPageHeader';
import type { BuildMapPageSectionsParams } from './types';

export function buildHeaderSection(
  params: Pick<BuildMapPageSectionsParams, 'projectId' | 'canWriteProject' | 'data' | 'actions'>,
): MapPageHeaderProps {
  const { projectId, canWriteProject, data, actions } = params;
  return {
    projectId: projectId ?? null,
    poisCount: data.pois.length,
    selectedPoiId: data.selectedPoi?.id ?? null,
    selectedPoiName: data.selectedPoi?.name ?? null,
    canWriteProject,
    analyzePending: actions.analyzePending,
    onAnalyzeAll: () => actions.analyzeAllMut.mutate(),
    onAnalyzeSelected: () => actions.analyzeSelectedMut.mutate(),
  };
}
