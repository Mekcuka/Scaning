import type { MapPageModalsProps } from '../../../pages/map/MapPageModals';
import type { BuildMapPageSectionsParams } from './types';

export function buildModalsSection(
  params: Pick<
    BuildMapPageSectionsParams,
    'projectId' | 'canWriteProject' | 'edit' | 'data' | 'actions'
  >,
): MapPageModalsProps {
  const { projectId, canWriteProject, edit, data, actions } = params;

  return {
    deleteConfirm: actions.deleteConfirm,
    setDeleteConfirm: actions.setDeleteConfirm,
    deletePending: actions.deleteGroupMut.isPending || actions.deleteInfraMut.isPending,
    poiModalOpen: edit.modal?.type === 'poi',
    onClosePoiModal: () => edit.setModal(null),
    poiForm: edit.poiForm,
    onPoiFormChange: edit.setPoiForm,
    canWriteProject,
    onSubmitPoi: actions.submitPoi,
    createPoiPending: actions.createPoiMut.isPending,
    projectId: projectId ?? undefined,
    selectedPoi: data.selectedPoi,
    candidateSubtype: edit.candidateSubtype,
    candidateParamType: edit.candidateParamType,
    onCloseCandidates: () => {
      edit.setCandidateSubtype(null);
      edit.setCandidateParamType('external');
    },
    overrideMut: actions.overrideMut,
  };
}
