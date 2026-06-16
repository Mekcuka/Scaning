import { Layers } from 'lucide-react';
import {
  DEFAULT_PAD_CLUSTERING_SCENE_LAYERS,
  type PadClusteringScene3DLayerKey,
  type PadClusteringScene3DLayers,
} from '../../lib/padClusteringScene3dLayers';

const LAYER_BUTTONS: {
  key: PadClusteringScene3DLayerKey;
  label: string;
  title: string;
}[] = [
  { key: 'ground', label: 'Рельеф', title: 'DEM или плоскость KB' },
  { key: 'pad', label: 'Площадка', title: 'Призма площадки' },
  { key: 'envelope', label: 'Обвал.', title: 'Обваловка' },
  { key: 'wellheads', label: 'Устья', title: 'Маркеры устьев' },
  { key: 'wellLabels', label: 'Подписи', title: 'Подписи скважин' },
  { key: 'trajectories', label: 'Траек.', title: 'Линии траекторий' },
  { key: 'clearancePairs', label: 'SF', title: 'Пары с нарушением SF (ближайший подход)' },
  { key: 'pywellgeoBranches', label: 'Ветви', title: 'Ветви PyWellGeo' },
  { key: 'bottomholes', label: 'Забои', title: 'Маркеры и подписи забоев' },
];

type PadClusteringScene3DLayerTogglesProps = {
  layers: PadClusteringScene3DLayers;
  onChange: (layers: PadClusteringScene3DLayers) => void;
  envelopeAvailable: boolean;
  trajectoriesAvailable: boolean;
  clearanceAvailable: boolean;
  pywellgeoAvailable: boolean;
  bottomholesAvailable: boolean;
};

export function PadClusteringScene3DLayerToggles({
  layers,
  onChange,
  envelopeAvailable,
  trajectoriesAvailable,
  clearanceAvailable,
  pywellgeoAvailable,
  bottomholesAvailable,
}: PadClusteringScene3DLayerTogglesProps) {
  const toggle = (key: PadClusteringScene3DLayerKey) => {
    onChange({ ...layers, [key]: !layers[key] });
  };

  return (
    <div
      className="pad-earthwork-sketch-toolbar pad-clustering-scene3d-layers"
      role="toolbar"
      aria-label="Слои 3D-сцены"
    >
      <span className="pad-clustering-scene3d-layers__title">
        <Layers size={14} aria-hidden />
        Слои
      </span>
      <div className="pad-earthwork-sketch-toolbar__group">
        {LAYER_BUTTONS.map(({ key, label, title }) => {
          if (key === 'envelope' && !envelopeAvailable) return null;
          if (key === 'trajectories' && !trajectoriesAvailable) return null;
          if (key === 'clearancePairs' && !clearanceAvailable) return null;
          if (key === 'pywellgeoBranches' && !pywellgeoAvailable) return null;
          if (key === 'bottomholes' && !bottomholesAvailable) return null;
          const active = layers[key];
          return (
            <button
              key={key}
              type="button"
              className={`pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--sm${
                active ? ' pad-earthwork-sketch-toolbar__btn--active' : ''
              }`}
              title={title}
              aria-pressed={active}
              onClick={() => toggle(key)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DEFAULT_PAD_CLUSTERING_SCENE_LAYERS };
