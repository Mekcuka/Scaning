import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Link as LinkIcon } from 'lucide-react';
import { api, type ImportConnectionCreate } from '../lib/api';
import { formatCoord } from '../lib/coords';
import { useActiveProject } from '../hooks/useActiveProject';
import { useAppStore } from '../store';
import { refreshMapQueries } from '../lib/mapQueries';
import { AppSelect } from '../components/AppSelect';

const IMPORT_CSV_TEMPLATE = [
  'name,type,lat,lon,start_lat,start_lon,end_lat,end_lon',
  'COMPLEX_NODE_N1,node,56.020,38.060,,,,',
  'COMPLEX_NODE_N2,node,56.040,38.090,,,,',
  'COMPLEX_NODE_N3,node,56.060,38.130,,,,',
  'COMPLEX_NODE_N4,node,56.050,38.170,,,,',
  'COMPLEX_NODE_N5,node,56.020,38.190,,,,',
  'COMPLEX_NODE_N6,node,55.995,38.150,,,,',
  'COMPLEX_NODE_N7,node,55.985,38.105,,,,',
  'COMPLEX_NODE_N8,node,56.000,38.070,,,,',
  'COMPLEX_GKS1,gas_processing,56.050,38.045,,,,',
  'COMPLEX_GKS2,gas_processing,56.075,38.155,,,,',
  'COMPLEX_GTES1,gtes,56.085,38.115,,,,',
  'COMPLEX_GTES2,gtes,56.040,38.205,,,,',
  'COMPLEX_SUB1,substation,56.005,38.035,,,,',
  'COMPLEX_SUB2,substation,55.980,38.175,,,,',
  'COMPLEX_REF1,refinery,56.070,38.220,,,,',
  'COMPLEX_REF2,refinery,56.000,38.210,,,,',
  'COMPLEX_AUTOROAD_01,autoroad,,,56.050,38.045,56.020,38.060',
  'COMPLEX_AUTOROAD_02,autoroad,,,56.020,38.060,56.005,38.035',
  'COMPLEX_AUTOROAD_03,autoroad,,,56.005,38.035,56.000,38.070',
  'COMPLEX_AUTOROAD_04,autoroad,,,56.000,38.070,55.985,38.105',
  'COMPLEX_AUTOROAD_05,autoroad,,,55.985,38.105,56.000,38.210',
  'COMPLEX_AUTOROAD_06,autoroad,,,56.000,38.210,55.995,38.150',
  'COMPLEX_AUTOROAD_07,autoroad,,,55.995,38.150,56.040,38.205',
  'COMPLEX_AUTOROAD_08,autoroad,,,56.040,38.205,56.020,38.190',
  'COMPLEX_AUTOROAD_09,autoroad,,,56.020,38.190,56.070,38.220',
  'COMPLEX_AUTOROAD_10,autoroad,,,56.070,38.220,56.075,38.155',
  'COMPLEX_OIL_01,oil_pipeline,,,56.070,38.220,56.050,38.170',
  'COMPLEX_OIL_02,oil_pipeline,,,56.050,38.170,56.020,38.190',
  'COMPLEX_OIL_03,oil_pipeline,,,56.020,38.190,56.000,38.210',
  'COMPLEX_GAS_01,gas_pipeline,,,56.050,38.045,56.040,38.090',
  'COMPLEX_GAS_02,gas_pipeline,,,56.040,38.090,56.085,38.115',
  'COMPLEX_GAS_03,gas_pipeline,,,56.085,38.115,56.060,38.130',
  'COMPLEX_GAS_04,gas_pipeline,,,56.060,38.130,56.075,38.155',
  'COMPLEX_GAS_05,gas_pipeline,,,56.075,38.155,56.070,38.220',
  'COMPLEX_WATER_01,water_pipeline,,,56.020,38.060,56.040,38.090',
  'COMPLEX_WATER_02,water_pipeline,,,56.040,38.090,56.060,38.130',
  'COMPLEX_WATER_03,water_pipeline,,,56.060,38.130,56.050,38.170',
  'COMPLEX_WATER_04,water_pipeline,,,56.050,38.170,56.020,38.190',
  'COMPLEX_WATER_05,water_pipeline,,,56.020,38.190,55.995,38.150',
  'COMPLEX_WATER_06,water_pipeline,,,55.995,38.150,55.985,38.105',
  'COMPLEX_WATER_07,water_pipeline,,,55.985,38.105,56.000,38.070',
  'COMPLEX_WATER_08,water_pipeline,,,56.000,38.070,56.020,38.060',
  'COMPLEX_POWER_01,power_line,,,56.085,38.115,56.005,38.035',
  'COMPLEX_POWER_02,power_line,,,56.005,38.035,56.020,38.060',
  'COMPLEX_POWER_03,power_line,,,56.020,38.060,56.050,38.045',
  'COMPLEX_POWER_04,power_line,,,56.050,38.045,56.040,38.090',
  'COMPLEX_POWER_05,power_line,,,56.040,38.090,56.000,38.210',
  'COMPLEX_POWER_06,power_line,,,56.000,38.210,55.980,38.175',
  'COMPLEX_POWER_07,power_line,,,55.980,38.175,56.040,38.205',
].join('\n');

