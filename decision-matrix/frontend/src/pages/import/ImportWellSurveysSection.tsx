import type { RefObject } from 'react';
import { Download, Route } from 'lucide-react';
import type { WellTrajectoryImportPreviewResponse } from '../../lib/api/wellTrajectoryApi';
import { IMPORT_WELL_SURVEY_CSV_TEMPLATE } from './importWellSurveyCsvTemplate';

type PadOption = { id: string; name: string; subtype?: string | null };

type Props = {
  readOnly: boolean;
  hasProjects: boolean;
  padOptions: PadOption[];
  padId: string;
  setPadId: (id: string) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  preview: WellTrajectoryImportPreviewResponse | null;
  format: 'csv' | 'wbp' | null;
  useAsync: boolean;
  setUseAsync: (v: boolean) => void;
  interpolate: boolean;
  setInterpolate: (v: boolean) => void;
  busy: boolean;
  asyncThreshold: number;
  onFile: (file: File | null) => Promise<void>;
  onCommit: () => Promise<void>;
};

export function ImportWellSurveysSection({
  readOnly,
  hasProjects,
  padOptions,
  padId,
  setPadId,
  fileInputRef,
  preview,
  format,
  useAsync,
  setUseAsync,
  interpolate,
  setInterpolate,
  busy,
  asyncThreshold,
  onFile,
  onCommit,
}: Props) {
  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Route size={18} />
        <h2 className="font-semibold">Импорт инклинометрии</h2>
      </div>

      {!hasProjects && (
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          Выберите проект для импорта траекторий на куст.
        </p>
      )}

      <label className="block text-sm mb-1">Куст (oil_pad / gas_pad)</label>
      <select
        className="input w-full mb-3"
        value={padId}
        disabled={readOnly || !hasProjects || busy}
        onChange={(e) => setPadId(e.target.value)}
      >
        <option value="">— выберите куст —</option>
        {padOptions.map((pad) => (
          <option key={pad.id} value={pad.id}>
            {pad.name} ({pad.subtype})
          </option>
        ))}
      </select>

      <div
        role="button"
        tabIndex={readOnly || !padId ? -1 : 0}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors mb-3 ${
          busy || readOnly || !padId ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-blue-400'
        }`}
        style={{ borderColor: 'var(--border)' }}
        onClick={() => !busy && padId && fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !busy && padId && fileInputRef.current?.click()}
      >
        <p className="text-sm font-medium">
          {busy ? 'Обработка…' : 'Перетащите CSV или .wbp, либо нажмите для выбора'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          WITSML — скоро (фаза 4b)
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.wbp"
        className="hidden"
        disabled={busy || readOnly || !padId}
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap gap-3 text-sm mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={interpolate}
            disabled={readOnly || busy}
            onChange={(e) => setInterpolate(e.target.checked)}
          />
          Уплотнить точки (interpolate)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useAsync}
            disabled={readOnly || busy}
            onChange={(e) => setUseAsync(e.target.checked)}
          />
          Фоновый импорт (&gt;{asyncThreshold} скважин — автоматически)
        </label>
      </div>

      <button
        type="button"
        className="btn btn-secondary text-sm mb-3 inline-flex items-center gap-2"
        onClick={() => {
          const blob = new Blob([IMPORT_WELL_SURVEY_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'well_survey_template.csv';
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        <Download size={14} />
        Скачать шаблон CSV
      </button>

      {preview && (
        <div className="mt-3 overflow-x-auto">
          <p className="text-sm mb-2">
            Preview: {preview.well_count} скв. ({format ?? '?'})
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 border-b">well_name</th>
                <th className="text-left p-2 border-b">станций</th>
                <th className="text-left p-2 border-b">matched index</th>
                <th className="text-left p-2 border-b">warnings</th>
              </tr>
            </thead>
            <tbody>
              {preview.wells.map((row) => (
                <tr key={row.name}>
                  <td className="p-2 border-b">{row.name}</td>
                  <td className="p-2 border-b">{row.station_count}</td>
                  <td className="p-2 border-b">{row.matched_index ?? '—'}</td>
                  <td className="p-2 border-b text-xs" style={{ color: 'var(--text-muted)' }}>
                    {row.warnings.join('; ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.errors.length > 0 && (
            <p className="text-sm mt-2" style={{ color: 'var(--danger, #c62828)' }}>
              {preview.errors.join('; ')}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary mt-3"
            disabled={readOnly || busy || preview.wells.length === 0}
            onClick={() => void onCommit()}
          >
            Импортировать на куст
          </button>
        </div>
      )}
    </div>
  );
}
