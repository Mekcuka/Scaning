import { useMemo } from 'react';
import type { MapGroupSelectionItem } from '../components/MapGroupSelectionPanel';
import type { SelectedFeature } from '../components/ObjectDetailPanel';
import type { MapFeatureSelection } from '../components/MapView';
import { SUBTYPE_LABELS, type InfraObject, type POI } from '../lib/api';

export type UseMapSelectionParams = {
  featureSel: MapFeatureSelection | null;
  featureGroupSel: MapFeatureSelection[];
  pois: POI[];
  infraObjects: InfraObject[];
};

export function useMapSelection({
  featureSel,
  featureGroupSel,
  pois,
  infraObjects,
}: UseMapSelectionParams) {
  const groupSelectionDetails = useMemo((): MapGroupSelectionItem[] => {
    const out: MapGroupSelectionItem[] = [];
    for (const sel of featureGroupSel) {
      if (sel.kind === 'poi') {
        const poi = pois.find((p) => p.id === sel.id);
        if (poi) {
          out.push({
            id: sel.id,
            name: poi.name,
            kind: 'poi',
            subtitle: 'Точка интереса',
          });
        }
        continue;
      }
      const obj = infraObjects.find((o) => o.id === sel.id);
      if (obj) {
        out.push({
          id: sel.id,
          name: obj.name,
          kind: 'infra',
          subtype: obj.subtype,
          subtitle: SUBTYPE_LABELS[obj.subtype] || obj.subtype,
        });
      }
    }
    return out;
  }, [featureGroupSel, pois, infraObjects]);

  const detailSelection: SelectedFeature | null = useMemo(() => {
    if (!featureSel) return null;
    if (featureSel.kind === 'poi') {
      const poi = pois.find((p) => p.id === featureSel.id);
      return poi ? { kind: 'poi', poi } : null;
    }
    const obj = infraObjects.find((o) => o.id === featureSel.id);
    return obj ? { kind: 'infra', object: obj } : null;
  }, [featureSel, pois, infraObjects]);

  return { groupSelectionDetails, detailSelection };
}
