import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { padEarthworkApi, type PadEarthworkComputeResult } from '../../lib/api/padEarthworkApi';
import { padParamsFromObject, envelopeFromObject, hasSavedPadSketch, sketchSavedAtFromObject, clampNdsDeg, DEFAULT_PAD_NDS_DEG, resolveGeneratorNdsDeg, readDemStatusFromProperties, isPadSubtype } from '../../lib/infraPadEarthwork';
import type { PadTerrainMode } from '../../lib/api/padEarthworkApi';
import { parseSketchFromLast, parseWellsLocalFromLast, planFromFormFields } from '../../lib/padEarthworkSketch';
import type { InfraObject } from '../../lib/api';
import { PadEarthworkSketchModal } from '../padEarthwork/PadEarthworkSketchModal';
import { ReferenceElevationDemMinButton } from '../padEarthwork/ReferenceElevationDemMinButton';
import { FieldLabel, PanelSection } from './panelUi';

interface InfraPadEarthworkSectionProps {
  projectId: string;
  infraObject: InfraObject;
  readOnly: boolean;
  setSandDemandM3: (value: string) => void;
  padMarginLeftM: string;
  setPadMarginLeftM: (value: string) => void;
  padMarginBottomM: string;
  setPadMarginBottomM: (value: string) => void;
  padMarginTopM: string;
  setPadMarginTopM: (value: string) => void;
  padMarginEndM: string;
  setPadMarginEndM: (value: string) => void;
  padWellCount: string;
  setPadWellCount: (value: string) => void;
  padWellsPerGroup: string;
  setPadWellsPerGroup: (value: string) => void;
  padWellSpacingM: string;
  setPadWellSpacingM: (value: string) => void;
  padGroupSpacingM: string;
  setPadGroupSpacingM: (value: string) => void;
}

function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatPadDemError(message: string): string {
  if (message.includes('dem_api_key_invalid_format')) {
    return 'Неверный формат API-ключа OpenTopography: нужна 32-символьная hex-строка из myOpenTopo (не UUID).';
  }
  if (message.includes('dem_api_key_invalid') || message.includes('dem_api_key_unauthorized')) {
    return 'API-ключ OpenTopography отклонён. Проверьте OPENTOPOGRAPHY_API_KEY в backend/.env и перезапустите сервер.';
  }
  if (message.includes('dem_api_not_configured')) {
    return 'DEM не настроен: задайте OPENTOPOGRAPHY_API_KEY в backend/.env.';
  }
  if (message.includes('dem_bbox_too_small') || message.includes('dem_fetch_bad_request')) {
    return 'Не удалось загрузить DEM: слишком маленькая область запроса. Попробуйте увеличить габариты площадки.';
  }
  if (message.includes('dem_rate_limit_exceeded')) {
    return 'Превышен лимит запросов OpenTopography. Попробуйте позже.';
  }
  return message || 'Ошибка загрузки DEM';
}

