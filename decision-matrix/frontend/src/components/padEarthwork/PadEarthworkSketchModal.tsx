import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Shapes, Square } from 'lucide-react';
import { AppModal } from '../AppModal';
import {
  padEarthworkApi,
  type PadEarthworkComputeResult,
} from '../../lib/api/padEarthworkApi';
import {
  createDefaultPlanSketch,
  createDefaultPolygonSketch,
  createEmptyPolygonSketch,
  DEFAULT_ENVELOPE_WRAP_WIDTH_M,
  estimateEnvelopeFillM3,
  estimateFillM3,
  envelopeOuterVertices,
  isPlanPolygon,
  isPlanRectangle,
  isPolygonSketchClosed,
  PAD_SIZE_PRESETS,
  planFromFormFields,
  parseSketchFromLast,
  polygonAreaM2,
  polygonBoundingBox,
  polygonPerimeterM,
  polygonToRectangle,
  rectangleToPolygon,
  shapeModeFromSketch,
  sketchFootprintAreaM2,
  sketchToApiPayload,
  type PlanEditTool,
  type PlanPolygonSketch,
  type PlanRectangleSketch,
  type PlanShapeSketch,
  type PolygonEditTool,
  type ShapeMode,
} from '../../lib/padEarthworkSketch';
import { DimensionStepper } from './DimensionStepper';
import { PlanPolygonEditor } from './PlanPolygonEditor';
import { PlanRectangleEditor } from './PlanRectangleEditor';
import { PlanSketchToolbar } from './PlanSketchToolbar';
import { PolygonSketchToolbar } from './PolygonSketchToolbar';

export interface PadEarthworkSketchModalProps {
  projectId: string;
  objectId: string;
  readOnly: boolean;
  lengthM: string;
  widthM: string;
  heightM: string;
  rotationDeg: string;
  referenceElevationM: string;
  initialSketch?: PlanShapeSketch | null;
  initialEnvelope?: { enabled: boolean; wrap_width_m: number } | null;
  onClose: () => void;
  onApplyToFields: (fields: {
    lengthM: string;
    widthM: string;
    rotationDeg: string;
    heightM: string;
    referenceElevationM: string;
  }) => void;
  onComputeSuccess: (result: PadEarthworkComputeResult) => void;
  onSaveSuccess?: () => void;
  onApplySandDemand: (fillM3: number) => void;
}

type TabId = 'plan' | 'profile';

function parseHeightRef(heightM: string, referenceElevationM: string) {
  const h = heightM.trim().replace(',', '.');
  const ref = referenceElevationM.trim().replace(',', '.');
  const height = h ? Number(h) : NaN;
  const reference = ref === '' ? 0 : Number(ref);
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(reference)) return null;
  return { height_m: height, reference_elevation_m: reference };
}

function initialSketchState(
  initialSketch: PlanShapeSketch | null | undefined,
  lengthM: string,
  widthM: string,
  rotationDeg: string,
): PlanShapeSketch {
  if (initialSketch) return initialSketch;
  return planFromFormFields(lengthM, widthM, rotationDeg) ?? createDefaultPlanSketch();
}

