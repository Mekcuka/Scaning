import { forwardRef } from 'react';
import { MapView, type MapFocusTarget } from '../../../components/MapView';
import type { AnalysisRow, InfraLayer, InfraObject, POI } from '../../../lib/api';
import { OnePagerEngBadges } from './OnePagerEngBadges';
import { OnePagerRecommendation } from './OnePagerRecommendation';
import { OnePagerRoadmap } from './OnePagerRoadmap';
import { OnePagerSubtypeTable } from './OnePagerSubtypeTable';
import type { OnePagerRoadmapStage } from '../../../lib/api';

export type OnePagerPreviewData = {
  title: string;
  coordinates?: string | null;
  engineerName?: string | null;
  reportDate?: string | null;
  poiName?: string;
  totalCostMln?: number | null;
  equipmentCostMln?: number | null;
  analysisRows: AnalysisRow[];
  poi: POI | null;
  roadmap: OnePagerRoadmapStage[];
  recommendationText: string;
};

type Props = {
  data: OnePagerPreviewData;
  pois: POI[];
  infraObjects: InfraObject[];
  layers: InfraLayer[];
  connectionLines: AnalysisRow[];
  mapFocus: MapFocusTarget | null;
  selectedPoi: POI | null;
  readOnly?: boolean;
  onRoadmapChange?: (roadmap: OnePagerRoadmapStage[]) => void;
  onRecommendationChange?: (text: string) => void;
};

export const OnePagerPreview = forwardRef<HTMLDivElement, Props>(function OnePagerPreview(
  {
    data,
    pois,
    infraObjects,
    layers,
    connectionLines,
    mapFocus,
    selectedPoi,
    readOnly = true,
    onRoadmapChange,
    onRecommendationChange,
  },
  ref
) {
  const dateStr =
    data.reportDate ??
    new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="one-pager-wrap" ref={ref}>
      <div className="one-pager" id="report-content">
        <div className="one-pager-watermark">СППР</div>
        <header className="one-pager-header">
          <div>
            <h2 className="one-pager-header__title">{data.title}</h2>
            <p className="one-pager-header__meta">
              {data.coordinates && <span>📍 {data.coordinates}</span>}
              {data.engineerName && <span> · {data.engineerName}</span>}
            </p>
          </div>
          <div className="one-pager-header__date">
            <div className="one-pager-header__date-label">Дата отчёта</div>
            <strong>{dateStr}</strong>
          </div>
        </header>

        <div className="one-pager-map" data-map-capture-root>
          <MapView
            pois={pois}
            infraObjects={infraObjects}
            selectedPoi={selectedPoi}
            connectionLines={connectionLines}
            mapFocus={mapFocus}
            height="220px"
            useMapIcons
            layers={layers}
            showRadii={false}
            persistViewState={false}
          />
        </div>

        <OnePagerSubtypeTable rows={data.analysisRows} poiName={data.poiName} />

        <p className="one-pager-total">
          ИТОГО:{' '}
          <strong>{data.totalCostMln != null ? `${data.totalCostMln} млн ₽` : '—'}</strong>
        </p>

        <OnePagerEngBadges poi={data.poi} equipmentCostMln={data.equipmentCostMln} />

        <OnePagerRoadmap
          roadmap={data.roadmap}
          readOnly={readOnly}
          onChange={onRoadmapChange}
        />

        <OnePagerRecommendation
          value={data.recommendationText}
          readOnly={readOnly}
          onChange={onRecommendationChange}
        />
      </div>
    </div>
  );
});
