import type { UseMutationResult } from '@tanstack/react-query';
import { AppModal } from '../../components/AppModal';
import { CandidatesModal } from '../../components/CandidatesModal';
import { PoiCreateForm } from '../../components/poiParamsForm/PoiCreateForm';
import type { Candidate, POI } from '../../lib/api';
import type { PoiFormValues } from '../../lib/poiParams';
import type { DeleteConfirmState } from '../../hooks/useMapDeleteSelection';

export type MapPageModalsProps = {
  deleteConfirm: DeleteConfirmState;
  setDeleteConfirm: (state: DeleteConfirmState) => void;
  deletePending: boolean;
  poiModalOpen: boolean;
  onClosePoiModal: () => void;
  poiForm: PoiFormValues;
  onPoiFormChange: (value: PoiFormValues) => void;
  canWriteProject: boolean;
  onSubmitPoi: () => void;
  createPoiPending: boolean;
  projectId: string | undefined;
  selectedPoi: POI | null;
  candidateSubtype: string | null;
  candidateParamType: 'external' | 'external_linear';
  onCloseCandidates: () => void;
  overrideMut: UseMutationResult<
    unknown,
    Error,
    Candidate | { subtype: string; force_construction: boolean; param_type: 'external' | 'external_linear' }
  >;
};

export function MapPageModals({
  deleteConfirm,
  setDeleteConfirm,
  deletePending,
  poiModalOpen,
  onClosePoiModal,
  poiForm,
  onPoiFormChange,
  canWriteProject,
  onSubmitPoi,
  createPoiPending,
  projectId,
  selectedPoi,
  candidateSubtype,
  candidateParamType,
  onCloseCandidates,
  overrideMut,
}: MapPageModalsProps) {
  return (
    <>
      {deleteConfirm && (
        <AppModal
          title={deleteConfirm.title}
          titleId="delete-confirm-title"
          onClose={() => setDeleteConfirm(null)}
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deletePending}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={deletePending}
                onClick={() => {
                  const action = deleteConfirm.onConfirm;
                  setDeleteConfirm(null);
                  action();
                }}
              >
                {deletePending ? 'Удаление…' : 'Удалить'}
              </button>
            </>
          }
        >
          <p className="text-sm mb-2">{deleteConfirm.message}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Отменить действие можно через Ctrl+Z.
          </p>
        </AppModal>
      )}

      {poiModalOpen && (
        <AppModal
          title="Новая точка интереса"
          subtitle="Основные параметры — остальное можно изменить в карточке точки"
          titleId="poi-create-title"
          onClose={onClosePoiModal}
          size="md"
          overlayClassName="app-modal-overlay--poi-create"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={onClosePoiModal}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSubmitPoi}
                disabled={createPoiPending || !canWriteProject}
              >
                {createPoiPending ? 'Сохранение…' : 'Сохранить точку'}
              </button>
            </>
          }
        >
          <PoiCreateForm
            value={poiForm}
            onChange={onPoiFormChange}
            readOnly={!canWriteProject}
          />
        </AppModal>
      )}

      {candidateSubtype && selectedPoi && projectId && (
        <CandidatesModal
          projectId={projectId}
          poiId={selectedPoi.id}
          subtype={candidateSubtype}
          paramType={candidateParamType}
          onClose={onCloseCandidates}
          onSelect={(c) => overrideMut.mutate(c)}
        />
      )}
    </>
  );
}
