import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapView, type MapFocusTarget } from '../MapView';
import {
  alignAnalysisRowsToMapObjects,
  buildMapFocusForConnectionLines,
  connectionLinesFromAnalysis,
} from '../../lib/analysisDisplay';
import { api, normalizePoiAnalysisResponse, type InfraLayer, type InfraObject, type POI } from '../../lib/api';
import { rankColor, rankingAlternativeId } from '../../lib/rankingUtils';
import type { RankingAlternative } from '../../lib/api';

type Props = {
  projectId: string;
  pois: POI[];
  alternatives: RankingAlternative[];
  selectedPoiId: string | null;
  onSelectPoi: (poiId: string) => void;
};

function focusAllPois(pois: POI[]): MapFocusTarget | null {
  if (pois.length === 0) return null;
  const lons = pois.map((p) => p.lon);
  const lats = pois.map((p) => p.lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  if (pois.length === 1) {
    return {
      lon: pois[0]!.lon,
      lat: pois[0]!.lat,
      nonce: Date.now(),
      focusKey: `poi:${pois[0]!.id}`,
    };
  }
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  return {
    lon: centerLon,
    lat: centerLat,
    extentLonLat: [minLon, minLat, maxLon, maxLat],
    nonce: Date.now(),
    focusKey: `pois:${pois.map((p) => p.id).join(',')}`,
  };
}

export function RankingPoiCompareMap({
  projectId,
  pois,
  alternatives,
  selectedPoiId,
  onSelectPoi,
}: Props) {
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null);
  const activePoi = pois.find((p) => p.id === selectedPoiId) ?? pois[0] ?? null;

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId),
  });

  const { data: layers = [] } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => api.getLayers(projectId),
  });

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', projectId, activePoi?.id],
    queryFn: async () =>
      normalizePoiAnalysisResponse(await api.getPoiAnalysis(projectId, activePoi!.id)),
    enabled: !!activePoi,
    retry: false,
  });

  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l: InfraLayer) => l.is_visible).map((l) => l.id)),
    [layers]
  );

  const mapLayerVisibleInfra = useMemo(
    () => infraObjects.filter((o: InfraObject) => visibleLayerIds.has(o.layer_id)),
    [infraObjects, visibleLayerIds]
  );

  const alignedAnalysisRows = useMemo(
    () => alignAnalysisRowsToMapObjects(analysisData?.rows ?? [], mapLayerVisibleInfra),
    [analysisData?.rows, mapLayerVisibleInfra]
  );

  const connectionLines = useMemo(
    () => connectionLinesFromAnalysis(alignedAnalysisRows, mapLayerVisibleInfra),
    [alignedAnalysisRows, mapLayerVisibleInfra]
  );

  useEffect(() => {
    const rankedPoiIds = new Set(
      alternatives.map((a) => String(a.poi_id ?? '')).filter(Boolean)
    );
    const rankedPois = pois.filter((p) => rankedPoiIds.has(p.id));
    const focus = focusAllPois(rankedPois.length ? rankedPois : pois);
    if (focus) setMapFocus(focus);
  }, [alternatives, pois, projectId]);

  useEffect(() => {
    if (!activePoi || connectionLines.length === 0) return;
    const focus = buildMapFocusForConnectionLines(
      { lon: activePoi.lon, lat: activePoi.lat },
      connectionLines,
      mapLayerVisibleInfra
    );
    setMapFocus({
      ...focus,
      nonce: Date.now(),
      focusKey: `poi-lines:${activePoi.id}`,
    });
  }, [activePoi?.id, connectionLines, mapLayerVisibleInfra]);

  const sorted = [...alternatives].sort((a, b) => a.rank - b.rank);

  return (
    <div className="ranking-map-panel">
      <ul className="ranking-map-legend">
        {sorted.map((alt) => {
          const poiId = String(alt.poi_id ?? rankingAlternativeId(alt));
          const active = selectedPoiId === poiId;
          return (
            <li key={poiId}>
              <button
                type="button"
                className={`ranking-map-legend__item${active ? ' ranking-map-legend__item--active' : ''}`}
                onClick={() => onSelectPoi(poiId)}
              >
                <span className="ranking-map-legend__dot" style={{ background: rankColor(alt.rank) }} />
                <span className="ranking-map-legend__rank">#{alt.rank}</span>
                <span className="ranking-map-legend__name">{alt.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="ranking-map-preview">
        <MapView
          viewStateId="ranking"
          viewStateScope={`pois-${projectId}`}
          pois={pois}
          infraObjects={infraObjects}
          selectedPoi={activePoi}
          connectionLines={connectionLines}
          mapFocus={mapFocus}
          height="280px"
          useMapIcons
          layers={layers}
          editMode={false}
        />
      </div>
    </div>
  );
}
