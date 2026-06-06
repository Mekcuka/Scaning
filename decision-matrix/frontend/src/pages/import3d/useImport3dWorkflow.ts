import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useProjectInfraObjects } from '../../hooks/useProjectData';
import { api, SUBTYPE_LABELS, type Map3dCustomModel } from '../../lib/api';
import {
  canAssignMap3dCustomModel,
  canUploadMap3dCustomModel,
} from '../../lib/permissions';
import { setProjectCustomGltfAssets } from '../../lib/map3d/map3dCustomAssets';
import { clearGltfPrototypeCache } from '../../lib/map3d/map3dGltfLoader';
import { map3dAssignableSubtypes } from '../../lib/map3d/render3dModelOptions';
import { refreshMapQueries } from '../../lib/mapQueries';
import { useActiveProject } from '../../hooks/useActiveProject';
import { usePermissions } from '../../hooks/usePermissions';
import { useAppStore } from '../../store';

export function useImport3dWorkflow() {
  const { user, role } = usePermissions();
  const { projectId, activeProject, hasProjects, isLoading: projectsLoading } = useActiveProject();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assignModelId, setAssignModelId] = useState('');
  const [assignSubtypes, setAssignSubtypes] = useState<string[]>([]);

  const canUpload = canUploadMap3dCustomModel(role);
  const canAssign = canAssignMap3dCustomModel(role, user?.id, activeProject);
  const hasPageAccess = canUpload || canAssign;

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['map3d-custom-models', projectId],
    queryFn: () => api.listMap3dCustomModels(projectId!),
    enabled: !!projectId && hasPageAccess,
  });

  const customModelsKey = useMemo(
    () => models.map((m) => m.id).sort().join(','),
    [models],
  );

  useEffect(() => {
    if (!projectId) {
      setProjectCustomGltfAssets('', []);
      clearGltfPrototypeCache();
      return;
    }
    setProjectCustomGltfAssets(projectId, models);
    clearGltfPrototypeCache();
  }, [projectId, models]);

  const { data: infraObjects = [] } = useProjectInfraObjects(projectId, {
    enabled: canAssign,
  });

  const assignableSubtypes = useMemo(() => map3dAssignableSubtypes(), []);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === assignModelId),
    [models, assignModelId],
  );
  const serverSubtypesKey = (selectedModel?.assigned_subtypes ?? []).join(',');

  useEffect(() => {
    if (!assignModelId) {
      setAssignSubtypes([]);
      return;
    }
    setAssignSubtypes([...(selectedModel?.assigned_subtypes ?? [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when server assignment changes
  }, [assignModelId, serverSubtypesKey]);

  const toggleAssignSubtype = (subtype: string) => {
    setAssignSubtypes((prev) =>
      prev.includes(subtype) ? prev.filter((s) => s !== subtype) : [...prev, subtype],
    );
  };

  const denied = !projectsLoading && !hasPageAccess;

  useEffect(() => {
    if (!denied) return;
    pushToast('error', 'Недостаточно прав для раздела «Импорт 3D»');
  }, [denied, pushToast]);

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['map3d-custom-models', projectId] });
    await refreshMapQueries(queryClient, projectId!);
  };

  const uploadMut = useMutation({
    mutationFn: (file: File) => api.uploadMap3dCustomModel(projectId!, file),
    onSuccess: async () => {
      pushToast('success', 'Модель загружена');
      await invalidateAll();
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (modelId: string) => api.deleteMap3dCustomModel(projectId!, modelId),
    onSuccess: async () => {
      pushToast('success', 'Модель удалена');
      await invalidateAll();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const assignMut = useMutation({
    mutationFn: ({ modelId, subtypes }: { modelId: string; subtypes: string[] }) =>
      api.assignMap3dCustomModel(projectId!, modelId, subtypes),
    onSuccess: async (_data, { subtypes }) => {
      pushToast(
        'success',
        subtypes.length === 0 ? 'Назначение снято' : 'Назначение сохранено',
      );
      await invalidateAll();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const onUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !projectId || !canUpload) return;
    uploadMut.mutate(file);
  };

  const assignedSubtypesForModel = (m: Map3dCustomModel) =>
    (m.assigned_subtypes ?? []).map((st) => SUBTYPE_LABELS[st] ?? st);

  return {
    projectId,
    hasProjects,
    projectsLoading,
    fileInputRef,
    assignModelId,
    setAssignModelId,
    assignSubtypes,
    toggleAssignSubtype,
    canUpload,
    canAssign,
    hasPageAccess,
    denied,
    models,
    modelsLoading,
    infraObjects,
    customModelsKey,
    assignableSubtypes,
    uploadMut,
    deleteMut,
    assignMut,
    onUpload,
    assignedSubtypesForModel,
  };
}
