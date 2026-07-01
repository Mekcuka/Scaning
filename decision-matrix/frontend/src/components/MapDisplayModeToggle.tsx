import { Box, Map, Shapes } from 'lucide-react';
import { Segmented } from 'antd';
import type { MapDisplayMode } from '../hooks/useMapDisplayMode';

type MapDisplayModeToggleProps = {
  mode: MapDisplayMode;
  onChange: (mode: MapDisplayMode) => void;
  className?: string;
};

const MODES: {
  value: MapDisplayMode;
  title: string;
  label: string;
  Icon: typeof Map;
}[] = [
  { value: '2d', title: 'Карта 2D (редактирование)', label: 'Карта 2D', Icon: Map },
  { value: 'footprints', title: 'Площадки (контуры)', label: 'Карта площадок', Icon: Shapes },
  { value: '3d', title: 'Карта 3D (только просмотр)', label: 'Карта 3D', Icon: Box },
];

/** Icon-only 2D / footprints / 3D map view switch. */
export function MapDisplayModeToggle({ mode, onChange, className = '' }: MapDisplayModeToggleProps) {
  return (
    <Segmented
      className={`map-display-mode-toggle ${className}`.trim()}
      value={mode}
      onChange={(value) => onChange(value as MapDisplayMode)}
      aria-label="Режим карты"
      options={MODES.map(({ value, title, label, Icon }) => ({
        value,
        title,
        label: (
          <span className="map-display-mode-btn__inner" aria-label={label}>
            <Icon size={15} strokeWidth={1.75} className="shrink-0" aria-hidden />
          </span>
        ),
      }))}
    />
  );
}
