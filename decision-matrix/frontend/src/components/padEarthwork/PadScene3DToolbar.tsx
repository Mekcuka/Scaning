import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Box,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Scan,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Scene3dCameraPreset } from '../../lib/padEarthworkScene3dCamera';

export type PadScene3DToolbarProps = {
  zoomPercent: number;
  activePreset?: Scene3dCameraPreset | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onCameraPreset: (preset: Scene3dCameraPreset) => void;
  onOrbitLeft: () => void;
  onOrbitRight: () => void;
  onTiltUp: () => void;
  onTiltDown: () => void;
  /** Подсказка по управлению мышью (в overlay лучше скрыть) */
  showHint?: boolean;
};

const PRESET_ICONS: Record<Scene3dCameraPreset, ReactNode> = {
  top: <Scan size={16} aria-hidden />,
  front: <ArrowUp size={16} aria-hidden />,
  side: <ArrowRight size={16} aria-hidden />,
  iso: <Box size={16} aria-hidden />,
};

const PRESET_BUTTONS: { preset: Scene3dCameraPreset; label: string; title: string }[] = [
  { preset: 'top', label: 'Сверху', title: 'Вид сверху (план)' },
  { preset: 'front', label: 'Север', title: 'Вид с севера' },
  { preset: 'side', label: 'Восток', title: 'Вид с востока' },
  { preset: 'iso', label: '3D', title: 'Изометрия' },
];

export function PadScene3DToolbar({
  zoomPercent,
  activePreset = null,
  onZoomIn,
  onZoomOut,
  onFitView,
  onCameraPreset,
  onOrbitLeft,
  onOrbitRight,
  onTiltUp,
  onTiltDown,
  showHint = true,
}: PadScene3DToolbarProps) {
  return (
    <div
      className="pad-earthwork-sketch-toolbar pad-scene3d-toolbar"
      role="toolbar"
      aria-label="Инструменты 3D-сцены"
    >
      <div className="pad-earthwork-sketch-toolbar__group">
        {PRESET_BUTTONS.map(({ preset, label, title }) => (
          <button
            key={preset}
            type="button"
            className={`pad-earthwork-sketch-toolbar__btn${
              activePreset === preset ? ' pad-earthwork-sketch-toolbar__btn--active' : ''
            }`}
            title={title}
            aria-pressed={activePreset === preset}
            onClick={() => onCameraPreset(preset)}
          >
            {PRESET_ICONS[preset]}
            <span className="pad-earthwork-sketch-toolbar__label">{label}</span>
          </button>
        ))}
      </div>

      <span className="pad-earthwork-sketch-toolbar__sep" aria-hidden />

      <div className="pad-earthwork-sketch-toolbar__group">
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Повернуть влево (15°)"
          onClick={onOrbitLeft}
        >
          <RotateCcw size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Повернуть вправо (15°)"
          onClick={onOrbitRight}
        >
          <RotateCw size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Наклонить вверх"
          onClick={onTiltUp}
        >
          <ArrowUp size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Наклонить вниз"
          onClick={onTiltDown}
        >
          <ArrowDown size={16} aria-hidden />
        </button>
      </div>

      <span className="pad-earthwork-sketch-toolbar__sep" aria-hidden />

      <div className="pad-earthwork-sketch-toolbar__group pad-earthwork-sketch-toolbar__zoom">
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Отдалить"
          onClick={onZoomOut}
        >
          <Minus size={16} aria-hidden />
        </button>
        <span className="pad-earthwork-sketch-toolbar__zoom">{zoomPercent}%</span>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Приблизить"
          onClick={onZoomIn}
        >
          <Plus size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Вписать сцену в окно"
          onClick={onFitView}
        >
          <Maximize2 size={16} aria-hidden />
        </button>
      </div>

      {showHint ? (
        <span className="pad-earthwork-sketch-toolbar__meta pad-scene3d-toolbar__hint">
          Колёсико — зум · ЛКМ — вращение · ПКМ — сдвиг
        </span>
      ) : null}
    </div>
  );
}