export function InfraPadEarthworkSection({
  projectId,
  infraObject,
  readOnly,
  setSandDemandM3,
  padMarginLeftM,
  setPadMarginLeftM,
  padMarginBottomM,
  setPadMarginBottomM,
  padMarginTopM,
  setPadMarginTopM,
  padMarginEndM,
  setPadMarginEndM,
  padWellCount,
  setPadWellCount,
  padWellsPerGroup,
  setPadWellsPerGroup,
  padWellSpacingM,
  setPadWellSpacingM,
  padGroupSpacingM,
  setPadGroupSpacingM,
}: InfraPadEarthworkSectionProps) {
  const queryClient = useQueryClient();
  const initial = padParamsFromObject(infraObject);
  const [lengthM, setLengthM] = useState(initial.lengthM);
  const [widthM, setWidthM] = useState(initial.widthM);
  const [heightM, setHeightM] = useState(initial.heightM);
  const [rotationDeg, setRotationDeg] = useState(initial.rotationDeg);
  const [referenceElevationM, setReferenceElevationM] = useState(initial.referenceElevationM);
  const [result, setResult] = useState<PadEarthworkComputeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [terrainMode, setTerrainMode] = useState<'flat' | 'dem'>('flat');

  const { data: last } = useQuery({
    queryKey: ['padEarthworkLast', projectId, infraObject.id],
    queryFn: () => padEarthworkApi.getLast(projectId, infraObject.id),
    enabled: Boolean(projectId && infraObject.id),
  });

  const savedSketch = useMemo(
    () => parseSketchFromLast(last?.sketch ?? null),
    [last?.sketch],
  );
  const savedWellsLocal = useMemo(
    () =>
      parseWellsLocalFromLast(
        last?.wells_local ?? (infraObject.properties as Record<string, unknown> | undefined)?.pad_wells_local_json,
      ),
    [last?.wells_local, infraObject.properties],
  );

  const savedEnvelope = useMemo(
    () => last?.envelope ?? envelopeFromObject(infraObject.properties),
    [last?.envelope, infraObject.properties],
  );

  const demStatus = useMemo(
    () => last?.dem ?? readDemStatusFromProperties(infraObject.properties as Record<string, unknown> | undefined),
    [last?.dem, infraObject.properties],
  );

  useEffect(() => {
    if (sketchOpen) return;
    const p = padParamsFromObject(infraObject);
    setLengthM(p.lengthM);
    setWidthM(p.widthM);
    setHeightM(p.heightM);
    setRotationDeg(p.rotationDeg);
    setReferenceElevationM(p.referenceElevationM);
  }, [infraObject.id, infraObject.properties, sketchOpen]);

  useEffect(() => {
    if (sketchOpen) return;
    if (last?.params) {
      const p = last.params;
      setLengthM(String(p.length_m));
      setWidthM(String(p.width_m));
      setHeightM(String(p.height_m));
      setRotationDeg(
        resolveGeneratorNdsDeg(
          String(p.rotation_deg ?? DEFAULT_PAD_NDS_DEG),
          (savedWellsLocal.length > 0),
        ),
      );
      setReferenceElevationM(String(p.reference_elevation_m));
    }
    if (last?.result) setResult(last.result);
  }, [last, sketchOpen, savedWellsLocal.length]);

  const skipPadWellParamsReset = useRef(true);
  useEffect(() => {
    if (skipPadWellParamsReset.current) {
      skipPadWellParamsReset.current = false;
      return;
    }
    setResult(null);
  }, [
    padWellCount,
    padWellsPerGroup,
    padWellSpacingM,
    padGroupSpacingM,
    padMarginLeftM,
    padMarginBottomM,
    padMarginTopM,
    padMarginEndM,
  ]);

  const buildParams = useCallback(() => {
    const length = parsePositive(lengthM);
    const width = parsePositive(widthM);
    const height = parsePositive(heightM);
    const refRaw = referenceElevationM.trim().replace(',', '.');
    const ref = refRaw === '' ? 0 : Number(refRaw);
    const rotRaw = rotationDeg.trim().replace(',', '.');
    const rotation = rotRaw === '' ? DEFAULT_PAD_NDS_DEG : Number(rotRaw);
    if (length == null || width == null || height == null || !Number.isFinite(ref)) {
      return null;
    }
    return {
      length_m: length,
      width_m: width,
      height_m: height,
      rotation_deg: Number.isFinite(rotation) ? clampNdsDeg(rotation) : DEFAULT_PAD_NDS_DEG,
      reference_elevation_m: ref,
    };
  }, [lengthM, widthM, heightM, referenceElevationM, rotationDeg]);

  const buildTerrain = useCallback((): PadTerrainMode => {
    if (terrainMode === 'dem') {
      return { mode: 'dem', dem_asset_id: demStatus?.asset_id ?? undefined };
    }
    return { mode: 'flat' };
  }, [terrainMode, demStatus?.asset_id]);

  const demAvailable = Boolean(demStatus?.asset_id);
  const demSketch = useMemo(
    () => savedSketch ?? planFromFormFields(lengthM, widthM, rotationDeg),
    [savedSketch, lengthM, widthM, rotationDeg],
  );
  const demPreviewParams = useMemo(() => {
    const p = buildParams();
    if (!p) return null;
    return { height_m: p.height_m, reference_elevation_m: p.reference_elevation_m };
  }, [buildParams]);

  const fetchDemMutation = useMutation({
    mutationFn: async () => {
      const params = buildParams();
      if (!params) throw new Error('Укажите длину, ширину, высоту и опорную отметку');
      return padEarthworkApi.fetchDem(projectId, infraObject.id, { params });
    },
    onSuccess: (data) => {
      setError(null);
      setReferenceElevationM(String(data.reference_elevation_m));
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, infraObject.id] });
      void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
    },
    onError: (err: Error) => setError(formatPadDemError(err.message)),
  });

  const computeMutation = useMutation({
    mutationFn: async () => {
      const params = buildParams();
      if (!params) throw new Error('Укажите длину, ширину, высоту и опорную отметку');
      return padEarthworkApi.compute(projectId, infraObject.id, {
        params,
        terrain: buildTerrain(),
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, infraObject.id] });
      void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
    },
    onError: (err: Error) => setError(formatPadDemError(err.message) || 'Ошибка расчёта'),
  });

  const fillM3 = result?.volumes.fill_m3;

  const sketchSavedAt = last?.sketch_saved_at ?? sketchSavedAtFromObject(infraObject.properties);
  const hasSavedSketch = Boolean(savedSketch) || hasSavedPadSketch(infraObject.properties);

  const formatSavedAt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('ru-RU');
  };

  const isPad = isPadSubtype(infraObject.subtype);

  const demStatusLabel = (() => {
    if (!demStatus?.asset_id) return 'DEM не загружен';
    const when = formatSavedAt(demStatus.fetched_at);
    const source = demStatus.source?.replace('opentopography:', '') ?? 'COP30';
    return when ? `DEM загружен · ${source} · ${when}` : `DEM загружен · ${source}`;
  })();

  return (
    <PanelSection title="Площадка / земляные работы" card>
      <p className="object-detail-panel__hint text-xs">
        {isPad
          ? 'Расчёт объёмов отсыпки и выемки. Параметры скважин и автогенерация контура — в модалке «Схема…» → режим «Генератор».'
          : 'Расчёт объёмов отсыпки и выемки. Контур площадки — в модалке «Схема…» (прямоугольник или произвольный полигон).'}
      </p>
      {hasSavedSketch && (
        <p className="object-detail-panel__hint text-xs">
          Схема сохранена для этого объекта
          {formatSavedAt(sketchSavedAt) ? ` · ${formatSavedAt(sketchSavedAt)}` : ''}.
          Объёмы — по кнопке «Рассчитать».
        </p>
      )}
      <div className="object-detail-panel__coord-grid">
        <label className="object-detail-panel__field">
          <FieldLabel>Длина, м</FieldLabel>
          <input
            className="input object-detail-panel__input"
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
          <input
            className="input object-detail-panel__input"
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
          <input
            className="input object-detail-panel__input"
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
            <input
              className="input object-detail-panel__input"
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
        <input
          className="input object-detail-panel__input"
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
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSketchOpen(true)}
          >
            Схема…
          </button>
          {terrainMode === 'dem' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={fetchDemMutation.isPending || computeMutation.isPending}
              onClick={() => fetchDemMutation.mutate()}
            >
              {fetchDemMutation.isPending ? 'Загрузка DEM…' : 'Загрузить DEM'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={computeMutation.isPending || fetchDemMutation.isPending}
            onClick={() => computeMutation.mutate()}
          >
            {computeMutation.isPending ? 'Расчёт…' : 'Рассчитать'}
          </button>
          {fillM3 != null && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSandDemandM3(String(fillM3))}
            >
              Применить {fillM3.toLocaleString('ru-RU')} м³ к спросу песка
            </button>
          )}
        </div>
      )}
      {error && <p className="object-detail-panel__hint text-red-600 text-xs">{error}</p>}
      {result && (
        <div className="object-detail-panel__subsection text-sm">
          <p>
            Отсыпка: <strong>{result.volumes.fill_m3.toLocaleString('ru-RU')}</strong> м³ · Выемка:{' '}
            <strong>{result.volumes.cut_m3.toLocaleString('ru-RU')}</strong> m³
          </p>
                    <p className="object-detail-panel__hint text-xs">
                      Отсыпка и выемка считаются независимо: изъятый грунт не идёт в насыпь.
                    </p>
                    <p className="object-detail-panel__hint text-xs">
                      Площадь пятна: {result.design.footprint_area_m2.toLocaleString('ru-RU')} м² · Верх площадки:{' '}
            {result.design.top_elevation_m} m
          </p>
        </div>
      )}

      {sketchOpen && (
        <PadEarthworkSketchModal
          projectId={projectId}
          objectId={infraObject.id}
          readOnly={readOnly}
          showGenerator={isPad}
          lengthM={lengthM}
          widthM={widthM}
          heightM={heightM}
          rotationDeg={rotationDeg}
          referenceElevationM={referenceElevationM}
          initialSketch={savedSketch}
          initialWellsLocal={savedWellsLocal}
          initialEnvelope={savedEnvelope}
          padWellCount={padWellCount}
          setPadWellCount={setPadWellCount}
          padWellsPerGroup={padWellsPerGroup}
          setPadWellsPerGroup={setPadWellsPerGroup}
          padWellSpacingM={padWellSpacingM}
          setPadWellSpacingM={setPadWellSpacingM}
          padGroupSpacingM={padGroupSpacingM}
          setPadGroupSpacingM={setPadGroupSpacingM}
          padMarginLeftM={padMarginLeftM}
          setPadMarginLeftM={setPadMarginLeftM}
          padMarginBottomM={padMarginBottomM}
          setPadMarginBottomM={setPadMarginBottomM}
          padMarginTopM={padMarginTopM}
          setPadMarginTopM={setPadMarginTopM}
          padMarginEndM={padMarginEndM}
          setPadMarginEndM={setPadMarginEndM}
          setRotationDeg={setRotationDeg}
          onClose={() => setSketchOpen(false)}
          onApplyToFields={(fields) => {
            setLengthM(fields.lengthM);
            setWidthM(fields.widthM);
            setRotationDeg(fields.rotationDeg);
            setHeightM(fields.heightM);
            setReferenceElevationM(fields.referenceElevationM);
            setResult(null);
          }}
          onComputeSuccess={(data) => {
            setResult(data);
            void queryClient.invalidateQueries({
              queryKey: ['padEarthworkLast', projectId, infraObject.id],
            });
            void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
          }}
          onSaveSuccess={() => {
            void queryClient.invalidateQueries({
              queryKey: ['padEarthworkLast', projectId, infraObject.id],
            });
            void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
          }}
          onApplySandDemand={(fill) => setSandDemandM3(String(fill))}
          demStatus={demStatus}
          terrainMode={terrainMode}
        />
      )}
    </PanelSection>
  );
}
