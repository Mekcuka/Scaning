import {
  polygonBoundingBox,
  polygonPerimeterM,
  sketchToApiPayload,
} from '../../lib/padEarthworkSketch';
import type { PadEarthworkSketchPlanTabProps } from './padEarthworkSketchPlanTabTypes';
import { DimensionStepper } from './DimensionStepper';
import { ReferenceElevationDemMinButton } from './ReferenceElevationDemMinButton';
import { PlanGeneratorPanel } from './PlanGeneratorPanel';
import { EnvelopeSection } from './EnvelopeSection';
import { EnvelopePlanLegend } from './EnvelopePlanLegend';
import { DemPlanLegend } from './DemPlanLegend';

export type PadEarthworkSketchPlanSidebarProps = Pick<
  PadEarthworkSketchPlanTabProps,
  | 'projectId'
  | 'objectId'
  | 'showGenerator'
  | 'readOnly'
  | 'shapeMode'
  | 'polygonClosed'
  | 'sketch'
  | 'wellsLocal'
  | 'rectangleSketch'
  | 'polygonSketch'
  | 'updateSketch'
  | 'snapEnabled'
  | 'setPadWellCount'
  | 'setPadWellsPerGroup'
  | 'setPadWellSpacingM'
  | 'setPadGroupSpacingM'
  | 'setPadMarginLeftM'
  | 'setPadMarginBottomM'
  | 'setPadMarginTopM'
  | 'setPadMarginEndM'
  | 'setRotationDeg'
  | 'generatorFields'
  | 'patchGeneratorField'
  | 'generateMutation'
  | 'areaTop'
  | 'envelopeActive'
  | 'bermPerimeterM'
  | 'estimatedFill'
  | 'canCompute'
  | 'envelopeEnabled'
  | 'setEnvelopeEnabled'
  | 'wrapWidthM'
  | 'setWrapWidthM'
  | 'localHeight'
  | 'setLocalHeight'
  | 'localRef'
  | 'setLocalRef'
  | 'heightRefForPreview'
  | 'debouncedPreviewKey'
  | 'previewRequestKey'
  | 'demAvailable'
  | 'showDemOverlay'
  | 'demPreviewData'
  | 'setResult'
  | 'setError'
  | 'result'
  | 'error'
  | 'saveMessage'
>;

