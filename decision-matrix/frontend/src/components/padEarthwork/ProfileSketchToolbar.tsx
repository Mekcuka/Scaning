import { Maximize2, Minus, Mountain, Plus, Trash2 } from 'lucide-react';
import { clampProfileSketchZoom } from './useProfileSketchViewport';

export type ProfileSketchToolbarProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onSampleDem: () => void;
  sampleDemPending: boolean;
  demAvailable: boolean;
  pointCount: number;
  profileLengthM: number;
  onAddPoint: () => void;
  onDeleteSelected: () => void;
  canDelete: boolean;
  readOnly: boolean;
};

export function ProfileSketchToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onSampleDem,
  sampleDemPending,
  demAvailable,
  pointCount,
  profileLengthM,
  onAddPoint,
  onDeleteSelected,
  canDelete,
  readOnly,
}: ProfileSketchToolbarProps) {
  return (
    <div className="pad-earthwork-sketch-toolbar profile-sketch-toolbar" role="toolbar" aria-label="Инструменты профиля">
      <div className="pad-earthwork-sketch-toolbar__group">
        <button
          type="button"
          className={`pad-earthwork-sketch-toolbar__btn profile-sketch-toolbar__btn--primary${demAvailable ? '' : ' profile-sketch-toolbar__btn--muted'}`}
          title={
            demAvailable
              ? 'Сэмплировать DEM вдоль центральной линии площадки'
              : 'Сначала загрузите DEM на вкладке «План»'
          }
          disabled={readOnly || sampleDemPending || !demAvailable}
          onClick={onSampleDem}
        >
          <Mountain size={16} aria-hidden />
          <span className="pad-earthwork-sketch-toolbar__label">
            {sampleDemPending ? 'Съёмка…' : 'Сэмплировать DEM'}
          </span>
        </button>
        {!readOnly && (
          <>
            <button
              type="button"
              className="pad-earthwork-sketch-toolbar__btn"
              title="Добавить точку рельефа"
              onClick={onAddPoint}
            >
              <Plus size={16} aria-hidden />
              <span className="pad-earthwork-sketch-toolbar__label">Точка</span>
            </button>
            <button
              type="button"
              className="pad-earthwork-sketch-toolbar__btn"
              title="Удалить выбранную точку"
              disabled={!canDelete}
              onClick={onDeleteSelected}
            >
              <Trash2 size={16} aria-hidden />
              <span className="pad-earthwork-sketch-toolbar__label">Удалить</span>
            </button>
          </>
        )}
      </div>

      <span className="pad-earthwork-sketch-toolbar__sep" aria-hidden />

      <div className="pad-earthwork-sketch-toolbar__group pad-earthwork-sketch-toolbar__zoom">
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Уменьшить"
          onClick={onZoomOut}
        >
          <Minus size={16} aria-hidden />
        </button>
        <span className="pad-earthwork-sketch-toolbar__zoom">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Увеличить"
          onClick={onZoomIn}
        >
          <Plus size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Вписать в окно"
          onClick={onFitView}
        >
          <Maximize2 size={16} aria-hidden />
        </button>
      </div>

      <span className="pad-earthwork-sketch-toolbar__meta">
        {pointCount} тч. · {profileLengthM.toFixed(0)} м
      </span>
    </div>
  );
}

export function profileToolbarZoomIn(zoom: number): number {
  return clampProfileSketchZoom(zoom + 0.25);
}

export function profileToolbarZoomOut(zoom: number): number {
  return clampProfileSketchZoom(zoom - 0.25);
}
