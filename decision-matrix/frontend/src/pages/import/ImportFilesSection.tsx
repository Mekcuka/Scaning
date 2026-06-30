import type { RefObject } from 'react';
import { Upload } from 'lucide-react';
import { Button, Card } from 'antd';
import { formatCoord } from '../../lib/coords';
import { IMPORT_CSV_TEMPLATE } from './importCsvTemplate';
import type { ImportPreviewRejectedRow } from './importFormat';

type Preview = {
  rows: Record<string, unknown>[];
  errors: string[];
  records_total: number;
};

type Props = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  readOnly: boolean;
  busy: boolean;
  useAsync: boolean;
  setUseAsync: (v: boolean) => void;
  preview: Preview | null;
  previewRejected: ImportPreviewRejectedRow[];
  onFile: (file: File | null, commit?: boolean) => Promise<void>;
  embedded?: boolean;
};

export function ImportFilesSection({
  fileInputRef,
  readOnly,
  busy,
  useAsync,
  setUseAsync,
  preview,
  previewRejected,
  onFile,
  embedded = false,
}: Props) {
  const content = (
    <>
      <label className="import-option__checkbox">
        <input
          type="checkbox"
          checked={useAsync}
          disabled={readOnly}
          onChange={(e) => setUseAsync(e.target.checked)}
        />
        Фоновый импорт (CSV / GeoJSON / KML, polling)
      </label>
      <div
        role="button"
        tabIndex={readOnly ? -1 : 0}
        className={`import-dropzone${busy || readOnly ? ' import-dropzone--disabled' : ''}`}
        onClick={() => !busy && !readOnly && fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !busy && !readOnly && fileInputRef.current?.click()}
      >
        <Upload size={28} className="import-dropzone__icon" aria-hidden />
        <p className="import-dropzone__title">
          {busy ? 'Импорт…' : 'Перетащите файл или нажмите для выбора'}
        </p>
        <p className="import-dropzone__hint">
          CSV, GeoJSON, экспорт Искра (.json), KML/KMZ, ZIP (Shapefile)
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.geojson,.json,.kml,.kmz,.zip"
        className="hidden"
        disabled={busy || readOnly}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {preview && (
        <div className="import-preview">
          <div className="import-preview__title">
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
      <p className="import-option__footnote">
        CSV: `name`, `type|subtype`, `lat`, `lon` (точечные) или `start_lat`, `start_lon`, `end_lat`,
        `end_lon` (линейные). SHP: zip с `.shp` (требуется `ogr2ogr` в PATH).
      </p>
    </>
  );

  const actions = (
    <>
      <Button
        size="small"
        className="export-option__btn"
        disabled={busy || readOnly}
        onClick={() => {
          const f = fileInputRef.current?.files?.[0];
          if (f) void onFile(f, false);
        }}
      >
        Превью (dry-run)
      </Button>
      <Button
        size="small"
        className="export-option__btn"
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
        Шаблон CSV
      </Button>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card size="small">
      <div className="flex items-center gap-2 mb-4">
        <Upload size={18} />
        <h2 className="font-semibold">Импорт файлов</h2>
      </div>
      {content}
      <div className="flex gap-2 mt-3">{actions}</div>
    </Card>
  );
}
