import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Link as LinkIcon } from 'lucide-react';
import { api, type ImportConnectionCreate } from '../lib/api';
import { formatCoord } from '../lib/coords';
import { useActiveProject } from '../hooks/useActiveProject';
import { refreshMapQueries } from '../lib/mapQueries';
import { PoiParamsPanel } from '../components/PoiParamsPanel';

export function ImportPage() {
  const { projectId, hasProjects, isLoading: projectsLoading, activeProject } = useActiveProject();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      setMessage(
        pendingLog.status === 'completed'
          ? `Импортировано ${pendingLog.records_imported} из ${pendingLog.records_total}`
          : `Ошибка: ${(pendingLog.errors || []).join('; ')}`
      );
      setPendingLogId(null);
      queryClient.invalidateQueries({ queryKey: ['importLogs', projectId] });
      if (projectId && pendingLog.status === 'completed') {
        void refreshMapQueries(queryClient, projectId);
      }
    }
  }, [pendingLog, projectId, queryClient]);

  const importMut = useMutation({
    mutationFn: async ({ file, format }: { file: File; format: string }) => {
      if (!projectId) throw new Error('Выберите проект');
      if (useAsync) {
        let log;
        if (format === 'csv') log = await api.importCsvAsync(projectId, file);
        else if (format === 'kml') log = await api.importKmlAsync(projectId, file);
        else if (format === 'geojson') log = await api.importGeojsonAsync(projectId, file);
        else {
          return api.importShapefile(projectId, file);
        }
        return log;
      }
      if (format === 'csv') return api.importCsv(projectId, file);
      if (format === 'kml') return api.importKml(projectId, file);
      if (format === 'shp') return api.importShapefile(projectId, file);
      return api.importGeojson(projectId, file);
    },
    onSuccess: (log) => {
      if (log.status === 'pending' || log.status === 'running') {
        setPendingLogId(log.id);
        return;
      }
      setMessage(`Импортировано ${log.records_imported} из ${log.records_total}`);
      queryClient.invalidateQueries({ queryKey: ['importLogs', projectId] });
      if (projectId) void refreshMapQueries(queryClient, projectId);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const saveConnMut = useMutation({
    mutationFn: () => api.createImportConnection(projectId!, connForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importConnections', projectId] });
      setMessage('Подключение сохранено');
    },
  });

  const testConnMut = useMutation({
    mutationFn: (id: string) => api.testImportConnection(projectId!, id),
    onSuccess: (r) => setMessage(r.ok ? 'Подключение успешно' : `Ошибка: ${r.error || r.status_code}`),
  });

  const syncConnMut = useMutation({
    mutationFn: (id: string) => api.syncImportConnection(projectId!, id),
    onSuccess: (r) => {
      setMessage(`Синхронизировано объектов: ${r.imported}`);
      if (projectId) void refreshMapQueries(queryClient, projectId);
    },
  });

  const detectFormat = (file: File): string => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.kml') || lower.endsWith('.kmz')) return 'kml';
    if (lower.endsWith('.zip')) return 'shp';
    return 'geojson';
  };

  const onFile = async (file: File | null, commit = true) => {
    if (!file || !projectId) return;
    const format = detectFormat(file);
    if (!commit) {
      const p = await api.previewImport(projectId, file, format === 'shp' ? 'csv' : format);
      setPreview(p);
      return;
    }
    setPreview(null);
    importMut.mutate({ file, format });
  };

  const busy = importMut.isPending || !!pendingLogId;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Импорт данных</h1>

      {!projectsLoading && !hasProjects && (
        <div className="card mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Создайте проект на странице «Проекты», затем загрузите CSV.
        </div>
      )}

      {activeProject && (
        <div className="card mb-4 text-sm">
          Импорт в проект: <strong>{activeProject.name}</strong> (можно сменить в шапке страницы)
        </div>
      )}

      {message && (
        <div className="card mb-4 text-sm border-l-4 border-blue-500">{message}</div>
      )}

      {pendingLogId && (
        <div className="card mb-4">
          <p className="text-sm mb-2">Импорт в фоне: {pendingLog?.status || 'pending'}…</p>
          <div className="h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{
                width:
                  pendingLog?.status === 'completed'
                    ? '100%'
                    : pendingLog?.status === 'running'
                      ? '60%'
                      : '20%',
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon size={18} />
            <h2 className="font-semibold">Подключение API</h2>
          </div>
          <div className="form-group">
            <label>Название</label>
            <input
              value={connForm.name}
              onChange={(e) => setConnForm({ ...connForm, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>URL REST API</label>
            <input
              value={connForm.api_url}
              onChange={(e) => setConnForm({ ...connForm, api_url: e.target.value })}
              placeholder="https://api.example.com/v1/infrastructure"
            />
          </div>
          <div className="form-group">
            <label>Тип аутентификации</label>
            <select
              value={connForm.auth_type}
              onChange={(e) => setConnForm({ ...connForm, auth_type: e.target.value })}
            >
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key</option>
              <option value="basic">Basic (user:password)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Учётные данные</label>
            <input
              type="password"
              value={connForm.credentials}
              onChange={(e) => setConnForm({ ...connForm, credentials: e.target.value })}
            />
          </div>
          {connections.length > 0 && (
            <div className="form-group">
              <label>Сохранённые подключения</label>
              <select
                value={selectedConnId ?? ''}
                onChange={(e) => setSelectedConnId(e.target.value || null)}
              >
                <option value="">— выберите —</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={!projectId}
              onClick={() => saveConnMut.mutate()}
            >
              Сохранить
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={!projectId || !selectedConnId}
              onClick={() => selectedConnId && testConnMut.mutate(selectedConnId)}
            >
              Тест
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={!projectId || !selectedConnId}
              onClick={() => selectedConnId && syncConnMut.mutate(selectedConnId)}
            >
              Синхронизировать
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Upload size={18} />
            <h2 className="font-semibold">Импорт файлов</h2>
          </div>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={useAsync} onChange={(e) => setUseAsync(e.target.checked)} />
            Фоновый импорт (CSV / GeoJSON / KML, polling)
          </label>
          <div
            role="button"
            tabIndex={0}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-blue-400'
            }`}
            style={{ borderColor: 'var(--border)' }}
            onClick={() => !busy && fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && !busy && fileInputRef.current?.click()}
          >
            <Upload size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {busy ? 'Импорт…' : 'Перетащите файл или нажмите для выбора'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              CSV, GeoJSON, KML/KMZ, ZIP (Shapefile)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.geojson,.json,.kml,.kmz,.zip"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="btn btn-secondary text-sm flex-1"
              disabled={busy}
              onClick={() => {
                const f = fileInputRef.current?.files?.[0];
                if (f) void onFile(f, false);
              }}
            >
              Превью (dry-run)
            </button>
          </div>
          {preview && (
            <div className="mt-3 text-xs border rounded-lg p-2 max-h-40 overflow-auto" style={{ borderColor: 'var(--border)' }}>
              <div className="font-medium mb-1">
                Превью: {preview.records_total} строк
                {preview.errors.length > 0 && `, ошибок: ${preview.errors.length}`}
              </div>
              {preview.errors.slice(0, 5).map((e, i) => (
                <div key={i} className="text-red-600">
                  {e}
                </div>
              ))}
              <table className="w-full mt-1">
                <tbody>
                  {preview.rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.name)}</td>
                      <td>{String(r.subtype)}</td>
                      <td>
                        {formatCoord(r.lon as number)}, {formatCoord(r.lat as number)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            CSV: name, type, lat, lon (точечные) или start_lat, start_lon, end_lat, end_lon (линейные).
            SHP: zip-архив с .shp (требуется ogr2ogr в PATH).
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">История импорта</h2>
        {isLoading && <p className="text-sm">Загрузка…</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Файл</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Записей</th>
                <th>Ошибки</th>
              </tr>
            </thead>
            <tbody>
              {history.map((log) => (
                <tr key={log.id}>
                  <td>{log.file_name || '—'}</td>
                  <td>{log.source_type}</td>
                  <td>{log.status}</td>
                  <td>
                    {log.records_imported}/{log.records_total}
                  </td>
                  <td className="text-xs max-w-xs truncate" title={(log.errors || []).join('\n')}>
                    {(log.errors || []).length ? log.errors.slice(0, 2).join('; ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PoiParamsPanel
        projectId={projectId}
        readOnly
        showSave={false}
        sections={['basic', 'engineering']}
        title="Справочник параметров POI проекта"
        className="mt-4"
      />
    </div>
  );
}
