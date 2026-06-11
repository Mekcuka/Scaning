import { useState, type ReactNode } from 'react';
import { PanelSection } from '../objectDetailPanel/panelUi';
import {
  KM_PER_PAD_FIELDS,
  MAX_TOTAL_LINE_FIELDS,
  POI_SECTION_LABELS,
  THRESHOLD_FIELDS,
  type PoiSectionId,
} from '../../lib/poiParams';
import { PoiAccordionSection } from './PoiAccordionSection';
import { PoiBasicAccordionSection } from './PoiBasicAccordionSection';
import { PoiBasicFlatSection } from './PoiBasicFlatSection';
import { ALL_POI_SECTIONS } from './constants';
import { PoiEngineeringSection } from './PoiEngineeringSection';
import { PoiThresholdAccordion, PoiThresholdGrid } from './PoiThresholdGrid';
import type { PoiParamsFormProps } from './types';

export function PoiParamsForm({
  value,
  onChange,
  defaults,
  readOnly,
  sections = ALL_POI_SECTIONS,
  coordsReadOnly = true,
  flat = false,
}: PoiParamsFormProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    engineering: false,
    thresholds: false,
    km_per_pad: false,
    max_total_line: false,
  });

  const patch = (partial: Partial<typeof value>) => onChange({ ...value, ...partial });
  const toggle = (id: PoiSectionId) =>
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const sectionProps = { value, patch, readOnly, defaults, coordsReadOnly };

  const wrapSection = (id: PoiSectionId, content: ReactNode) => {
    if (flat) {
      return (
        <PanelSection key={id} title={POI_SECTION_LABELS[id]} card>
          {content}
        </PanelSection>
      );
    }
    return (
      <PoiAccordionSection key={id} id={id} open={!!openSections[id]} onToggle={() => toggle(id)}>
        {content}
      </PoiAccordionSection>
    );
  };

  return (
    <div className={flat ? 'poi-params-form poi-params-form--flat' : 'text-sm'}>
      {sections.includes('basic') &&
        (flat ? (
          <PoiBasicFlatSection {...sectionProps} />
        ) : (
          wrapSection('basic', <PoiBasicAccordionSection {...sectionProps} />)
        ))}

      {sections.includes('engineering') &&
        wrapSection(
          'engineering',
          <PoiEngineeringSection {...sectionProps} flat={flat} />,
        )}

      {sections.includes('thresholds') &&
        wrapSection(
          'thresholds',
          flat ? (
            <PoiThresholdGrid
              {...sectionProps}
              fields={THRESHOLD_FIELDS}
              intro="Пустое поле — значение проекта по умолчанию"
            />
          ) : (
            <PoiThresholdAccordion
              {...sectionProps}
              fields={THRESHOLD_FIELDS}
              intro="Пустое поле — значение проекта по умолчанию"
            />
          ),
        )}

      {sections.includes('km_per_pad') &&
        wrapSection(
          'km_per_pad',
          flat ? (
            <PoiThresholdGrid
              {...sectionProps}
              fields={KM_PER_PAD_FIELDS.map((f) => ({ ...f, label: `${f.label}, км/КП` }))}
              intro="Нормы км/КП для расчёта internal linear"
            />
          ) : (
            <PoiThresholdAccordion
              {...sectionProps}
              fields={KM_PER_PAD_FIELDS.map((f) => ({ ...f, label: `${f.label}, км/КП` }))}
              intro="Нормы км/КП для расчёта internal linear"
            />
          ),
        )}

      {sections.includes('max_total_line') &&
        wrapSection(
          'max_total_line',
          flat ? (
            <PoiThresholdGrid
              {...sectionProps}
              fields={MAX_TOTAL_LINE_FIELDS.map((f) => ({ ...f, label: `${f.label}, км` }))}
              intro="Макс. суммарная длина internal linear"
            />
          ) : (
            <PoiThresholdAccordion
              {...sectionProps}
              fields={MAX_TOTAL_LINE_FIELDS.map((f) => ({ ...f, label: `${f.label}, км` }))}
              intro="Макс. суммарная длина internal linear"
            />
          ),
        )}
    </div>
  );
}
