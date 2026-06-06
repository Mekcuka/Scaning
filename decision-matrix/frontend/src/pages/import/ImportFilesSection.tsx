import type { RefObject } from 'react';
import { Upload } from 'lucide-react';
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
}: Props) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Upload size={18} />
        <h2 className="font-semibold">Импорт файлов</h2>
      </div>
      <label className="flex items-center gap-2 text-sm mb-3">
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
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          busy || readOnly ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-blue-400'
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
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          className="btn btn-secondary text-sm flex-1"
          disabled={busy || readOnly}
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
        <div
          className="mt-3 text-xs border rounded-lg p-2 max-h-40 overflow-auto"
          style={{ borderColor: 'var(--border)' }}
        >
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
  );
}
