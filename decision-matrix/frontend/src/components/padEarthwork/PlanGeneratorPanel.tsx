import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { clampNdsDeg, DEFAULT_PAD_NDS_DEG } from '../../lib/infraPadEarthwork';
import { padWellFieldsFromForm } from '../../lib/infraPadWells';
import { generatePadFromWells, PadWellLayoutError } from '../../lib/padEarthworkSketch';

function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNonNegative(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface PlanGeneratorPanelProps {
  readOnly: boolean;
  padWellCount: string;
  setPadWellCount: (value: string) => void;
  padWellsPerGroup: string;
  setPadWellsPerGroup: (value: string) => void;
  padWellSpacingM: string;
  setPadWellSpacingM: (value: string) => void;
  padGroupSpacingM: string;
  setPadGroupSpacingM: (value: string) => void;
  padMarginLeftM: string;
  setPadMarginLeftM: (value: string) => void;
  padMarginBottomM: string;
  setPadMarginBottomM: (value: string) => void;
  padMarginTopM: string;
  setPadMarginTopM: (value: string) => void;
  padMarginEndM: string;
  setPadMarginEndM: (value: string) => void;
  rotationDeg: string;
  setRotationDeg: (value: string) => void;
  generating: boolean;
  onGenerate: () => void;
  hasPreview?: boolean;
  wellCountOnCanvas?: number;
  padWellCountDerivedFromBottomholes?: boolean;
  linkedBottomholesCount?: number;
}

function GeneratorField({
  label,
  value,
  readOnly,
  onChange,
  min = 0,
  max,
  step = 'any',
  hint,
  title,
  onBlur,
}: {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  hint?: string;
  title?: string;
  onBlur?: () => void;
}) {
  return (
    <label className="pad-earthwork-sketch-modal__generator-field">
      <span className="pad-earthwork-sketch-modal__generator-label">{label}</span>
      <input
        className="input pad-earthwork-sketch-modal__generator-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hint && <span className="pad-earthwork-sketch-modal__generator-field-hint">{hint}</span>}
    </label>
  );
}

export function PlanGeneratorPanel({
  readOnly,
  padWellCount,
  setPadWellCount,
  padWellsPerGroup,
  setPadWellsPerGroup,
  padWellSpacingM,
  setPadWellSpacingM,
  padGroupSpacingM,
  setPadGroupSpacingM,
  padMarginLeftM,
  setPadMarginLeftM,
  padMarginBottomM,
  setPadMarginBottomM,
  padMarginTopM,
  setPadMarginTopM,
  padMarginEndM,
  setPadMarginEndM,
  rotationDeg,
  setRotationDeg,
  generating,
  onGenerate,
  hasPreview = false,
  wellCountOnCanvas = 0,
  padWellCountDerivedFromBottomholes = false,
  linkedBottomholesCount = 0,
}: PlanGeneratorPanelProps) {
  const canGenerate =
    parsePositive(padWellCount) != null &&
    parsePositive(padWellsPerGroup) != null &&
    parsePositive(padWellSpacingM) != null &&
    parseNonNegative(padGroupSpacingM) != null &&
    parseNonNegative(padMarginLeftM) != null &&
    parseNonNegative(padMarginBottomM) != null &&
    parseNonNegative(padMarginTopM) != null &&
    parseNonNegative(padMarginEndM) != null;

  const estimate = useMemo(() => {
    if (!canGenerate) return null;
    try {
      const fields = padWellFieldsFromForm({
        padWellCount,
        padWellsPerGroup,
        padWellSpacingM,
        padGroupSpacingM,
        padMarginLeftM,
        padMarginBottomM,
        padMarginTopM,
        padMarginEndM,
      });
      const rotRaw = rotationDeg.trim().replace(',', '.');
      const rotation = rotRaw === '' ? DEFAULT_PAD_NDS_DEG : Number(rotRaw);
      const result = generatePadFromWells({
        wellCount: fields.wellCount,
        wellsPerGroup: fields.wellsPerGroup,
        wellSpacingM: fields.wellSpacingM,
        groupSpacingM: fields.groupSpacingM,
        margins: {
          leftM: fields.leftM,
          bottomM: fields.bottomM,
          topM: fields.topM,
          endM: fields.endM,
        },
        rotationDeg: Number.isFinite(rotation) ? clampNdsDeg(rotation) : DEFAULT_PAD_NDS_DEG,
      });
      return {
        lengthM: result.lengthM,
        widthM: result.widthM,
        areaM2: result.footprintAreaM2,
        wellCount: fields.wellCount,
      };
    } catch (err) {
      if (err instanceof PadWellLayoutError) return null;
      throw err;
    }
  }, [
    canGenerate,
    padWellCount,
    padWellsPerGroup,
    padWellSpacingM,
    padGroupSpacingM,
    padMarginLeftM,
    padMarginBottomM,
    padMarginTopM,
    padMarginEndM,
    rotationDeg,
  ]);

  return (
    <div className="pad-earthwork-sketch-modal__generator-panel">
      <div className="pad-earthwork-sketch-modal__generator-header">
        <h3 className="pad-earthwork-sketch-modal__section-title">Параметры</h3>
        <span
          className={`pad-earthwork-sketch-modal__generator-status${
            hasPreview
              ? ' pad-earthwork-sketch-modal__generator-status--ready'
              : ' pad-earthwork-sketch-modal__generator-status--empty'
          }`}
        >
          {hasPreview ? `На холсте · ${wellCountOnCanvas} скв.` : 'Нет предпросмотра'}
        </span>
      </div>

      <p className="pad-earthwork-sketch-modal__generator-hint">
        Якорь (0,0) = первая скважина = точка на карте. Сохранение параметров — «Сохранить» на
        карточке объекта.
      </p>

      <div className="pad-earthwork-sketch-modal__generator-block">
        <h4 className="pad-earthwork-sketch-modal__generator-block-title">Скважины</h4>
        <div className="pad-earthwork-sketch-modal__generator-grid">
          <GeneratorField
            label="Кол-во"
            value={padWellCount}
            readOnly={readOnly || padWellCountDerivedFromBottomholes}
            min={1}
            step={1}
            hint={
              padWellCountDerivedFromBottomholes
                ? `По забоям на карте (${linkedBottomholesCount})`
                : undefined
            }
            onChange={setPadWellCount}
          />
          <GeneratorField
            label="В группе"
            value={padWellsPerGroup}
            readOnly={readOnly}
            min={1}
            step={1}
            onChange={setPadWellsPerGroup}
          />
          <GeneratorField
            label="Шаг, м"
            value={padWellSpacingM}
            readOnly={readOnly}
            onChange={setPadWellSpacingM}
          />
          <GeneratorField
            label="Между группами, м"
            value={padGroupSpacingM}
            readOnly={readOnly}
            onChange={setPadGroupSpacingM}
          />
        </div>
      </div>

      <div className="pad-earthwork-sketch-modal__generator-block">
        <h4 className="pad-earthwork-sketch-modal__generator-block-title">Отступы контура, м</h4>
        <div className="pad-earthwork-sketch-modal__generator-grid">
          <GeneratorField
            label="Слева"
            value={padMarginLeftM}
            readOnly={readOnly}
            onChange={setPadMarginLeftM}
          />
          <GeneratorField
            label="Справа"
            value={padMarginEndM}
            readOnly={readOnly}
            onChange={setPadMarginEndM}
          />
          <GeneratorField
            label="Вниз"
            value={padMarginBottomM}
            readOnly={readOnly}
            onChange={setPadMarginBottomM}
          />
          <GeneratorField
            label="Вверх"
            value={padMarginTopM}
            readOnly={readOnly}
            onChange={setPadMarginTopM}
          />
        </div>
      </div>

      <div className="pad-earthwork-sketch-modal__generator-block">
        <GeneratorField
          label="НДС, °"
          value={rotationDeg}
          readOnly={readOnly}
          min={0}
          max={360}
          step={1}
          title="НДС — направление ряда скважин от первой к последней"
          hint={`Азимут от севера по часовой: 0° — на север, 90° — на восток, 180° — на юг (ряд сверху вниз). По умолчанию ${DEFAULT_PAD_NDS_DEG}°.`}
          onChange={(v) => setRotationDeg(v)}
          onBlur={() => setRotationDeg(String(clampNdsDeg(Number(rotationDeg.replace(',', '.')) || DEFAULT_PAD_NDS_DEG)))}
        />
      </div>

      {estimate && (
        <div className="pad-earthwork-sketch-modal__generator-estimate">
          <span>Оценка контура</span>
          <strong>
            {Math.round(estimate.lengthM)} × {Math.round(estimate.widthM)} м ·{' '}
            {Math.round(estimate.areaM2).toLocaleString('ru-RU')} м²
          </strong>
        </div>
      )}

      {!readOnly && (
        <button
          type="button"
          className="btn btn-primary pad-earthwork-sketch-modal__generator-btn"
          disabled={!canGenerate || generating}
          onClick={onGenerate}
        >
          <Sparkles size={16} aria-hidden />
          {generating ? 'Генерация…' : 'Сгенерировать'}
        </button>
      )}
    </div>
  );
}
