import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ImportConnectionCreate } from '../../lib/api';
import { refreshMapQueries } from '../../lib/mapQueries';
import { useActiveProject } from '../../hooks/useActiveProject';
import { usePermissions } from '../../hooks/usePermissions';
import { useAppStore } from '../../store';
import { detectImportFormat, parseImportPreviewErrors } from './importFormat';

export function useImportPageWorkflow() {
  const { canWriteInfra } = usePermissions();
  const { projectId, hasProjects, isLoading: projectsLoading } = useActiveProject();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pushToast = useAppStore((s) => s.pushToast);
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);
  const [useAsync, setUseAsync] = useState(false);
  const [connForm, setConnForm] = useState<ImportConnectionCreate>({
    name: 'Корпоративный API',
    api_url: '',
    auth_type: 'bearer',
    credentials: '',
  });
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    rows: Record<string, unknown>[];
    errors: string[];
    records_total: number;
  } | null>(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['importLogs', projectId],
    queryFn: () => api.getImportLogs(projectId ?? undefined),
    enabled: !!projectId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['importConnections', projectId],
    queryFn: () => api.getImportConnections(projectId!),
    enabled: !!projectId,
  });

  const { data: pendingLog } = useQuery({
    queryKey: ['importLog', pendingLogId],
    queryFn: () => api.getImportLog(pendingLogId!),
    enabled: !!pendingLogId,
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      return st === 'pending' || st === 'running' ? 2000 : false;
    },
  });

  useEffect(() => {
    if (pendingLog?.status === 'completed' || pendingLog?.status === 'failed') {
      pushToast(
        pendingLog.status === 'completed' ? 'success' : 'error',
        pendingLog.status === 'completed'
          ? `Импортировано ${pendingLog.records_imported} из ${pendingLog.records_total}`
          : `Ошибка: ${(pendingLog.errors || []).join('; ')}`,
      );
      setPendingLogId(null);
      queryClient.invalidateQueries({ queryKey: ['importLogs', projectId] });
      if (projectId && pendingLog.status === 'completed') {
        void refreshMapQueries(queryClient, projectId);
      }
    }
  }, [pendingLog, projectId, queryClient, pushToast]);

  const importMut = useMutation({
    mutationFn: async ({ file, format }: { file: File; format: string }) => {
      if (!projectId) throw new Error('Выберите проект');
      if (useAsync) {
        let log;
        if (format === 'csv') log = await api.importCsvAsync(projectId, file);
        else if (format === 'kml') log = await api.importKmlAsync(projectId, file);
        else if (format === 'spark') log = await api.importSparkAsync(projectId, file);
        else if (format === 'geojson') log = await api.importGeojsonAsync(projectId, file);
        else {
          return api.importShapefile(projectId, file);
        }
        return log;
      }
      if (format === 'csv') return api.importCsv(projectId, file);
      if (format === 'kml') return api.importKml(projectId, file);
      if (format === 'shp') return api.importShapefile(projectId, file);
      if (format === 'spark') return api.importSpark(projectId, file);
      return api.importGeojson(projectId, file);
    },
    onSuccess: (log) => {
      if (log.status === 'pending' || log.status === 'running') {
        setPendingLogId(log.id);
        pushToast('info', 'Импорт запущен в фоне');
        return;
      }
      pushToast('success', `Импортировано ${log.records_imported} из ${log.records_total}`);
      queryClient.invalidateQueries({ queryKey: ['importLogs', projectId] });
      if (projectId) void refreshMapQueries(queryClient, projectId);
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const saveConnMut = useMutation({
    mutationFn: () => api.createImportConnection(projectId!, connForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importConnections', projectId] });
      pushToast('success', 'Подключение сохранено');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const testConnMut = useMutation({
    mutationFn: (id: string) => api.testImportConnection(projectId!, id),
    onSuccess: (r) =>
      pushToast(
        r.ok ? 'success' : 'error',
        r.ok ? 'Подключение успешно' : `Ошибка: ${r.error || r.status_code}`,
      ),
    onError: (e: Error) => pushToast('error', e.message),
  });

  const syncConnMut = useMutation({
    mutationFn: (id: string) => api.syncImportConnection(projectId!, id),
    onSuccess: (r) => {
      pushToast('success', `Синхронизировано объектов: ${r.imported}`);
      if (projectId) void refreshMapQueries(queryClient, projectId);
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const onFile = async (file: File | null, commit = true) => {
    if (!file || !projectId) return;
    const format = await detectImportFormat(file);
    if (!commit) {
      const p = await api.previewImport(projectId, file, format === 'shp' ? 'csv' : format);
      setPreview(p);
      return;
    }
    setPreview(null);
    importMut.mutate({ file, format });
  };

  const busy = importMut.isPending || !!pendingLogId;
  const readOnly = !canWriteInfra;
  const previewRejected = parseImportPreviewErrors(preview?.errors ?? []);

  return {
    projectId,
    hasProjects,
    projectsLoading,
    fileInputRef,
    useAsync,
    setUseAsync,
    connForm,
    setConnForm,
    selectedConnId,
    setSelectedConnId,
    preview,
    history,
    isLoading,
    connections,
    pendingLogId,
    pendingLog,
    saveConnMut,
    testConnMut,
    syncConnMut,
    onFile,
    busy,
    readOnly,
    previewRejected,
  };
}
