import type { MapPageHeaderProps } from '../../../pages/map/MapPageHeader';
import type { BuildMapPageSectionsParams } from './types';

export function buildHeaderSection(
  params: Pick<BuildMapPageSectionsParams, 'projectId' | 'canWriteProject' | 'data' | 'actions'>,
): MapPageHeaderProps {
  const { projectId, canWriteProject, data, actions } = params;
  return {
    projectId: projectId ?? null,
    poisCount: data.pois.length,
    canWriteProject,
    analyzePending: actions.analyzeMut.isPending,
    onAnalyze: () => actions.analyzeMut.mutate(),
  };
}
