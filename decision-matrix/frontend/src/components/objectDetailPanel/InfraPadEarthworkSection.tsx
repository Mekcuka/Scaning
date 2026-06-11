import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { padEarthworkApi, type PadEarthworkComputeResult } from '../../lib/api/padEarthworkApi';
import { padParamsFromObject, envelopeFromObject, hasSavedPadSketch, sketchSavedAtFromObject } from '../../lib/infraPadEarthwork';
import { parseSketchFromLast } from '../../lib/padEarthworkSketch';
import type { InfraObject } from '../../lib/api';
import {
  PadEarthworkSketchModal,
} from '../padEarthwork/PadEarthworkSketchModal';
import { FieldLabel, PanelSection } from './panelUi';

interface InfraPadEarthworkSectionProps {
  projectId: string;
  infraObject: InfraObject;
  readOnly: boolean;
  setSandDemandM3: (value: string) => void;
}

function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function InfraPadEarthworkSection({
  projectId,
  infraObject,
  readOnly,
  setSandDemandM3,
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

  const { data: last } = useQuery({
    queryKey: ['padEarthworkLast', projectId, infraObject.id],
    queryFn: () => padEarthworkApi.getLast(projectId, infraObject.id),
    enabled: Boolean(projectId && infraObject.id),
  });

  useEffect(() => {
    const p = padParamsFromObject(infraObject);
    setLengthM(p.lengthM);
    setWidthM(p.widthM);
    setHeightM(p.heightM);
    setRotationDeg(p.rotationDeg);
    setReferenceElevationM(p.referenceElevationM);
  }, [infraObject.id, infraObject.properties]);

  useEffect(() => {
    if (last?.params) {
      const p = last.params;
      setLengthM(String(p.length_m));
      setWidthM(String(p.width_m));
      setHeightM(String(p.height_m));
      setRotationDeg(String(p.rotation_deg ?? 0));
      setReferenceElevationM(String(p.reference_elevation_m));
    }
    if (last?.result) setResult(last.result);
  }, [last]);

  const buildParams = useCallback(() => {
    const length = parsePositive(lengthM);
    const width = parsePositive(widthM);
    const height = parsePositive(heightM);
    const refRaw = referenceElevationM.trim().replace(',', '.');
    const ref = refRaw === '' ? 0 : Number(refRaw);
    const rotRaw = rotationDeg.trim().replace(',', '.');
    const rotation = rotRaw === '' ? 0 : Number(rotRaw);
    if (length == null || width == null || height == null || !Number.isFinite(ref)) {
      return null;
    }
    return {
      length_m: length,
      width_m: width,
      height_m: height,
      rotation_deg: Number.isFinite(rotation) ? rotation : 0,
      reference_elevation_m: ref,
    };
  }, [lengthM, widthM, heightM, referenceElevationM, rotationDeg]);

  const computeMutation = useMutation({
    mutationFn: async () => {
      const params = buildParams();
      if (!params) throw new Error('Укажите длину, ширину, высоту и опорную отметку');
      return padEarthworkApi.compute(projectId, infraObject.id, { params });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, infraObject.id] });
    },
    onError: (err: Error) => setError(err.message || 'Ошибка расчёта'),
  });

  const fillM3 = result?.volumes.fill_m3;

  const savedSketch = useMemo(
    () => parseSketchFromLast(last?.sketch ?? null),
    [last?.sketch],
  );

  const savedEnvelope = useMemo(
    () => last?.envelope ?? envelopeFromObject(infraObject.properties),
    [last?.envelope, infraObject.properties],
  );

  const sketchSavedAt = last?.sketch_saved_at ?? sketchSavedAtFromObject(infraObject.properties);
  const hasSavedSketch = Boolean(savedSketch) || hasSavedPadSketch(infraObject.properties);

  const formatSavedAt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('ru-RU');
  };

  return (
    <PanelSection title="Площадка / земляные работы" card>
      <p className="object-detail-panel__hint text-xs">
        Упрощённый расчёт на плоской опорной отметке (без DEM). Footprint строится от центра точки.
      </p>
      {hasSavedSketch && (
        <p className="object-detail-panel__hint text-xs">
          Схема сохранена для этого куста
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
          <input
            className="input object-detail-panel__input"
            type="number"
            step="any"
            value={referenceElevationM}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => setReferenceElevationM(e.target.value)}
          />
        </label>
      </div>
      <label className="object-detail-panel__field">
        <FieldLabel>Поворот, °</FieldLabel>
        <input
          className="input object-detail-panel__input"
          type="number"
          step="any"
          value={rotationDeg}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => setRotationDeg(e.target.value)}
        />
      </label>
      {!readOnly && (
        <div className="object-detail-panel__actions-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSketchOpen(true)}
          >
            Схема…
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={computeMutation.isPending}
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
            <strong>{result.volumes.cut_m3.toLocaleString('ru-RU')}</strong> м³
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
          lengthM={lengthM}
          widthM={widthM}
          heightM={heightM}
          rotationDeg={rotationDeg}
          referenceElevationM={referenceElevationM}
          initialSketch={savedSketch}
          initialEnvelope={savedEnvelope}
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
        />
      )}
    </PanelSection>
  );
}
