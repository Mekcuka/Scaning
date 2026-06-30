import { useMemo, useState } from 'react';
import { Button } from 'antd';
import { LINE_SUBTYPES, SUBTYPE_LABELS, type InfraObject } from '../../lib/api';
import {
  FOOTPRINT_CARDINAL_OPTIONS,
  type FootprintCardinalAttachTemplate,
  type FootprintCardinalDirection,
  type FootprintLineConnectionTemplate,
} from '../../lib/padFootprintLineAttach';
import { resolveFootprintLonLat } from '../../lib/padFootprintGeo';
import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FootprintConnectionTemplatePreview } from './FootprintConnectionTemplatePreview';
import {
  linePreviewColor,
  templateEntryBadgeLabel,
} from './footprintConnectionTemplateUi';

const REFERENCE_PAD = {
  lon: 37.6,
  lat: 55.75,
  properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 0 },
} as const;

const COMPASS: { value: FootprintCardinalDirection; label: string }[] = [
  { value: 'north', label: 'С' },
  { value: 'west', label: 'З' },
  { value: 'east', label: 'В' },
  { value: 'south', label: 'Ю' },
];

function templateEntryForSubtype(
  template: FootprintLineConnectionTemplate,
  lineSubtype: string,
): FootprintCardinalAttachTemplate | null | undefined {
  if (!(lineSubtype in template)) return undefined;
  return template[lineSubtype];
}

interface FootprintLineConnectionTemplateFormProps {
  template: FootprintLineConnectionTemplate;
  onChange: (next: FootprintLineConnectionTemplate) => void;
  readOnly?: boolean;
}

export function FootprintLineConnectionTemplateForm({
  template,
  onChange,
  readOnly = false,
}: FootprintLineConnectionTemplateFormProps) {
  const [activeLineSubtype, setActiveLineSubtype] = useState<string>(LINE_SUBTYPES[0]!);

  const referenceRing = useMemo(() => {
    const obj = { subtype: 'oil_pad', ...REFERENCE_PAD } as InfraObject;
    return resolveFootprintLonLat(obj);
  }, []);

  const activeEntry = templateEntryForSubtype(template, activeLineSubtype);
  const selectValue =
    activeEntry === null
      ? '__center__'
      : activeEntry === undefined
        ? ''
        : activeEntry.cardinal;
  const activeT = activeEntry && activeEntry !== null ? (activeEntry.t ?? 0.5) : 0.5;
  const activeLabel = SUBTYPE_LABELS[activeLineSubtype] ?? activeLineSubtype;
  const hasActiveEntry = activeLineSubtype in template;

  const setEntry = (lineSubtype: string, entry: FootprintCardinalAttachTemplate | null | undefined) => {
    const next = { ...template };
    if (entry === undefined) delete next[lineSubtype];
    else next[lineSubtype] = entry;
    onChange(next);
  };

  const setCardinal = (cardinal: FootprintCardinalDirection) => {
    setEntry(activeLineSubtype, { cardinal, t: activeT });
  };

  return (
    <div className="footprint-connect-template">
      <div className="footprint-connect-line-tabs" role="tablist" aria-label="Типы линий">
        {LINE_SUBTYPES.map((st) => {
          const badge = templateEntryBadgeLabel(template, st);
          const color = linePreviewColor(st);
          const isActive = activeLineSubtype === st;
          return (
            <button
              key={st}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`footprint-connect-line-tab${isActive ? ' footprint-connect-line-tab--active' : ''}`}
              onClick={() => setActiveLineSubtype(st)}
            >
              <span className="footprint-connect-line-tab__label">{SUBTYPE_LABELS[st] ?? st}</span>
              <span
                className="footprint-connect-line-tab__badge"
                style={{ borderColor: color, color: badge === '—' ? 'var(--text-muted)' : color }}
              >
                {badge}
              </span>
            </button>
          );
        })}
      </div>

      <div className="footprint-connect-template__body">
        <div className="footprint-connect-template__editor">
          <div className="footprint-connect-template__editor-head">
            <h3 className="footprint-connect-template__editor-title">{activeLabel}</h3>
            {hasActiveEntry && !readOnly && (
              <Button size="small" onClick={() => setEntry(activeLineSubtype, undefined)}>
                Сбросить
              </Button>
            )}
          </div>

          <div className="footprint-connect-compass" role="group" aria-label="Быстрый выбор стороны">
            {COMPASS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`footprint-connect-compass__btn${
                  selectValue === value ? ' footprint-connect-compass__btn--active' : ''
                }`}
                disabled={readOnly}
                onClick={() => setCardinal(value)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`footprint-connect-compass__btn footprint-connect-compass__btn--center${
                selectValue === '__center__' ? ' footprint-connect-compass__btn--active' : ''
              }`}
              disabled={readOnly}
              onClick={() => setEntry(activeLineSubtype, null)}
            >
              Центр
            </button>
          </div>

          <div className="footprint-connect-template__row">
            <AppSelect
              variant="compact"
              value={selectValue}
              readOnly={readOnly}
              placeholder="Не задано"
              onChange={(value) => {
                if (!value) {
                  setEntry(activeLineSubtype, undefined);
                  return;
                }
                if (value === '__center__') {
                  setEntry(activeLineSubtype, null);
                  return;
                }
                setEntry(activeLineSubtype, {
                  cardinal: value as FootprintCardinalDirection,
                  t: activeT,
                });
              }}
              options={[
                { value: '', label: 'Не задано' },
                { value: '__center__', label: 'К центру площадки' },
                ...FOOTPRINT_CARDINAL_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                })),
              ]}
            />
            {selectValue !== '' && selectValue !== '__center__' && (
              <label className="footprint-connect-template__t-field">
                <span className="footprint-connect-template__t-label">
                  Позиция вдоль стороны (0…1)
                </span>
                <DeferredNumberInput
                  min={0}
                  max={1}
                  className="parameters-table__input footprint-connect-template__t-input"
                  value={activeT}
                  readOnly={readOnly}
                  onCommit={(v) => {
                    if (v == null || !Number.isFinite(v)) return;
                    const clamped = Math.max(0, Math.min(1, v));
                    setEntry(activeLineSubtype, {
                      cardinal: selectValue as FootprintCardinalDirection,
                      t: clamped,
                    });
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {referenceRing && (
          <FootprintConnectionTemplatePreview
            ring={referenceRing}
            anchorLon={REFERENCE_PAD.lon}
            anchorLat={REFERENCE_PAD.lat}
            template={template}
            activeLineSubtype={activeLineSubtype}
            readOnly={readOnly}
            onActiveLineSubtypeChange={setActiveLineSubtype}
            onPick={(lineSubtype, cardinal, t) => {
              setEntry(lineSubtype, { cardinal, t: Math.max(0, Math.min(1, t)) });
            }}
          />
        )}
      </div>
    </div>
  );
}

export function templateHasEntries(template: FootprintLineConnectionTemplate): boolean {
  return Object.keys(template).length > 0;
}