export function PadEarthworkSketchPlanSidebar(props: PadEarthworkSketchPlanSidebarProps) {
  const {
    projectId,
    objectId,
    showGenerator,
    readOnly,
    shapeMode,
    polygonClosed,
    sketch,
    wellsLocal,
    rectangleSketch,
    polygonSketch,
    updateSketch,
    snapEnabled,
    setPadWellCount,
    setPadWellsPerGroup,
    setPadWellSpacingM,
    setPadGroupSpacingM,
    setPadMarginLeftM,
    setPadMarginBottomM,
    setPadMarginTopM,
    setPadMarginEndM,
    setRotationDeg,
    generatorFields,
    patchGeneratorField,
    generateMutation,
    areaTop,
    envelopeActive,
    bermPerimeterM,
    estimatedFill,
    canCompute,
    envelopeEnabled,
    setEnvelopeEnabled,
    wrapWidthM,
    setWrapWidthM,
    localHeight,
    setLocalHeight,
    localRef,
    setLocalRef,
    heightRefForPreview,
    debouncedPreviewKey,
    previewRequestKey,
    demAvailable,
    showDemOverlay,
    demPreviewData,
    setResult,
    setError,
    result,
    error,
    saveMessage,
  } = props;

  const hasGeneratorFormCallbacks =
    showGenerator &&
    shapeMode === 'generator' &&
    setPadWellCount &&
    setPadWellsPerGroup &&
    setPadWellSpacingM &&
    setPadGroupSpacingM &&
    setPadMarginLeftM &&
    setPadMarginBottomM &&
    setPadMarginTopM &&
    setPadMarginEndM &&
    setRotationDeg;

  return (
    <aside className="pad-earthwork-sketch-modal__sidebar">
      {hasGeneratorFormCallbacks && (
        <PlanGeneratorPanel
          readOnly={readOnly}
          padWellCount={generatorFields.padWellCount}
          setPadWellCount={(value) => patchGeneratorField('padWellCount', value)}
          padWellsPerGroup={generatorFields.padWellsPerGroup}
          setPadWellsPerGroup={(value) => patchGeneratorField('padWellsPerGroup', value)}
          padWellSpacingM={generatorFields.padWellSpacingM}
          setPadWellSpacingM={(value) => patchGeneratorField('padWellSpacingM', value)}
          padGroupSpacingM={generatorFields.padGroupSpacingM}
          setPadGroupSpacingM={(value) => patchGeneratorField('padGroupSpacingM', value)}
          padMarginLeftM={generatorFields.padMarginLeftM}
          setPadMarginLeftM={(value) => patchGeneratorField('padMarginLeftM', value)}
          padMarginBottomM={generatorFields.padMarginBottomM}
          setPadMarginBottomM={(value) => patchGeneratorField('padMarginBottomM', value)}
          padMarginTopM={generatorFields.padMarginTopM}
          setPadMarginTopM={(value) => patchGeneratorField('padMarginTopM', value)}
          padMarginEndM={generatorFields.padMarginEndM}
          setPadMarginEndM={(value) => patchGeneratorField('padMarginEndM', value)}
          rotationDeg={generatorFields.rotationDeg}
          setRotationDeg={(value) => patchGeneratorField('rotationDeg', value)}
          generating={generateMutation.isPending}
          onGenerate={() => generateMutation.mutate()}
          hasPreview={polygonClosed}
          wellCountOnCanvas={wellsLocal.length}
        />
      )}

      <div className="pad-earthwork-sketch-modal__stats">
        <div className="pad-earthwork-sketch-modal__stat-card">
          <span className="pad-earthwork-sketch-modal__stat-label">
            {envelopeActive ? 'Площадь площадки' : 'Площадь'}
          </span>
          <strong>{areaTop.toLocaleString('ru-RU')} м²</strong>
        </div>
        {envelopeActive && bermPerimeterM != null && (
          <div className="pad-earthwork-sketch-modal__stat-card">
            <span className="pad-earthwork-sketch-modal__stat-label">Периметр обваловки</span>
            <strong>
              {bermPerimeterM.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м
            </strong>
          </div>
        )}
        {envelopeActive && (
          <p className="object-detail-panel__hint text-xs pad-earthwork-sketch-modal__stats-hint">
            Кольцо на верху насыпи: подошва W, бровка на H = (W−TW)/2, TW = W/3.
          </p>
        )}
        {estimatedFill != null && canCompute && (
          <div className="pad-earthwork-sketch-modal__stat-card pad-earthwork-sketch-modal__stat-card--accent">
            <span className="pad-earthwork-sketch-modal__stat-label">
              {envelopeActive ? 'Оценка отсыпки (обваловка)' : 'Оценка отсыпки'}
            </span>
            <strong>{estimatedFill.toLocaleString('ru-RU')} м³</strong>
          </div>
        )}
      </div>

      {showDemOverlay && demPreviewData && (
        <div className="pad-earthwork-sketch-modal__section">
          <h3 className="pad-earthwork-sketch-modal__section-title">Рельеф DEM</h3>
          <DemPlanLegend preview={demPreviewData} />
        </div>
      )}

      {shapeMode === 'rectangle' ? (
        <div className="pad-earthwork-sketch-modal__section">
          <h3 className="pad-earthwork-sketch-modal__section-title">Габариты</h3>
          <DimensionStepper
            label="Длина"
            value={rectangleSketch.length_m}
            step={snapEnabled ? 1 : 0.5}
            readOnly={readOnly}
            onChange={(n) => updateSketch({ ...rectangleSketch, length_m: n })}
          />
          <DimensionStepper
            label="Ширина"
            value={rectangleSketch.width_m}
            step={snapEnabled ? 1 : 0.5}
            readOnly={readOnly}
            onChange={(n) => updateSketch({ ...rectangleSketch, width_m: n })}
          />
          <DimensionStepper
            label="Поворот"
            value={rectangleSketch.rotation_deg}
            unit="°"
            step={snapEnabled ? 5 : 1}
            min={-180}
            max={180}
            decimals={0}
            readOnly={readOnly}
            onChange={(n) => updateSketch({ ...rectangleSketch, rotation_deg: n })}
          />
        </div>
      ) : shapeMode === 'polygon' ? (
        <div className="pad-earthwork-sketch-modal__section">
          <h3 className="pad-earthwork-sketch-modal__section-title">Контур</h3>
          <p className="object-detail-panel__hint text-xs">
            Вершин: <strong>{polygonSketch.vertices.length}</strong>
            {polygonClosed && (
              <>
                {' '}
                · периметр{' '}
                <strong>
                  {polygonPerimeterM(polygonSketch.vertices).toLocaleString('ru-RU', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  м
                </strong>
              </>
            )}
          </p>
          {polygonClosed && (
            <>
              <DimensionStepper
                label="Охват L (bbox)"
                value={polygonBoundingBox(polygonSketch.vertices).length_m}
                step={0.5}
                readOnly
                onChange={() => {}}
              />
              <DimensionStepper
                label="Охват W (bbox)"
                value={polygonBoundingBox(polygonSketch.vertices).width_m}
                step={0.5}
                readOnly
                onChange={() => {}}
              />
            </>
          )}
        </div>
      ) : null}

      <EnvelopeSection
        envelopeEnabled={envelopeEnabled}
        onEnvelopeEnabledChange={setEnvelopeEnabled}
        wrapWidthM={wrapWidthM}
        onWrapWidthMChange={setWrapWidthM}
        readOnly={readOnly}
        disabled={!canCompute}
        snapEnabled={snapEnabled}
      />

      {envelopeActive && <EnvelopePlanLegend />}

      <div className="pad-earthwork-sketch-modal__section">
        <h3 className="pad-earthwork-sketch-modal__section-title">Высота и отметка</h3>
        <DimensionStepper
          label="Высота насыпи"
          value={Number(localHeight) || 0}
          step={0.1}
          min={0.1}
          max={20}
          readOnly={readOnly}
          onChange={(n) => setLocalHeight(n.toFixed(2))}
        />
        <DimensionStepper
          label="Опорная отметка"
          value={Number(localRef) || 0}
          step={0.1}
          min={-500}
          max={5000}
          readOnly={readOnly}
          onChange={(n) => {
            setLocalRef(n.toFixed(2));
            setResult(null);
          }}
          trailingAction={
            <ReferenceElevationDemMinButton
              projectId={projectId}
              objectId={objectId}
              sketch={sketchToApiPayload(sketch)}
              params={heightRefForPreview}
              demAvailable={demAvailable}
              readOnly={readOnly}
              preview={
                demPreviewData && debouncedPreviewKey === previewRequestKey ? demPreviewData : null
              }
              onApply={(n) => {
                setLocalRef(n.toFixed(2));
                setResult(null);
              }}
              onError={(msg) => setError(msg)}
            />
          }
        />
      </div>

      {result && (
        <div className="pad-earthwork-sketch-modal__section pad-earthwork-sketch-modal__result">
          <h3 className="pad-earthwork-sketch-modal__section-title">Результат расчёта</h3>
          <p>
            Отсыпка: <strong>{result.volumes.fill_m3.toLocaleString('ru-RU')}</strong> м³
          </p>
          <p>
            Выемка: <strong>{result.volumes.cut_m3.toLocaleString('ru-RU')}</strong> м³
          </p>
          <p className="object-detail-panel__hint text-xs">
            Отсыпка и выемка считаются независимо: изъятый грунт не идёт в насыпь.
          </p>
          <p className="object-detail-panel__hint text-xs">
            Верх площадки: {result.design.top_elevation_m} м
            {demAvailable ? ' · по DEM' : ' · плоская опорная'}
          </p>
          {result.warnings?.includes('envelope_volume_is_truncated_pyramid_approximation') && (
            <p className="object-detail-panel__hint text-xs">
              Серверный объём — упрощённая усечённая пирамида (legacy planner). Оценка обваловки в
              sidebar — кольцо по периметру (вариант A).
            </p>
          )}
          {result.warnings?.includes('polygon_mesh_is_bbox_approximation') && (
            <p className="object-detail-panel__hint text-xs">
              3D-модель — упрощённый bounding box; объём по площади контура.
            </p>
          )}
        </div>
      )}
      {error && <p className="object-detail-panel__hint text-red-600 text-xs">{error}</p>}
      {saveMessage && <p className="object-detail-panel__hint text-xs">{saveMessage}</p>}
    </aside>
  );
}
