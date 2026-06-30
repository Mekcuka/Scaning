import { clampNdsDeg, DEFAULT_PAD_NDS_DEG, isPadSubtype } from '../../lib/infraPadEarthwork';
import { Button, Input } from 'antd';
import type { InfraObject } from '../../lib/api';
import { ReferenceElevationDemMinButton } from '../padEarthwork/ReferenceElevationDemMinButton';
import { FieldLabel } from './panelUi';
import { formatSavedAt } from './infraPadEarthworkSectionUtils';
import type { InfraPadEarthworkSectionModel } from './useInfraPadEarthworkSection';

export type InfraPadEarthworkSectionFormProps = {
  projectId: string;
  infraObject: InfraObject;
  readOnly: boolean;
  setSandDemandM3: (value: string) => void;
  model: InfraPadEarthworkSectionModel;
};

export function InfraPadEarthworkSectionForm({
  projectId,
  infraObject,
  readOnly,
  setSandDemandM3,
  model,
}: InfraPadEarthworkSectionFormProps) {
  const {
    lengthM,
    setLengthM,
    widthM,
    setWidthM,
    heightM,
    setHeightM,
    rotationDeg,
    setRotationDeg,
    referenceElevationM,
    setReferenceElevationM,
    result,
    setResult,
    error,
    setError,
    setSketchOpen,
    terrainMode,
    setTerrainMode,
    demStatus,
    demAvailable,
    demSketch,
    demPreviewParams,
    fetchDemMutation,
    computeMutation,
    fillM3,
    sketchSavedAt,
    hasSavedSketch,
  } = model;

  const isPad = isPadSubtype(infraObject.subtype);
  const savedAtLabel = formatSavedAt(sketchSavedAt);

  const demStatusLabel = (() => {
    if (!demStatus?.asset_id) return 'DEM не загружен';
    const when = formatSavedAt(demStatus.fetched_at);
    const source = demStatus.source?.replace('opentopography:', '') ?? 'COP30';
    return when ? `DEM загружен · ${source} · ${when}` : `DEM загружен · ${source}`;
  })();

  return (
    <>
      <p className="object-detail-panel__hint text-xs">
        {isPad
          ? 'Расчёт объёмов отсыпки и выемки. Параметры скважин и автогенерация контура — в модалке «Схема…» → режим «Генератор».'
          : 'Расчёт объёмов отсыпки и выемки. Контур площадки — в модалке «Схема…» (прямоугольник или произвольный полигон).'}
      </p>
      {hasSavedSketch && (
        <p className="object-detail-panel__hint text-xs">
          Схема сохранена для этого объекта
          {savedAtLabel ? ` · ${savedAtLabel}` : ''}. Объёмы — по кнопке «Рассчитать».
        </p>
      )}
      <div className="object-detail-panel__coord-grid">
        <label className="object-detail-panel__field">
          <FieldLabel>Длина, м</FieldLabel>
          <Input
            className="object-detail-panel__input"
            type="number"
            min={0}
            step="any"
            value={lengthM}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setLengthM(e.target.value)}
          />
        </label>
        <label className="object-detail-panel__field">
          <FieldLabel>Ширина, м</FieldLabel>
          <Input
            className="object-detail-panel__input"
            type="number"
            min={0}
            step="any"
            value={widthM}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setWidthM(e.target.value)}
          />
        </label>
        <label className="object-detail-panel__field">
          <FieldLabel>Высота насыпи, м</FieldLabel>
          <Input
            className="object-detail-panel__input"
            type="number"
            min={0}
            step="any"
            value={heightM}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setHeightM(e.target.value)}
          />
        </label>
        <label className="object-detail-panel__field">
          <FieldLabel>Опорная отметка, м</FieldLabel>
          <div className="object-detail-panel__field-control object-detail-panel__field-control--ref-dem-min">
            <Input
              className="object-detail-panel__input"
              type="number"
              step="any"
              value={referenceElevationM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => setReferenceElevationM(e.target.value)}
            />
            <ReferenceElevationDemMinButton
              projectId={projectId}
              objectId={infraObject.id}
              sketch={demSketch}
              params={demPreviewParams}
              demAvailable={demAvailable}
              readOnly={readOnly}
              onApply={(n) => {
                setReferenceElevationM(String(n.toFixed(2)));
                setResult(null);
              }}
              onError={(msg) => setError(msg)}
            />
          </div>
        </label>
      </div>
      <label className="object-detail-panel__field">
        <FieldLabel>{isPad ? 'НДС, °' : 'Поворот, °'}</FieldLabel>
        <Input
          className="object-detail-panel__input"
          type="number"
          min={0}
          max={360}
          step={1}
          value={rotationDeg}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => setRotationDeg(e.target.value)}
          onBlur={() =>
            setRotationDeg(
              String(clampNdsDeg(Number(rotationDeg.replace(',', '.')) || DEFAULT_PAD_NDS_DEG)),
            )
          }
        />
      </label>
      <fieldset className="object-detail-panel__field" disabled={readOnly}>
        <FieldLabel>Рельеф</FieldLabel>
        <div className="object-detail-panel__actions-row">
          <label className="object-detail-panel__inline-check">
            <input
              type="radio"
              name={`pad-terrain-${infraObject.id}`}
              checked={terrainMode === 'flat'}
              onChange={() => setTerrainMode('flat')}
            />
            Плоская отметка
          </label>
          <label className="object-detail-panel__inline-check">
            <input
              type="radio"
              name={`pad-terrain-${infraObject.id}`}
              checked={terrainMode === 'dem'}
              onChange={() => setTerrainMode('dem')}
            />
            DEM (OpenTopography)
          </label>
        </div>
        {terrainMode === 'dem' && (
          <p className="object-detail-panel__hint text-xs">{demStatusLabel}</p>
        )}
      </fieldset>
      {!readOnly && (
        <div className="object-detail-panel__actions-row">
          <Button size="small" onClick={() => setSketchOpen(true)}>
            Схема…
          </Button>
          {terrainMode === 'dem' && (
            <Button
              size="small"
              loading={fetchDemMutation.isPending}
              disabled={computeMutation.isPending}
              onClick={() => fetchDemMutation.mutate()}
            >
              {fetchDemMutation.isPending ? 'Загрузка DEM…' : 'Загрузить DEM'}
            </Button>
          )}
          <Button
            size="small"
            loading={computeMutation.isPending}
            disabled={fetchDemMutation.isPending}
            onClick={() => computeMutation.mutate()}
          >
            {computeMutation.isPending ? 'Расчёт…' : 'Рассчитать'}
          </Button>
          {fillM3 != null && (
            <Button size="small" onClick={() => setSandDemandM3(String(fillM3))}>
              Применить {fillM3.toLocaleString('ru-RU')} м³ к спросу песка
            </Button>
          )}
        </div>
      )}
      {error && <p className="object-detail-panel__hint text-red-600 text-xs">{error}</p>}
      {result && (
        <div className="object-detail-panel__subsection text-sm">
          <p>
            Отсыпка: <strong>{result.volumes.fill_m3.toLocaleString('ru-RU')}</strong> m³ · Выемка:{' '}
            <strong>{result.volumes.cut_m3.toLocaleString('ru-RU')}</strong> m³
          </p>
          <p className="object-detail-panel__hint text-xs">
            Отсыпка и выемка считаются независимо: изъятый грунт не идёт в насыпь.
          </p>
          <p className="object-detail-panel__hint text-xs">
            Площадь пятна: {result.design.footprint_area_m2.toLocaleString('ru-RU')} m² · Верх площадки:{' '}
            {result.design.top_elevation_m} m
          </p>
        </div>
      )}
    </>
  );
}
