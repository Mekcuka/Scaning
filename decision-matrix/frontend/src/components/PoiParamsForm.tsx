import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DistanceDefaults } from '../lib/api';
import { EngBadgeGroup } from './EngBadgeGroup';
import {
  ENG_PARAM_GROUPS,
  KM_PER_PAD_FIELDS,
  MAX_TOTAL_LINE_FIELDS,
  POI_SECTION_LABELS,
  THRESHOLD_FIELDS,
  calcPadsPreview,
  defaultHint,
  type PoiFormValues,
  type PoiSectionId,
} from '../lib/poiParams';

interface PoiParamsFormProps {
  value: PoiFormValues;
  onChange: (value: PoiFormValues) => void;
  defaults?: DistanceDefaults;
  readOnly?: boolean;
  sections?: PoiSectionId[];
  coordsReadOnly?: boolean;
}

const ALL_SECTIONS: PoiSectionId[] = ['basic', 'engineering', 'thresholds', 'km_per_pad', 'max_total_line'];

function Section({
  id,
  open,
  onToggle,
  children,
}: {
  id: PoiSectionId;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border rounded-lg mb-2" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-left"
        onClick={onToggle}
      >
        {POI_SECTION_LABELS[id]}
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-0">{children}</div>}
    </div>
  );
}

export function PoiParamsForm({
  value,
  onChange,
  defaults,
  readOnly,
  sections = ALL_SECTIONS,
  coordsReadOnly = true,
}: PoiParamsFormProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    engineering: false,
    thresholds: false,
    km_per_pad: false,
    max_total_line: false,
  });

  const patch = (partial: Partial<PoiFormValues>) => onChange({ ...value, ...partial });
  const toggle = (id: PoiSectionId) =>
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const { wells, pads } = calcPadsPreview(
    value.planned_production_volume,
    value.production_per_well,
    value.wells_per_pad
  );
  const volumeLabel =
    value.fluid_type === 'gas' ? 'Объём добычи газа (тыс. т/год)' : 'Объём добычи нефти (тыс. т/год)';

  return (
    <div className="text-sm">
      {sections.includes('basic') && (
        <Section id="basic" open={!!openSections.basic} onToggle={() => toggle('basic')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label>Название</label>
              <input
                value={value.name}
                readOnly={readOnly}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>
            <div className="form-group mb-0">
              <label>Флюид (FR-4.2.10)</label>
              <select
                value={value.fluid_type}
                disabled={readOnly}
                onChange={(e) => patch({ fluid_type: e.target.value as 'oil' | 'gas' })}
              >
                <option value="oil">Нефть</option>
                <option value="gas">Газ</option>
              </select>
            </div>
            <div className="form-group mb-0">
              <label>{volumeLabel}</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={value.planned_production_volume}
                readOnly={readOnly}
                onChange={(e) => patch({ planned_production_volume: +e.target.value })}
              />
            </div>
            <div className="form-group mb-0">
              <label>Объём закачки воды (тыс. т/год)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={value.water_injection_volume}
                readOnly={readOnly}
                onChange={(e) => patch({ water_injection_volume: +e.target.value })}
              />
            </div>
            <div className="form-group mb-0">
              <label>Добыча на 1 скважину (тыс. т/год)</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={value.production_per_well}
                readOnly={readOnly}
                onChange={(e) => patch({ production_per_well: +e.target.value })}
              />
            </div>
            <div className="form-group mb-0">
              <label>Скважин на КП</label>
              <input
                type="number"
                min={1}
                step={1}
                value={value.wells_per_pad}
                readOnly={readOnly}
                onChange={(e) => patch({ wells_per_pad: +e.target.value })}
              />
            </div>
            <div className="form-group mb-0 md:col-span-2">
              <label>Кустовые площадки (авто, FR-5.3.1)</label>
              <div className="text-xs py-2 px-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                Скважин: <strong>{wells.toFixed(1)}</strong> → КП: <strong>{pads} шт.</strong>
              </div>
            </div>
            <div className="form-group mb-0">
              <label>Долгота</label>
              <input
                value={value.lon}
                readOnly={readOnly || coordsReadOnly}
                step="0.001"
                onChange={(e) => patch({ lon: e.target.value })}
              />
            </div>
            <div className="form-group mb-0">
              <label>Широта</label>
              <input
                value={value.lat}
                readOnly={readOnly || coordsReadOnly}
                step="0.001"
                onChange={(e) => patch({ lat: e.target.value })}
              />
            </div>
            {!readOnly && (
              <div className="form-group mb-0 md:col-span-2">
                <label>Описание</label>
                <textarea
                  className="min-h-[52px]"
                  value={value.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </div>
            )}
          </div>
        </Section>
      )}

      {sections.includes('engineering') && (
        <Section id="engineering" open={!!openSections.engineering} onToggle={() => toggle('engineering')}>
          <div className="flex flex-wrap gap-4">
            {ENG_PARAM_GROUPS.map((g) => (
              <EngBadgeGroup
                key={g.key}
                label={g.label}
                badgeClass={g.badgeClass}
                options={[...g.options]}
                value={value[g.key]}
                readOnly={readOnly}
                onChange={(v) => patch({ [g.key]: v })}
              />
            ))}
          </div>
        </Section>
      )}

      {sections.includes('thresholds') && (
        <Section id="thresholds" open={!!openSections.thresholds} onToggle={() => toggle('thresholds')}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Пустое поле — значение проекта по умолчанию (FR-4.2.6, FR-4.2.9)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {THRESHOLD_FIELDS.map((f) => (
              <div key={f.key} className="form-group mb-0">
                <label>
                  {f.label}
                  {defaults && (
                    <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                      {defaultHint(defaults, f.defaultKey)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step={0.1}
                  placeholder={defaults ? String(defaults[f.defaultKey]) : ''}
                  value={value[f.key]}
                  readOnly={readOnly}
                  onChange={(e) => patch({ [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {sections.includes('km_per_pad') && (
        <Section id="km_per_pad" open={!!openSections.km_per_pad} onToggle={() => toggle('km_per_pad')}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Нормы км/КП для расчёта internal linear (FR-4.2.12, FR-5.3.4)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KM_PER_PAD_FIELDS.map((f) => (
              <div key={f.key} className="form-group mb-0">
                <label>
                  {f.label}, км/КП
                  {defaults && (
                    <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                      {defaultHint(defaults, f.defaultKey)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step={0.1}
                  placeholder={defaults ? String(defaults[f.defaultKey]) : ''}
                  value={value[f.key]}
                  readOnly={readOnly}
                  onChange={(e) => patch({ [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {sections.includes('max_total_line') && (
        <Section id="max_total_line" open={!!openSections.max_total_line} onToggle={() => toggle('max_total_line')}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Макс. суммарная длина internal linear (FR-4.2.13)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MAX_TOTAL_LINE_FIELDS.map((f) => (
              <div key={f.key} className="form-group mb-0">
                <label>
                  {f.label}, км
                  {defaults && (
                    <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                      {defaultHint(defaults, f.defaultKey)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step={0.1}
                  placeholder={defaults ? String(defaults[f.defaultKey]) : ''}
                  value={value[f.key]}
                  readOnly={readOnly}
                  onChange={(e) => patch({ [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
