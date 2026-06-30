import type { RefObject } from 'react';
import { Download, Route } from 'lucide-react';
import { Button, Card, Form } from 'antd';
import { AppSelect } from '../../components/AppSelect';
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
  embedded?: boolean;
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
  embedded = false,
}: Props) {
  const content = (
    <>
      {!hasProjects && (
        <p className="import-option__hint">Выберите проект для импорта траекторий на куст.</p>
      )}

      <Form.Item label="Куст (oil_pad / gas_pad)" className="mb-3">
        <AppSelect
          placeholder="— выберите куст —"
          value={padId}
          disabled={readOnly || !hasProjects || busy}
          onChange={setPadId}
          options={[
            { value: '', label: '— выберите куст —' },
            ...padOptions.map((pad) => ({
              value: pad.id,
              label: `${pad.name} (${pad.subtype})`,
            })),
          ]}
        />
      </Form.Item>

      <div
        role="button"
        tabIndex={readOnly || !padId ? -1 : 0}
        className={`import-dropzone import-dropzone--compact${
          busy || readOnly || !padId ? ' import-dropzone--disabled' : ''
        }`}
        onClick={() => !busy && padId && fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !busy && padId && fileInputRef.current?.click()}
      >
        <p className="import-dropzone__title">
          {busy ? 'Обработка…' : 'Перетащите CSV или .wbp, либо нажмите для выбора'}
        </p>
        <p className="import-dropzone__hint">WITSML — скоро (фаза 4b)</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.wbp"
        className="hidden"
        disabled={busy || readOnly || !padId}
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      <div className="import-option__checkbox-row">
        <label className="import-option__checkbox">
          <input
            type="checkbox"
            checked={interpolate}
            disabled={readOnly || busy}
            onChange={(e) => setInterpolate(e.target.checked)}
          />
          Уплотнить точки (interpolate)
        </label>
        <label className="import-option__checkbox">
          <input
            type="checkbox"
            checked={useAsync}
            disabled={readOnly || busy}
            onChange={(e) => setUseAsync(e.target.checked)}
          />
          Фоновый импорт (&gt;{asyncThreshold} скважин)
        </label>
      </div>

      {preview && (
        <div className="import-preview">
          <p className="import-preview__title">
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
        </div>
      )}
    </>
  );

  const actions = (
    <>
      <Button
        size="small"
        className="export-option__btn"
        icon={<Download size={16} aria-hidden />}
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
        Шаблон CSV
      </Button>
      {preview ? (
        <Button
          type="primary"
          size="small"
          className="export-option__btn export-option__btn--wide"
          disabled={readOnly || busy || preview.wells.length === 0}
          loading={busy}
          onClick={() => void onCommit()}
        >
          Импортировать на куст
        </Button>
      ) : null}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card size="small" className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Route size={18} />
        <h2 className="font-semibold">Импорт инклинометрии</h2>
      </div>
      {content}
      <div className="flex flex-wrap gap-2 mt-3">{actions}</div>
    </Card>
  );
}
