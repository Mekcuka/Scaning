import { DimensionStepper } from './DimensionStepper';

export type EnvelopeSectionProps = {
  envelopeEnabled: boolean;
  onEnvelopeEnabledChange: (enabled: boolean) => void;
  wrapWidthM: number;
  onWrapWidthMChange: (value: number) => void;
  readOnly: boolean;
  disabled?: boolean;
  snapEnabled?: boolean;
};

export function EnvelopeSection({
  envelopeEnabled,
  onEnvelopeEnabledChange,
  wrapWidthM,
  onWrapWidthMChange,
  readOnly,
  disabled = false,
  snapEnabled = true,
}: EnvelopeSectionProps) {
  return (
    <div className="pad-earthwork-sketch-modal__section">
      <h3 className="pad-earthwork-sketch-modal__section-title">Обволование</h3>
      <label className="pad-earthwork-sketch-modal__checkbox-row">
        <input
          type="checkbox"
          checked={envelopeEnabled}
          disabled={readOnly || disabled}
          onChange={(e) => onEnvelopeEnabledChange(e.target.checked)}
        />
        <span>Включить песчаную обваловку по контуру верха насыпи</span>
      </label>
      {envelopeEnabled && (
        <>
          <DimensionStepper
            label="Ширина подошвы W"
            value={wrapWidthM}
            step={snapEnabled ? 1 : 0.5}
            min={0.5}
            max={100}
            readOnly={readOnly}
            onChange={onWrapWidthMChange}
          />
          <p className="object-detail-panel__hint text-xs">
            Кольцо на проектной отметке: подошва W, откосы 1:1, бровка на H = (W−TW)/2, TW = W/3.
            Оценка объёма обваловки: периметр × H × (W+TW)/2. «Рассчитать» — упрощённая формула planner
            (см. предупреждение в результате).
          </p>
        </>
      )}
    </div>
  );
}
