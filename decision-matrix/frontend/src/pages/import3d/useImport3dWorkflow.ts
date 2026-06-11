import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useProjectInfraObjects } from '../../hooks/useProjectData';
import { defaultMap3dModelsApi, SUBTYPE_LABELS, type Map3dCustomModel } from '../../lib/api';
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
import { map3dModelLabel } from './ModelsList';

export function useImport3dWorkflow() {
  const { user, role } = usePermissions();
  const { projectId, activeProject, hasProjects, isLoading: projectsLoading } = useActiveProject();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assignModelId, setAssignModelId] = useState('');
  const [assignSubtypes, setAssignSubtypes] = useState<string[]>([]);
  const [assignApplyToObjects, setAssignApplyToObjects] = useState(false);
  const [assignApplyMode, setAssignApplyMode] = useState<'empty_only' | 'all'>('empty_only');
  const [uploadTargetHeightM, setUploadTargetHeightM] = useState(8);

  const canUpload = canUploadMap3dCustomModel(role);
  const canAssign = canAssignMap3dCustomModel(role, user?.id, activeProject);
  const hasPageAccess = canUpload || canAssign;

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['map3d-custom-models', projectId],
    queryFn: () => defaultMap3dModelsApi.listMap3dCustomModels(projectId!),
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

  const applyPreviewKey = [
    'map3d-apply-preview',
    projectId,
    assignModelId,
    assignSubtypes.join(','),
    assignApplyMode,
    assignApplyToObjects,
  ] as const;

  const { data: applyPreview } = useQuery({
    queryKey: applyPreviewKey,
    queryFn: () =>
      defaultMap3dModelsApi.previewMap3dCustomModelApply(
        projectId!,
        assignModelId,
        assignSubtypes,
        assignApplyMode,
      ),
    enabled:
      !!projectId &&
      canAssign &&
      assignApplyToObjects &&
      !!assignModelId &&
      assignSubtypes.length > 0,
  });

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
    await queryClient.invalidateQueries({ queryKey: ['map3d-apply-preview', projectId] });
    await refreshMapQueries(queryClient, projectId!);
  };

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      defaultMap3dModelsApi.uploadMap3dCustomModel(projectId!, file, uploadTargetHeightM),
    onSuccess: async () => {
      pushToast('success', 'Модель загружена');
      await invalidateAll();
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (modelId: string) => defaultMap3dModelsApi.deleteMap3dCustomModel(projectId!, modelId),
    onSuccess: async () => {
      pushToast('success', 'Модель удалена');
      await invalidateAll();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const patchMut = useMutation({
    mutationFn: ({
      modelId,
      display_name,
      target_height_m,
    }: {
      modelId: string;
      display_name?: string;
      target_height_m?: number;
    }) => defaultMap3dModelsApi.patchMap3dCustomModel(projectId!, modelId, { display_name, target_height_m }),
    onSuccess: async () => {
      pushToast('success', 'Модель обновлена');
      await invalidateAll();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const assignMut = useMutation({
    mutationFn: ({
      modelId,
      subtypes,
      apply_to_objects,
      apply_mode,
    }: {
      modelId: string;
      subtypes: string[];
      apply_to_objects: boolean;
      apply_mode: 'empty_only' | 'all';
    }) =>
      defaultMap3dModelsApi.assignMap3dCustomModel(projectId!, modelId, {
        subtypes,
        apply_to_objects,
        apply_mode,
      }),
    onSuccess: async (data, { subtypes }) => {
      const updated = data.objects_updated ?? 0;
      if (subtypes.length === 0) {
        pushToast('success', 'Назначение снято');
      } else if (updated > 0) {
        pushToast('success', `Назначение сохранено, обновлено объектов: ${updated}`);
      } else {
        pushToast('success', 'Назначение сохранено');
      }
      await invalidateAll();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const onUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !projectId || !canUpload) return;
    uploadMut.mutate(file);
  };

  const onDeleteModel = (m: Map3dCustomModel) => {
    const usage = m.usage_count ?? 0;
    const usageText =
      usage > 0
        ? `Используется ${usage} ${usage === 1 ? 'объектом' : usage < 5 ? 'объектами' : 'объектами'}. `
        : '';
    const ok = window.confirm(
      `${usageText}Удалить модель «${map3dModelLabel(m)}»? Это действие нельзя отменить.`,
    );
    if (!ok) return;
    deleteMut.mutate(m.id);
  };

  const onEditModel = (m: Map3dCustomModel) => {
    const nextName = window.prompt('Отображаемое имя модели', map3dModelLabel(m));
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) {
      pushToast('error', 'Имя не может быть пустым');
      return;
    }
    const heightRaw = window.prompt('Высота модели (м)', String(m.target_height_m));
    if (heightRaw === null) return;
    const height = Number(heightRaw);
    if (!Number.isFinite(height) || height <= 0 || height > 500) {
      pushToast('error', 'Высота должна быть от 0 до 500 м');
      return;
    }
    patchMut.mutate({
      modelId: m.id,
      display_name: trimmed,
      target_height_m: height,
    });
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
    assignApplyToObjects,
    setAssignApplyToObjects,
    assignApplyMode,
    setAssignApplyMode,
    applyPreview,
    uploadTargetHeightM,
    setUploadTargetHeightM,
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
    patchMut,
    assignMut,
    onUpload,
    onDeleteModel,
    onEditModel,
    assignedSubtypesForModel,
  };
}
