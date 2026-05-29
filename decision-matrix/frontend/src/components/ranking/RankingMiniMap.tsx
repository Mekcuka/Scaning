import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapView, type MapFocusTarget } from '../MapView';
import {
  alignAnalysisRowsToMapObjects,
  buildMapFocusForConnectionLines,
  connectionLinesFromAnalysis,
} from '../../lib/analysisDisplay';
import { loadMapViewState } from '../../lib/mapViewState';
import { api, normalizePoiAnalysisResponse, type InfraLayer, type InfraObject, type POI } from '../../lib/api';
import { rankColor } from '../../lib/rankingUtils';
import type { RankingAlternative } from '../../lib/api';

type Props = {
  projectId: string;
  poi: POI;
  pois: POI[];
  alternatives: RankingAlternative[];
  selectedScenarioId: string | null;
  onSelectScenario: (id: string) => void;
};

export function RankingMiniMap({
  projectId,
  poi,
  pois,
  alternatives,
  selectedScenarioId,
  onSelectScenario,
}: Props) {
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null);

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId),
  });

  const { data: layers = [] } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => api.getLayers(projectId),
  });

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', projectId, poi.id],
    queryFn: async () => normalizePoiAnalysisResponse(await api.getPoiAnalysis(projectId, poi.id)),
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

  const connectionLinesKey = useMemo(
    () =>
      connectionLines
        .map((r) => `${r.subtype}:${r.nearest_object_id ?? ''}:${r.anchor_lon ?? ''},${r.anchor_lat ?? ''}`)
        .join(';'),
    [connectionLines]
  );

  const mapFocusInputRef = useRef({ connectionLines, mapLayerVisibleInfra });
  mapFocusInputRef.current = { connectionLines, mapLayerVisibleInfra };

  useEffect(() => {
    if (!poi || !projectId) return;
    if (loadMapViewState('ranking', projectId, poi.id)) {
      return;
    }
    const { connectionLines: lines, mapLayerVisibleInfra: visibleInfra } = mapFocusInputRef.current;
    const focus = buildMapFocusForConnectionLines(
      { lon: poi.lon, lat: poi.lat },
      lines,
      visibleInfra
    );
    const focusKey = `${poi.id}:${connectionLinesKey}:${focus.lon},${focus.lat}`;
    setMapFocus((prev) => {
      if (prev?.focusKey === focusKey) return prev;
      return { ...focus, nonce: Date.now(), focusKey };
    });
  }, [poi, projectId, connectionLinesKey]);

  const sorted = [...alternatives].sort((a, b) => a.rank - b.rank);

  return (
    <div className="ranking-map-panel">
      <ul className="ranking-map-legend">
        {sorted.map((alt) => {
          const sid = String(alt.scenario_id ?? '');
          const active = selectedScenarioId === sid;
          return (
            <li key={sid}>
              <button
                type="button"
                className={`ranking-map-legend__item${active ? ' ranking-map-legend__item--active' : ''}`}
                onClick={() => onSelectScenario(sid)}
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
          viewStateScope={poi.id}
          pois={pois}
          infraObjects={infraObjects}
          selectedPoi={poi}
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
