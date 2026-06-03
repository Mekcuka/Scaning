import type { MapDisplayMode } from '../hooks/useMapDisplayMode';

type MapDisplayModeToggleProps = {
  mode: MapDisplayMode;
  onChange: (mode: MapDisplayMode) => void;
  className?: string;
};

/** 2D | 3D map view switch (always visible at all breakpoints). */
export function MapDisplayModeToggle({ mode, onChange, className = '' }: MapDisplayModeToggleProps) {
  return (
    <div
      className={`map-display-mode-toggle inline-flex rounded border overflow-hidden ${className}`.trim()}
      style={{ borderColor: 'var(--border)' }}
      role="group"
      aria-label="Режим карты"
    >
      <button
        type="button"
        className={`btn btn-sm map-tool-btn rounded-none border-0 ${
          mode === '2d' ? 'btn-primary active' : 'btn-secondary'
        }`}
        title="Карта 2D (редактирование)"
        aria-label="Карта 2D"
        aria-pressed={mode === '2d'}
        onClick={() => onChange('2d')}
      >
        2D
      </button>
      <button
        type="button"
        className={`btn btn-sm map-tool-btn rounded-none border-0 ${
          mode === '3d' ? 'btn-primary active' : 'btn-secondary'
        }`}
        title="Карта 3D (только просмотр)"
        aria-label="Карта 3D"
        aria-pressed={mode === '3d'}
        onClick={() => onChange('3d')}
      >
        3D
      </button>
    </div>
  );
}