export function PadEarthworkSketchModal({
  projectId,
  objectId,
  readOnly,
  lengthM,
  widthM,
  heightM,
  rotationDeg,
  referenceElevationM,
  initialSketch,
  initialEnvelope,
  onClose,
  onApplyToFields,
  onComputeSuccess,
  onSaveSuccess,
  onApplySandDemand,
}: PadEarthworkSketchModalProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('plan');
  const [shapeMode, setShapeMode] = useState<ShapeMode>(() =>
    shapeModeFromSketch(initialSketchState(initialSketch, lengthM, widthM, rotationDeg)),
  );
  const [rectTool, setRectTool] = useState<PlanEditTool>('corners');
  const [polygonTool, setPolygonTool] = useState<PolygonEditTool>('vertices');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showEdgeLengths, setShowEdgeLengths] = useState(true);
  const [lockAspect, setLockAspect] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitViewNonce, setFitViewNonce] = useState(0);
  const [sketch, setSketch] = useState<PlanShapeSketch>(() =>
    initialSketchState(initialSketch, lengthM, widthM, rotationDeg),
  );
  const [localHeight, setLocalHeight] = useState(heightM);
  const [localRef, setLocalRef] = useState(referenceElevationM);
  const [result, setResult] = useState<PadEarthworkComputeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sketchDirty, setSketchDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [envelopeEnabled, setEnvelopeEnabled] = useState(() => initialEnvelope?.enabled ?? false);
  const [wrapWidthM, setWrapWidthM] = useState(
    () => initialEnvelope?.wrap_width_m ?? DEFAULT_ENVELOPE_WRAP_WIDTH_M,
  );

  const updateSketch = useCallback((next: PlanShapeSketch | ((prev: PlanShapeSketch) => PlanShapeSketch)) => {
    setSketchDirty(true);
    setSaveMessage(null);
    setSketch(next);
  }, []);

  const rectangleSketch: PlanRectangleSketch = useMemo(() => {
    if (isPlanRectangle(sketch)) return sketch;
    return polygonToRectangle(sketch);
  }, [sketch]);

  const polygonSketch: PlanPolygonSketch = useMemo(() => {
    if (isPlanPolygon(sketch)) return sketch;
    return rectangleToPolygon(sketch);
  }, [sketch]);

  useEffect(() => {
    const fromForm = planFromFormFields(lengthM, widthM, rotationDeg);
    if (fromForm && shapeMode === 'rectangle' && !sketchDirty) setSketch(fromForm);
    setLocalHeight(heightM);
    setLocalRef(referenceElevationM);
  }, [lengthM, widthM, heightM, rotationDeg, referenceElevationM, shapeMode, sketchDirty]);

  useEffect(() => {
    if (initialSketch) {
      setSketch(initialSketch);
      setShapeMode(shapeModeFromSketch(initialSketch));
      setSketchDirty(false);
    }
  }, [initialSketch]);

  useEffect(() => {
    if (initialEnvelope) {
      setEnvelopeEnabled(initialEnvelope.enabled);
      setWrapWidthM(initialEnvelope.wrap_width_m);
    }
  }, [initialEnvelope]);

  const syncCardFields = useCallback(() => {
    const bbox = isPlanPolygon(sketch) ? polygonBoundingBox(sketch.vertices) : null;
    onApplyToFields({
      lengthM: String(bbox?.length_m ?? rectangleSketch.length_m),
      widthM: String(bbox?.width_m ?? rectangleSketch.width_m),
      rotationDeg: isPlanRectangle(sketch) ? String(sketch.rotation_deg) : '0',
      heightM: localHeight,
      referenceElevationM: localRef,
    });
  }, [sketch, rectangleSketch, localHeight, localRef, onApplyToFields]);

  const computeMutation = useMutation({
    mutationFn: async () => {
      const heightRef = parseHeightRef(localHeight, localRef);
      if (!heightRef) throw new Error('Укажите высоту насыпи и опорную отметку');
      if (isPlanPolygon(sketch) && !isPolygonSketchClosed(sketch)) {
        throw new Error('Добавьте минимум 3 вершины для расчёта полигона');
      }
      return padEarthworkApi.compute(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params: heightRef,
        envelope: envelopeEnabled
          ? { enabled: true, wrap_width_m: wrapWidthM }
          : undefined,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      onComputeSuccess(data);
    },
    onError: (err: Error) => setError(err.message || 'Ошибка расчёта'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const heightRef = parseHeightRef(localHeight, localRef);
      if (!heightRef) throw new Error('Укажите высоту насыпи и опорную отметку');
      if (isPlanPolygon(sketch) && !isPolygonSketchClosed(sketch)) {
        throw new Error('Добавьте минимум 3 вершины для сохранения полигона');
      }
      return padEarthworkApi.saveSketch(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params: heightRef,
        envelope: envelopeEnabled
          ? { enabled: true, wrap_width_m: wrapWidthM }
          : { enabled: false, wrap_width_m: wrapWidthM },
      });
    },
    onSuccess: () => {
      setSketchDirty(false);
      setSaveMessage('Схема сохранена. Объёмы обновляются только по кнопке «Рассчитать».');
      setError(null);
      syncCardFields();
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, objectId] });
      void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      onSaveSuccess?.();
    },
    onError: (err: Error) => setError(err.message || 'Ошибка сохранения'),
  });

  const handleShapeModeChange = (mode: ShapeMode) => {
    if (mode === shapeMode) return;
    setShapeMode(mode);
    setResult(null);
    setError(null);
    if (mode === 'polygon') {
      setSketch(isPlanPolygon(sketch) ? sketch : rectangleToPolygon(rectangleSketch));
      setPolygonTool(isPlanPolygon(sketch) && sketch.vertices.length === 0 ? 'draw' : 'vertices');
    } else {
      setSketch(isPlanRectangle(sketch) ? sketch : polygonToRectangle(polygonSketch));
    }
  };

  const handleApplyToFields = () => {
    syncCardFields();
  };

  const handleResetSketch = () => {
    if (shapeMode === 'polygon') {
      setSketch(createDefaultPolygonSketch());
      setPolygonTool('vertices');
    } else {
      setSketch(createDefaultPlanSketch());
    }
    setZoom(1);
    setFitViewNonce((n) => n + 1);
    setResult(null);
    setError(null);
  };

  const handleFitView = () => {
    setZoom(1);
    setFitViewNonce((n) => n + 1);
  };

  const handleClearPolygon = () => {
    setSketch(createEmptyPolygonSketch());
    setPolygonTool('draw');
    setResult(null);
    setError(null);
  };

  const fillM3 = result?.volumes.fill_m3;
  const areaTop = sketchFootprintAreaM2(sketch);
  const heightNum = Number(localHeight.replace(',', '.'));
  const polygonClosed = isPlanPolygon(sketch) && isPolygonSketchClosed(sketch);
  const canCompute = shapeMode === 'rectangle' || polygonClosed;
  const envelopeActive = envelopeEnabled && canCompute && wrapWidthM > 0;
  const outerVerts = envelopeActive ? envelopeOuterVertices(sketch, wrapWidthM) : null;
  const areaBottom = outerVerts ? polygonAreaM2(outerVerts) : null;
  const estimatedFill = envelopeActive
    ? estimateEnvelopeFillM3(sketch, heightNum, wrapWidthM)
    : estimateFillM3(sketch, heightNum);
  const envelopeParams = envelopeActive
    ? { enabled: true as const, wrap_width_m: wrapWidthM }
    : null;

  return (
    <AppModal
      title="Схема площадки"
      subtitle="План (вид сверху) — прямоугольник или произвольный контур"
      onClose={onClose}
      size="lg"
      overlayClassName="app-modal-overlay--pad-earthwork-sketch"
      footer={
        !readOnly ? (
          <div className="pad-earthwork-sketch-modal__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Закрыть
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleApplyToFields}>
              Применить к полям
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={
                saveMutation.isPending || computeMutation.isPending || tab !== 'plan' || !canCompute
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                computeMutation.isPending || saveMutation.isPending || tab !== 'plan' || !canCompute
              }
              onClick={() => computeMutation.mutate()}
            >
              {computeMutation.isPending ? 'Расчёт…' : 'Рассчитать'}
            </button>
            {fillM3 != null && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onApplySandDemand(fillM3)}
              >
                Применить {fillM3.toLocaleString('ru-RU')} м³ к песку
              </button>
            )}
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        )
      }
    >
      <div className="pad-earthwork-sketch-modal">
        <div className="pad-earthwork-sketch-modal__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'plan'}
            className={`pad-earthwork-sketch-modal__tab${tab === 'plan' ? ' pad-earthwork-sketch-modal__tab--active' : ''}`}
            onClick={() => setTab('plan')}
          >
            План
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            className="pad-earthwork-sketch-modal__tab pad-earthwork-sketch-modal__tab--disabled"
            disabled
            title="Этап 2"
          >
            Профиль (скоро)
          </button>
        </div>

        {tab === 'plan' && (
          <>
            <div className="pad-earthwork-sketch-modal__shape-toggle" role="group" aria-label="Тип контура">
              <button
                type="button"
                className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'rectangle' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
                disabled={readOnly}
                onClick={() => handleShapeModeChange('rectangle')}
              >
                <Square size={16} aria-hidden />
                Прямоугольник
              </button>
              <button
                type="button"
                className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'polygon' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
                disabled={readOnly}
                onClick={() => handleShapeModeChange('polygon')}
              >
                <Shapes size={16} aria-hidden />
                Произвольная
              </button>
            </div>

            {shapeMode === 'rectangle' ? (
              <PlanSketchToolbar
                tool={rectTool}
                onToolChange={setRectTool}
                snapEnabled={snapEnabled}
                onSnapChange={setSnapEnabled}
                lockAspect={lockAspect}
                onLockAspectChange={setLockAspect}
                showEdgeLengths={showEdgeLengths}
                onShowEdgeLengthsChange={setShowEdgeLengths}
                zoom={zoom}
                onZoomIn={() => setZoom((z) => Math.min(4, z + 0.25))}
                onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                onFitView={handleFitView}
                readOnly={readOnly}
              />
            ) : (
              <PolygonSketchToolbar
                tool={polygonTool}
                onToolChange={setPolygonTool}
                snapEnabled={snapEnabled}
                onSnapChange={setSnapEnabled}
                showEdgeLengths={showEdgeLengths}
                onShowEdgeLengthsChange={setShowEdgeLengths}
                vertexCount={polygonSketch.vertices.length}
                closed={polygonClosed}
                zoom={zoom}
                onZoomIn={() => setZoom((z) => Math.min(4, z + 0.25))}
                onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                onFitView={handleFitView}
                readOnly={readOnly}
              />
            )}

            {shapeMode === 'rectangle' && (
              <p className="object-detail-panel__hint text-xs pad-earthwork-sketch-modal__shape-hint">
                Углы меняют размер от центра. Для произвольной формы переключите «Произвольная» или
                нажмите «Разбить в полигон».
              </p>
            )}

            {shapeMode === 'rectangle' && (
              <div className="pad-earthwork-sketch-modal__presets">
                <span className="pad-earthwork-sketch-modal__presets-label">Типовые размеры:</span>
                {PAD_SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="pad-earthwork-sketch-modal__preset-chip"
                    disabled={readOnly}
                    onClick={() =>
                      updateSketch({
                        kind: 'plan_rectangle',
                        length_m: p.length_m,
                        width_m: p.width_m,
                        rotation_deg: rectangleSketch.rotation_deg,
                      })
                    }
                  >
                    {p.label} м
                  </button>
                ))}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      className="pad-earthwork-sketch-modal__preset-chip"
                      onClick={() => {
                        setShapeMode('polygon');
                        updateSketch(rectangleToPolygon(rectangleSketch));
                        setPolygonTool('vertices');
                      }}
                    >
                      Разбить в полигон
                    </button>
                    <button
                      type="button"
                      className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
                      title="Сбросить к 120×80 м"
                      onClick={handleResetSketch}
                    >
                      <RotateCcw size={14} aria-hidden />
                      Сброс
                    </button>
                  </>
                )}
              </div>
            )}

            {shapeMode === 'polygon' && !readOnly && (
              <div className="pad-earthwork-sketch-modal__presets">
                <span className="pad-earthwork-sketch-modal__presets-label">Контур:</span>
                <button
                  type="button"
                  className="pad-earthwork-sketch-modal__preset-chip"
                  onClick={() => {
                    updateSketch(rectangleToPolygon(rectangleSketch));
                    setPolygonTool('vertices');
                  }}
                >
                  Из прямоугольника
                </button>
                <button
                  type="button"
                  className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
                  onClick={handleClearPolygon}
                >
                  Очистить
                </button>
                <button
                  type="button"
                  className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
                  onClick={handleResetSketch}
                >
                  <RotateCcw size={14} aria-hidden />
                  Сброс
                </button>
              </div>
            )}

            <div className="pad-earthwork-sketch-modal__layout">
              <div className="pad-earthwork-sketch-modal__canvas-col">
                {shapeMode === 'rectangle' ? (
                  <PlanRectangleEditor
                    sketch={rectangleSketch}
                    onChange={updateSketch}
                    tool={rectTool}
                    snapEnabled={snapEnabled}
                    lockAspect={lockAspect}
                    zoom={zoom}
                    fitViewNonce={fitViewNonce}
                    readOnly={readOnly}
                    envelope={envelopeParams}
                    showEdgeLengths={showEdgeLengths}
                  />
                ) : (
                  <PlanPolygonEditor
                    sketch={polygonSketch}
                    onChange={updateSketch}
                    tool={polygonTool}
                    snapEnabled={snapEnabled}
                    zoom={zoom}
                    fitViewNonce={fitViewNonce}
                    readOnly={readOnly}
                    envelope={envelopeParams}
                    showEdgeLengths={showEdgeLengths}
                  />
                )}
              </div>

              <aside className="pad-earthwork-sketch-modal__sidebar">
                <div className="pad-earthwork-sketch-modal__stats">
                  <div className="pad-earthwork-sketch-modal__stat-card">
                    <span className="pad-earthwork-sketch-modal__stat-label">
                      {envelopeActive ? 'Площадь верха' : 'Площадь'}
                    </span>
                    <strong>{areaTop.toLocaleString('ru-RU')} м²</strong>
                  </div>
                  {envelopeActive && areaBottom != null && (
                    <div className="pad-earthwork-sketch-modal__stat-card">
                      <span className="pad-earthwork-sketch-modal__stat-label">Площадь низа</span>
                      <strong>{areaBottom.toLocaleString('ru-RU')} м²</strong>
                    </div>
                  )}
                  {estimatedFill != null && canCompute && (
                    <div className="pad-earthwork-sketch-modal__stat-card pad-earthwork-sketch-modal__stat-card--accent">
                      <span className="pad-earthwork-sketch-modal__stat-label">Оценка отсыпки</span>
                      <strong>{estimatedFill.toLocaleString('ru-RU')} м³</strong>
                    </div>
                  )}
                </div>

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
                ) : (
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
                )}

                <div className="pad-earthwork-sketch-modal__section">
                  <h3 className="pad-earthwork-sketch-modal__section-title">Обволакивание</h3>
                  <label className="pad-earthwork-sketch-modal__checkbox-row">
                    <input
                      type="checkbox"
                      checked={envelopeEnabled}
                      disabled={readOnly || !canCompute}
                      onChange={(e) => setEnvelopeEnabled(e.target.checked)}
                    />
                    <span>Включить обволакивание (усечённая пирамида)</span>
                  </label>
                  {envelopeEnabled && (
                    <>
                      <DimensionStepper
                        label="Ширина основания W"
                        value={wrapWidthM}
                        step={snapEnabled ? 1 : 0.5}
                        min={0.5}
                        max={100}
                        readOnly={readOnly}
                        onChange={setWrapWidthM}
                      />
                      <p className="object-detail-panel__hint text-xs">
                        Усечённая пирамида: верхнее основание — контур площадки (S верх), нижнее — с отступом W (S низ).
                        Объём ≈ (H/3) × (S верх + S низ + √(S верх × S низ)).
                      </p>
                    </>
                  )}
                </div>

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
                    onChange={(n) => setLocalRef(n.toFixed(2))}
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
                      Верх площадки: {result.design.top_elevation_m} м
                    </p>
                    {result.warnings?.includes('envelope_volume_is_truncated_pyramid_approximation') && (
                      <p className="object-detail-panel__hint text-xs">
                        Объём — усечённая пирамида: верхнее основание по контуру площадки, нижнее — с отступом W.
                      </p>
                    )}
                    {result.warnings?.includes('polygon_mesh_is_bbox_approximation') && (
                      <p className="object-detail-panel__hint text-xs">
                        3D-модель — упрощённый bounding box; объём по площади контура.
                      </p>
                    )}
                  </div>
                )}
                {error && (
                  <p className="object-detail-panel__hint text-red-600 text-xs">{error}</p>
                )}
                {saveMessage && (
                  <p className="object-detail-panel__hint text-xs">{saveMessage}</p>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </AppModal>
  );
}

export function sketchFromLastResponse(sketch: unknown): PlanShapeSketch | null {
  return parseSketchFromLast(sketch);
}
