import { useState, type MouseEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, type Project } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { normalizeProjectsList } from '../lib/normalizeProjectsList';
import { DeleteProjectConfirmModal } from '../components/DeleteProjectConfirmModal';
import { useAppStore } from '../store';

function reconcileCurrentProjectAfterDelete(
  deletedId: string,
  remaining: Project[],
  setCurrentProjectId: (id: string | null) => void,
) {
  const current = useAppStore.getState().currentProjectId;
  if (!current || current === deletedId || !remaining.some((p) => p.id === current)) {
    setCurrentProjectId(remaining[0]?.id ?? null);
  }
}

export function useDeleteProjectDialog() {
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pushToast = useAppStore((s) => s.pushToast);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const deleteMut = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: (_data, projectId) => {
      qc.setQueryData<Project[]>(queryKeys.projects, (old) =>
        normalizeProjectsList(old).filter((p) => p.id !== projectId),
      );
      const remaining = normalizeProjectsList(qc.getQueryData<Project[]>(queryKeys.projects));
      reconcileCurrentProjectAfterDelete(projectId, remaining, setCurrentProjectId);

      if (pathname === `/projects/${projectId}` || pathname.startsWith(`/projects/${projectId}/`)) {
        navigate('/projects', { replace: true });
      }

      void qc.invalidateQueries({ queryKey: queryKeys.projects });
      qc.removeQueries({ queryKey: queryKeys.project(projectId) });
      qc.removeQueries({ queryKey: queryKeys.pois(projectId) });
      qc.removeQueries({ queryKey: queryKeys.infra(projectId) });

      setProjectToDelete(null);
      pushToast('success', 'Проект удалён');
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось удалить проект'),
  });

  const openDeleteDialog = (project: Project, e?: MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setProjectToDelete(project);
  };

  const closeDeleteDialog = () => {
    if (!deleteMut.isPending) setProjectToDelete(null);
  };

  const confirmDelete = () => {
    if (!projectToDelete || deleteMut.isPending) return;
    deleteMut.mutate(projectToDelete.id);
  };

  const deleteConfirmModal = (
    <DeleteProjectConfirmModal
      project={projectToDelete}
      isPending={deleteMut.isPending}
      onClose={closeDeleteDialog}
      onConfirm={confirmDelete}
    />
  );

  return {
    openDeleteDialog,
    deleteMut,
    deleteConfirmModal,
  };
}
