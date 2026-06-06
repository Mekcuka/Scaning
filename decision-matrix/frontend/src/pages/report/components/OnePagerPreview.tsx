import { forwardRef, lazy, Suspense, useState } from 'react';
import { MapView, type MapFocusTarget } from '../../../components/MapView';
import type { AnalysisRow, InfraLayer, InfraObject, POI } from '../../../lib/api';
import { isMap3dEnabled } from '../../../lib/map3d/map3dConfig';
import { OnePagerEngBadges } from './OnePagerEngBadges';
import { OnePagerRecommendation } from './OnePagerRecommendation';
import { OnePagerRoadmap } from './OnePagerRoadmap';
import { OnePagerSubtypeTable } from './OnePagerSubtypeTable';
import type { OnePagerRoadmapStage } from '../../../lib/api';
import { APP_NAME } from '../../../lib/branding';

const MapView3D = lazy(() => import('../../../components/MapView3D'));

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
  const map3dOn = isMap3dEnabled();
  const [reportMapMode, setReportMapMode] = useState<'2d' | '3d'>(map3dOn ? '3d' : '2d');
  const use3d = map3dOn && reportMapMode === '3d';

  const dateStr =
    data.reportDate ??
    new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="one-pager-wrap" ref={ref}>
      <div className="one-pager" id="report-content">
        <div className="one-pager-watermark">{APP_NAME}</div>
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
          {map3dOn && (
            <div className="flex gap-1 mb-1 justify-end">
              <button
                type="button"
                className={`btn btn-xs ${reportMapMode === '2d' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReportMapMode('2d')}
              >
                2D
              </button>
              <button
                type="button"
                className={`btn btn-xs ${reportMapMode === '3d' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReportMapMode('3d')}
              >
                3D
              </button>
            </div>
          )}
          {use3d ? (
            <Suspense fallback={<div style={{ height: 220 }}>Загрузка 3D…</div>}>
              <MapView3D
                pois={pois}
                infraObjects={infraObjects}
                selectedPoi={selectedPoi}
                connectionLines={connectionLines}
                mapFocus={mapFocus}
                layers={layers}
                showRadii={false}
                persistViewState={false}
                height="220px"
              />
            </Suspense>
          ) : (
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
          )}
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
