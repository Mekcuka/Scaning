import { MapPin } from 'lucide-react';
import type { POI } from '../lib/api';
import { AppSelect } from './AppSelect';

type Props = {
  pois: POI[];
  value: string;
  onChange: (poiId: string) => void;
};

export function MapPoiSelect({ pois, value, onChange }: Props) {
  if (pois.length === 0) return null;

  return (
    <AppSelect
      variant="toolbar"
      icon={<MapPin size={14} aria-hidden />}
      options={pois.map((p) => ({ value: p.id, label: p.name }))}
      value={value}
      onChange={onChange}
      ariaLabel="Точка интереса"
      title="Активная точка интереса"
    />
  );
}
