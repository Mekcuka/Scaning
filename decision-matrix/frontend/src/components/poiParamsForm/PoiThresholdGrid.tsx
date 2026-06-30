import type { DistanceDefaults } from '../../lib/api';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, ReadOnlyValue } from '../objectDetailPanel/panelUi';
import { defaultHint, type PoiFormValues } from '../../lib/poiParams';
import type { PoiSectionCommonProps } from './types';

type ThresholdField = {
  key: keyof PoiFormValues;
  label: string;
  defaultKey: keyof DistanceDefaults;
};

export function PoiThresholdGrid({
  fields,
  intro,
  value,
  patch,
  readOnly,
  defaults,
}: PoiSectionCommonProps & {
  fields: ThresholdField[];
  intro?: string;
}) {
  return (
    <>
      {intro && <p className="object-detail-panel__hint object-detail-panel__hint--intro">{intro}</p>}
      <div className="object-detail-panel__fields-grid">
        {fields.map((f) => (
          <label key={f.key} className="object-detail-panel__field">
            <FieldLabel>
              {f.label}
              {defaults && (
                <span className="object-detail-panel__label-default">
                  {defaultHint(defaults, f.defaultKey)}
                </span>
              )}
            </FieldLabel>
            {readOnly ? (
              <ReadOnlyValue placeholder={defaults ? String(defaults[f.defaultKey]) : '—'}>
                {value[f.key] ? String(value[f.key]) : null}
              </ReadOnlyValue>
            ) : (
              <DeferredNumberInput
                allowEmpty
                className="object-detail-panel__input"
                placeholder={defaults ? String(defaults[f.defaultKey]) : ''}
                value={value[f.key]}
                onCommit={(v) => patch({ [f.key]: String(v) })}
              />
            )}
          </label>
        ))}
      </div>
    </>
  );
}

export function PoiThresholdAccordion({
  fields,
  intro,
  value,
  patch,
  readOnly,
  defaults,
  columns = 2,
}: PoiSectionCommonProps & {
  fields: ThresholdField[];
  intro: string;
  columns?: 1 | 2;
}) {
  const gridClass =
    columns === 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3';

  return (
    <>
      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        {intro}
      </p>
      <div className={gridClass}>
        {fields.map((f) => (
          <div key={f.key} className="form-group mb-0">
            <label>
              {f.label}
              {defaults && (
                <span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  {defaultHint(defaults, f.defaultKey)}
                </span>
              )}
            </label>
            <DeferredNumberInput
              allowEmpty
              placeholder={defaults ? String(defaults[f.defaultKey]) : ''}
              value={value[f.key]}
              readOnly={readOnly}
              onCommit={(v) => patch({ [f.key]: String(v) })}
            />
          </div>
        ))}
      </div>
    </>
  );
}
