import type { RefObject } from 'react';
import type { PadDemPreview } from '../../lib/api/padEarthworkApi';
import type { PadEarthworkComputeResult } from '../../lib/api/padEarthworkApi';
import type { PlanShapeSketch } from '../../lib/padEarthworkSketch';
import { formatElevationM } from '../../lib/padEarthworkDemPreview';
import { EnvelopeSection } from './EnvelopeSection';
import { PadEarthworkScene3D, type PadEarthworkScene3DHandle } from './PadEarthworkScene3D';
import { PadScene3DToolbar } from './PadScene3DToolbar';
import { Scene3DLegend } from './Scene3DLegend';

export type PadEarthworkSketchScene3dTabProps = {
  scene3dRef: RefObject<PadEarthworkScene3DHandle | null>;
  scene3dZoomPercent: number;
  onScene3dZoomPercentChange: (value: number) => void;
  sketch: PlanShapeSketch;
  heightRefForPreview: { height_m: number; reference_elevation_m: number } | null;
  demPreviewData: PadDemPreview | null | undefined;
  demAvailable: boolean;
  demPreviewLoading: boolean;
  envelopeEnabled: boolean;
  wrapWidthM: number;
  onEnvelopeEnabledChange: (value: boolean) => void;
  onWrapWidthMChange: (value: number) => void;
  readOnly: boolean;
  canCompute: boolean;
  snapEnabled: boolean;
  envelopeActive: boolean;
  result: PadEarthworkComputeResult | null;
  estimatedFill: number | null;
  sketchDirty: boolean;
};

export function PadEarthworkSketchScene3dTab({
  scene3dRef,
  scene3dZoomPercent,
  onScene3dZoomPercentChange,
  sketch,
  heightRefForPreview,
  demPreviewData,
  demAvailable,
  demPreviewLoading,
  envelopeEnabled,
  wrapWidthM,
  onEnvelopeEnabledChange,
  onWrapWidthMChange,
  readOnly,
  canCompute,
  snapEnabled,
  envelopeActive,
  result,
  estimatedFill,
  sketchDirty,
}: PadEarthworkSketchScene3dTabProps) {
  return (
    <>
      <PadScene3DToolbar
        zoomPercent={scene3dZoomPercent}
        onZoomIn={() => scene3dRef.current?.zoomIn()}
        onZoomOut={() => scene3dRef.current?.zoomOut()}
        onFitView={() => scene3dRef.current?.fitView()}
        onCameraPreset={(preset) => scene3dRef.current?.setCameraPreset(preset)}
        onOrbitLeft={() => scene3dRef.current?.orbitLeft()}
        onOrbitRight={() => scene3dRef.current?.orbitRight()}
        onTiltUp={() => scene3dRef.current?.tiltUp()}
        onTiltDown={() => scene3dRef.current?.tiltDown()}
      />
      <div className="pad-earthwork-sketch-modal__layout pad-earthwork-sketch-modal__layout--scene3d">
        <PadEarthworkScene3D
          ref={scene3dRef}
          sketch={sketch}
          referenceElevationM={heightRefForPreview?.reference_elevation_m ?? 0}
          heightM={heightRefForPreview?.height_m ?? 0}
          demPreview={demPreviewData ?? null}
          envelopeEnabled={envelopeEnabled}
          wrapWidthM={wrapWidthM}
          demAvailable={demAvailable}
          demLoading={demPreviewLoading}
          onCameraStateChange={({ zoomPercent }) => onScene3dZoomPercentChange(zoomPercent)}
        />
        <aside className="pad-earthwork-sketch-modal__sidebar">
          <div className="pad-earthwork-sketch-modal__section">
            <h3 className="pad-earthwork-sketch-modal__section-title">Рельеф</h3>
            <p className="object-detail-panel__hint text-xs">
              {demAvailable
                ? demPreviewData
                  ? `DEM preview ${demPreviewData.cols}×${demPreviewData.rows}, шаг ${demPreviewData.cell_size_m.toFixed(1)} м`
                  : demPreviewLoading
                    ? 'Загрузка сетки рельефа…'
                    : 'Укажите высоту и опорную отметку для preview'
                : 'DEM не загружен — на вкладке «План» нажмите «Загрузить DEM»'}
            </p>
            {demPreviewData && (
              <p className="object-detail-panel__hint text-xs">
                Рельеф: {formatElevationM(demPreviewData.elev_min)} …{' '}
                {formatElevationM(demPreviewData.elev_max)}
              </p>
            )}
          </div>
          <div className="pad-earthwork-sketch-modal__section">
            <h3 className="pad-earthwork-sketch-modal__section-title">Отметки</h3>
            <p className="object-detail-panel__hint text-xs">
              Опорная:{' '}
              <strong>
                {heightRefForPreview
                  ? formatElevationM(heightRefForPreview.reference_elevation_m)
                  : '—'}
              </strong>
            </p>
            <p className="object-detail-panel__hint text-xs">
              Верх площадки:{' '}
              <strong>
                {heightRefForPreview
                  ? formatElevationM(
                      heightRefForPreview.reference_elevation_m + heightRefForPreview.height_m,
                    )
                  : '—'}
              </strong>
            </p>
          </div>
          <EnvelopeSection
            envelopeEnabled={envelopeEnabled}
            onEnvelopeEnabledChange={onEnvelopeEnabledChange}
            wrapWidthM={wrapWidthM}
            onWrapWidthMChange={onWrapWidthMChange}
            readOnly={readOnly}
            disabled={!canCompute}
            snapEnabled={snapEnabled}
          />
          <Scene3DLegend demActive={Boolean(demPreviewData)} envelopeActive={envelopeActive} />
          {result && (
            <div className="pad-earthwork-sketch-modal__section">
              <h3 className="pad-earthwork-sketch-modal__section-title">Объёмы</h3>
              <p className="object-detail-panel__hint text-xs">
                Насыпь: <strong>{result.volumes.fill_m3.toFixed(1)} м³</strong>
              </p>
              <p className="object-detail-panel__hint text-xs">
                Выемка: <strong>{result.volumes.cut_m3.toFixed(1)} м³</strong>
              </p>
            </div>
          )}
          {estimatedFill != null && !result && (
            <div className="pad-earthwork-sketch-modal__section">
              <h3 className="pad-earthwork-sketch-modal__section-title">Оценка</h3>
              <p className="object-detail-panel__hint text-xs">
                Насыпь ≈ <strong>{estimatedFill.toFixed(1)} м³</strong>
              </p>
            </div>
          )}
          {sketchDirty && !readOnly && (
            <p className="object-detail-panel__hint text-xs pad-earthwork-sketch-modal__unsaved-hint">
              Есть несохранённые изменения плана
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