export function ImportPage() {
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
          : `Ошибка: ${(pendingLog.errors || []).join('; ')}`
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
      pushToast(r.ok ? 'success' : 'error', r.ok ? 'Подключение успешно' : `Ошибка: ${r.error || r.status_code}`),
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

  const detectFormat = async (file: File): Promise<string> => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.kml') || lower.endsWith('.kmz')) return 'kml';
    if (lower.endsWith('.zip')) return 'shp';
    if (lower.endsWith('.json') || lower.endsWith('.geojson')) {
      try {
        const head = await file.slice(0, 8192).text();
        if (
          head.includes('"type"') &&
          head.includes('"project"') &&
          head.includes('"objects"')
        ) {
          return 'spark';
        }
      } catch {
        /* use geojson */
      }
    }
    return 'geojson';
  };

  const onFile = async (file: File | null, commit = true) => {
    if (!file || !projectId) return;
    const format = await detectFormat(file);
    if (!commit) {
      const p = await api.previewImport(projectId, file, format === 'shp' ? 'csv' : format);
      setPreview(p);
      return;
    }
    setPreview(null);
    importMut.mutate({ file, format });
  };

  const busy = importMut.isPending || !!pendingLogId;
  const previewRejected = (preview?.errors ?? [])
    .map((msg) => {
      const m = msg.match(/^Row\s+(\d+)\s+\((.+)\):\s+(.+)$/);
      if (!m) return null;
      return { row: m[1], name: m[2], reason: m[3] };
    })
    .filter(Boolean) as { row: string; name: string; reason: string }[];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Импорт данных</h1>

      {!projectsLoading && !hasProjects && (
        <div className="card mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Создайте проект на странице «Проекты», затем загрузите CSV.
        </div>
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
            <AppSelect
              value={connForm.auth_type || 'bearer'}
              onChange={(auth_type) => setConnForm({ ...connForm, auth_type })}
              options={[
                { value: 'bearer', label: 'Bearer Token' },
                { value: 'api_key', label: 'API Key' },
                { value: 'basic', label: 'Basic (user:password)' },
              ]}
            />
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
              <AppSelect
                placeholder="— выберите —"
                value={selectedConnId ?? ''}
                onChange={(id) => setSelectedConnId(id || null)}
                options={[
                  { value: '', label: '— выберите —' },
                  ...connections.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
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
              CSV, GeoJSON, Spark export (.json), KML/KMZ, ZIP (Shapefile)
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
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => {
                const blob = new Blob([IMPORT_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'import_template.csv';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
            >
              Скачать шаблон CSV
            </button>
          </div>
          {preview && (
            <div className="mt-3 text-xs border rounded-lg p-2 max-h-40 overflow-auto" style={{ borderColor: 'var(--border)' }}>
              <div className="font-medium mb-1">
                Превью: {preview.records_total} строк
                {preview.errors.length > 0 && `, ошибок: ${preview.errors.length}`}
              </div>
              {previewRejected.length > 0 && (
                <div className="mb-2">
                  <div className="font-medium text-red-700 mb-1">Причины отклонения строк</div>
                  <table className="w-full">
                    <tbody>
                      {previewRejected.slice(0, 6).map((r) => (
                        <tr key={`${r.row}-${r.name}`}>
                          <td className="align-top pr-2 whitespace-nowrap text-red-700">#{r.row}</td>
                          <td className="align-top pr-2">{r.name}</td>
                          <td className="align-top text-red-700">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
            CSV: `name`, `type|subtype`, `lat`, `lon` (точечные: ГКС/ГТЭС/ПС/НПЗ/Узел) или
            `start_lat`, `start_lon`, `end_lat`, `end_lon` (линейные).
            Для линий при импорте действует матрица допустимых связей (как на карте), ошибки пишутся в лог.
            SHP: zip-архив с `.shp` (требуется `ogr2ogr` в PATH).
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
    </div>
  );
}
