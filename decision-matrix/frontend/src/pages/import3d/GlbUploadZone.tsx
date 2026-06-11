import { useEffect, useState, type DragEvent, type RefObject } from 'react';
import { Upload } from 'lucide-react';

export function GlbUploadZone({
  fileInputRef,
  disabled,
  busy,
  targetHeightM,
  onTargetHeightChange,
  onPick,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  busy: boolean;
  targetHeightM: number;
  onTargetHeightChange: (value: number) => void;
  onPick: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const syncFileName = () => {
    setFileName(fileInputRef.current?.files?.[0]?.name ?? '');
  };

  useEffect(() => {
    if (!busy) syncFileName();
  }, [busy]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !fileInputRef.current) return;
    if (!file.name.toLowerCase().endsWith('.glb')) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInputRef.current.files = dt.files;
    setFileName(file.name);
  };

  return (
    <div className="import-3d-upload">
      <div
        className={`import-3d-dropzone${dragOver ? ' import-3d-dropzone--active' : ''}${
          disabled ? ' import-3d-dropzone--disabled' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <Upload size={28} strokeWidth={1.5} aria-hidden />
        <p className="import-3d-dropzone__title">
          {fileName ? fileName : 'Перетащите .glb сюда или нажмите для выбора'}
        </p>
        <p className="import-3d-dropzone__hint">Только GLB, до 20 МБ</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb"
          className="import-3d-dropzone__input"
          disabled={disabled}
          onChange={syncFileName}
        />
      </div>
      <div className="import-3d-upload-meta">
        <label className="form-label" htmlFor="import3d-target-height">
          Высота модели (м)
        </label>
        <input
          id="import3d-target-height"
          type="number"
          className="form-input import-3d-upload-meta__height"
          min={0.1}
          max={500}
          step={0.1}
          value={targetHeightM}
          disabled={disabled}
          onChange={(e) => onTargetHeightChange(Number(e.target.value) || 8)}
        />
      </div>
      <div className="import-3d-assign-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || busy || !fileName}
          onClick={onPick}
        >
          {busy ? 'Загрузка…' : 'Загрузить на сервер'}
        </button>
        {!fileName && !disabled ? (
          <p className="import-3d-muted import-3d-assign-hint">
            Выберите файл в зоне выше, чтобы загрузить
          </p>
        ) : null}
      </div>
    </div>
  );
}
