import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wellTrajectoryApi, type WellTrajectoryImportPreviewResponse } from '../../lib/api/wellTrajectoryApi';
import type { ProjectJobCreateResponse } from '../../lib/api/jobs';
import { refreshMapQueries } from '../../lib/mapQueries';
import { PAD_CLUSTER_SUBTYPES } from '../../lib/api/subtypes';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useActiveProjectJob } from '../../hooks/useActiveProjectJob';
import { usePermissions } from '../../hooks/usePermissions';
import { useProjectInfraObjects } from '../../hooks/useProjectData';
import { useAppStore } from '../../store';
import { wellTrajectoryQueryKeys } from '../../hooks/useWellTrajectoryGeoJson';

const ASYNC_WELL_THRESHOLD = 20;

function detectSurveyFormat(file: File): 'csv' | 'wbp' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.wbp')) return 'wbp';
  return null;
}

function isJobResponse(value: unknown): value is ProjectJobCreateResponse {
  return Boolean(value && typeof value === 'object' && 'job_id' in value && 'job_type' in value);
}

export function useImportWellSurveysWorkflow() {
  const { canWriteInfra } = usePermissions();
  const { projectId, hasProjects, isLoading: projectsLoading } = useActiveProject();
  const { data: infraObjects = [] } = useProjectInfraObjects(projectId);
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [padId, setPadId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WellTrajectoryImportPreviewResponse | null>(null);
  const [useAsync, setUseAsync] = useState(false);
  const [interpolate, setInterpolate] = useState(true);
  const { projectJobBusy, activeProjectJob } = useActiveProjectJob(projectId);

  const padOptions = useMemo(
    () =>
      infraObjects.filter((obj) =>
        (PAD_CLUSTER_SUBTYPES as readonly string[]).includes((obj.subtype || '').toLowerCase()),
      ),
    [infraObjects],
  );

  const format = selectedFile ? detectSurveyFormat(selectedFile) : null;
  const busy = projectJobBusy;

  const invalidateTrajectory = async () => {
    if (!projectId || !padId) return;
    await queryClient.invalidateQueries({ queryKey: wellTrajectoryQueryKeys.geoJson(projectId, padId) });
    await queryClient.invalidateQueries({ queryKey: wellTrajectoryQueryKeys.last(projectId, padId) });
    await queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
    await refreshMapQueries(queryClient, projectId);
  };

  useEffect(() => {
    if (
      activeProjectJob?.job_type === 'well_trajectory_import' &&
      activeProjectJob.status === 'completed'
    ) {
      void invalidateTrajectory();
      pushToast('success', 'Импорт инклинометрии завершён');
    }
  }, [activeProjectJob?.id, activeProjectJob?.job_type, activeProjectJob?.status, padId, projectId]);

  const previewMut = useMutation({
    mutationFn: async (file: File) => {
      if (!projectId || !padId) throw new Error('Выберите проект и куст');
      const fmt = detectSurveyFormat(file);
      if (!fmt) throw new Error('Поддерживаются файлы .csv и .wbp');
      return wellTrajectoryApi.previewSurveyImport(projectId, padId, file, fmt);
    },
    onSuccess: (data) => {
      setPreview(data);
      if (data.well_count > ASYNC_WELL_THRESHOLD) setUseAsync(true);
      if (data.errors.length) {
        pushToast('warning', data.errors.join('; '));
      }
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !padId || !selectedFile || !format) {
        throw new Error('Выберите куст и файл');
      }
      const opts = { async: useAsync, interpolate };
      if (format === 'csv') {
        return wellTrajectoryApi.importSurveyCsv(projectId, padId, selectedFile, opts);
      }
      return wellTrajectoryApi.importSurveyWbp(projectId, padId, selectedFile, opts);
    },
    onSuccess: async (result) => {
      if (isJobResponse(result)) {
        pushToast('info', 'Импорт инклинометрии запущен в фоне');
        return;
      }
      pushToast('success', `Импортировано скважин: ${result.imported_count}`);
      setPreview(null);
      setSelectedFile(null);
      await invalidateTrajectory();
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const onFile = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setPreview(null);
    await previewMut.mutateAsync(file);
  };

  const onCommit = async () => {
    await commitMut.mutateAsync();
  };

  return {
    readOnly: !canWriteInfra,
    projectId,
    hasProjects,
    projectsLoading,
    padOptions,
    padId,
    setPadId,
    fileInputRef,
    selectedFile,
    preview,
    format,
    useAsync,
    setUseAsync,
    interpolate,
    setInterpolate,
    busy: busy || previewMut.isPending || commitMut.isPending,
    onFile,
    onCommit,
    asyncThreshold: ASYNC_WELL_THRESHOLD,
    activeProjectJob,
  };
}
