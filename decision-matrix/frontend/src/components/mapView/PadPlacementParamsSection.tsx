import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { PadPlacementParams } from '../../lib/padPlacementTypes';

type Props = {
  params: PadPlacementParams;
  onChange: (next: PadPlacementParams) => void;
  subtype: 'oil_pad' | 'gas_pad';
  onSubtypeChange: (v: 'oil_pad' | 'gas_pad') => void;
  disabled?: boolean;
};

function NumField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  id: string;
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="autoroad-params__field" htmlFor={id}>
      <span className="autoroad-params__label">{label}</span>
      <span className="autoroad-params__control">
        <input
          id={id}
          type="number"
          className="autoroad-params__input autoroad-params__input--num"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit ? <span className="autoroad-params__unit">{unit}</span> : null}
      </span>
    </label>
  );
}

export function PadPlacementParamsSection({
  params,
  onChange,
  subtype,
  onSubtypeChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const patch = (partial: Partial<PadPlacementParams>) => onChange({ ...params, ...partial });

  const summary = `${params.max_wells_per_pad ?? 12} скв/куст · ${params.min_pad_spacing_m ?? 200} м`;

  const centerOptimize = params.center_optimize !== false;

  return (
    <section className="autoroad-params pad-placement-params">
      <button
        type="button"
        className="autoroad-params__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        <span className="autoroad-params__head-title">Параметры</span>
        {!open ? <span className="autoroad-params__head-summary">{summary}</span> : null}
      </button>

      {open ? (
        <div className="autoroad-params__body">
          <div className="autoroad-params__form">
            <div className="autoroad-params__grid">
              <NumField
                id="pad-placement-max-wells"
                label="Макс. скважин на куст"
                value={params.max_wells_per_pad ?? 12}
                min={1}
                max={64}
                disabled={disabled}
                onChange={(v) => patch({ max_wells_per_pad: v })}
              />
              <NumField
                id="pad-placement-spacing"
                label="Мин. расстояние кустов"
                unit="м"
                value={params.min_pad_spacing_m ?? 200}
                min={0}
                max={5000}
                step={10}
                disabled={disabled}
                onChange={(v) => patch({ min_pad_spacing_m: v })}
              />
              <NumField
                id="pad-placement-step"
                label="Шаг design"
                unit="м"
                value={params.step_m ?? 30}
                min={5}
                max={100}
                disabled={disabled}
                onChange={(v) => patch({ step_m: v })}
              />
              <label className="autoroad-params__field" htmlFor="pad-placement-subtype">
                <span className="autoroad-params__label">Тип куста</span>
                <span className="autoroad-params__control">
                  <select
                    id="pad-placement-subtype"
                    className="autoroad-params__input"
                    value={subtype}
                    disabled={disabled}
                    onChange={(e) => onSubtypeChange(e.target.value as 'oil_pad' | 'gas_pad')}
                  >
                    <option value="oil_pad">Нефтяной</option>
                    <option value="gas_pad">Газовый</option>
                  </select>
                </span>
              </label>
            </div>

            <div className="autoroad-params__checks">
              <label className="autoroad-params__check">
                <input
                  type="checkbox"
                  checked={Boolean(params.sf_check)}
                  disabled={disabled}
                  onChange={(e) => patch({ sf_check: e.target.checked })}
                />
                Учитывать SF
              </label>
            </div>

            {params.sf_check ? (
              <div className="autoroad-params__grid">
                <NumField
                  id="pad-placement-sf-threshold"
                  label="Порог SF"
                  value={params.sf_threshold ?? 1}
                  min={0.1}
                  max={10}
                  step={0.1}
                  disabled={disabled}
                  onChange={(v) => patch({ sf_threshold: v })}
                />
              </div>
            ) : null}

            <div className="pad-placement-params__advanced">
              <button
                type="button"
                className="pad-placement-params__advanced-toggle"
                onClick={() => setAdvancedOpen((v) => !v)}
                aria-expanded={advancedOpen}
              >
                {advancedOpen ? (
                  <ChevronDown size={14} aria-hidden />
                ) : (
                  <ChevronRight size={14} aria-hidden />
                )}
                Расширенные
              </button>
              {advancedOpen ? (
                <div className="autoroad-params__grid pad-placement-params__advanced-body">
                  <label className="autoroad-params__check pad-placement-params__advanced-check">
                    <input
                      type="checkbox"
                      checked={centerOptimize}
                      disabled={disabled}
                      onChange={(e) => patch({ center_optimize: e.target.checked })}
                    />
                    Оптимизировать положение куста (Σ MD)
                  </label>
                  <p className="pad-placement-params__advanced-hint">
                    Перебор центра вокруг забоев; увеличивает время расчёта.
                  </p>
                  {centerOptimize ? (
                    <>
                      <NumField
                        id="pad-placement-center-radius"
                        label="Радиус поиска"
                        unit="м"
                        value={params.center_search_radius_m ?? 400}
                        min={100}
                        max={2000}
                        step={50}
                        disabled={disabled}
                        onChange={(v) => patch({ center_search_radius_m: v })}
                      />
                      <NumField
                        id="pad-placement-center-step"
                        label="Шаг сетки"
                        unit="м"
                        value={params.center_search_step_m ?? 200}
                        min={50}
                        max={500}
                        step={25}
                        disabled={disabled}
                        onChange={(v) => patch({ center_search_step_m: v })}
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
