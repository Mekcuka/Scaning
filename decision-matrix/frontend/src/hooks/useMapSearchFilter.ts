import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DrawMode, MapFeatureSelection } from '../components/MapView';
import { SUBTYPE_LABELS, type InfraLayer, type InfraObject, type POI } from '../lib/api';
import { buildMapSearchHits, filterInfraByMapQuery, type MapSearchHit } from '../lib/mapSearch';

export type UseMapSearchFilterParams = {
  projectId: string | undefined;
  mapInfraSource: InfraObject[];
  searchQ: string;
  pois: POI[];
  infraObjects: InfraObject[];
  layers: InfraLayer[];
  subtypeFilter: Record<string, boolean | undefined>;
  setSearchQ: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setDrawMode: (mode: DrawMode) => void;
  setPointMenuOpen: (open: boolean) => void;
  setLineMenuOpen: (open: boolean) => void;
  setSelectedPoiId: (id: string) => void;
  setFeatureSel: (sel: MapFeatureSelection | null) => void;
};

export function useMapSearchFilter({
  projectId,
  mapInfraSource,
  searchQ,
  pois,
  infraObjects,
  layers,
  subtypeFilter,
  setSearchQ,
  setSearchOpen,
  setDrawMode,
  setPointMenuOpen,
  setLineMenuOpen,
  setSelectedPoiId,
  setFeatureSel,
}: UseMapSearchFilterParams) {
  const queryClient = useQueryClient();

  const searchContext = useMemo(
    () => ({ layers, subtypeLabels: SUBTYPE_LABELS }),
    [layers],
  );

  const searchFilteredInfra = useMemo(
    () => filterInfraByMapQuery(mapInfraSource, searchQ, searchContext),
    [mapInfraSource, searchQ, searchContext],
  );

  const searchSuggestions = useMemo(
    () => buildMapSearchHits(pois, infraObjects, searchQ, searchContext, 10),
    [searchQ, pois, infraObjects, searchContext],
  );

  const pickSearchResult = useCallback(
    (hit: MapSearchHit) => {
      setSearchQ(hit.name);
      setSearchOpen(false);
      setDrawMode('select');
      setPointMenuOpen(false);
      setLineMenuOpen(false);
      if (hit.kind === 'poi') {
        setSelectedPoiId(hit.id);
        setFeatureSel({ kind: 'poi', id: hit.id });
      } else {
        setFeatureSel({ kind: 'infra', id: hit.id });
      }
    },
    [
      setSearchQ,
      setSearchOpen,
      setDrawMode,
      setPointMenuOpen,
      setLineMenuOpen,
      setSelectedPoiId,
      setFeatureSel,
    ],
  );

  const nextAutoName = useCallback(
    (subtype: string) => {
      const label = SUBTYPE_LABELS[subtype] || subtype;
      const base =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_([0-9]+)$`);
      let maxN = 0;
      for (const o of base || []) {
        if (o.subtype !== subtype) continue;
        const m = (o.name || '').match(re);
        if (m) maxN = Math.max(maxN, Number(m[1] || 0));
      }
      return `${label}_${maxN + 1}`;
    },
    [infraObjects, projectId, queryClient],
  );

  const mapLayerVisibleInfra = useMemo(() => {
    if (layers.length === 0) return searchFilteredInfra;
    const layerById = new Map(layers.map((l) => [l.id, l]));
    return searchFilteredInfra.filter((o) => {
      if (!o.layer_id) return true;
      const layer = layerById.get(o.layer_id);
      if (!layer) return true;
      return layer.is_visible;
    });
  }, [searchFilteredInfra, layers]);

  const filteredInfra = useMemo(
    () => mapLayerVisibleInfra.filter((o) => subtypeFilter[o.subtype] !== false),
    [mapLayerVisibleInfra, subtypeFilter],
  );

  return {
    searchSuggestions,
    pickSearchResult,
    nextAutoName,
    mapLayerVisibleInfra,
    filteredInfra,
  };
}
