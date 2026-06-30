import type { ReactNode } from 'react';
import { Calculator, Mountain, Route } from 'lucide-react';
import { Input } from 'antd';
import { AppSelect } from '../AppSelect';
import type { PadClusteringCalcDraft, AziReference } from '../../lib/padClusteringCalcSettings';
import { AZI_REFERENCE_OPTIONS, ERROR_MODEL_OPTIONS } from '../../lib/padClusteringCalcSettings';
import { GS_HEEL_LABEL } from '../../lib/wellBottomholeProperties';

type Props = {
  readOnly: boolean;
  draft: PadClusteringCalcDraft;
  patchDraft: (patch: Partial<PadClusteringCalcDraft>) => void;
  demAvailable: boolean;
  demSource: string | null;
};

function CalcField({
  label,
  hint,
  span = 1,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  span?: 1 | 2;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`pad-clustering-field pad-clustering-field--cell${
        span === 2 ? ' pad-clustering-field--span2' : ''
      }${className ? ` ${className}` : ''}`}
    >
      <span className="pad-clustering-field__label">{label}</span>
      {children}
      {hint ? <span className="pad-clustering-field__hint">{hint}</span> : null}
    </label>
  );
}

function CalcSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pad-clustering-calc-subsection">
      <h4 className="pad-clustering-calc-subsection__title">{title}</h4>
      <div className="pad-clustering-field-grid">{children}</div>
    </div>
  );
}

function CalcGroup({
  title,
  library,
  hint,
  icon,
  children,
}: {
  title: string;
  library: string;
  hint: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pad-clustering-calc-group">
      <header className="pad-clustering-calc-group__head">
        <span className="pad-clustering-calc-group__icon" aria-hidden>
          {icon}
        </span>
        <div className="pad-clustering-calc-group__head-text">
          <div className="pad-clustering-calc-group__title-row">
            <h3 className="pad-clustering-calc-group__title">{title}</h3>
            <span className="pad-clustering-badge">{library}</span>
          </div>
        </div>
      </header>
      <p className="pad-clustering-calc-group__hint">{hint}</p>
      {children}
    </section>
  );
}

export function PadClusteringCalculationPanel({
  readOnly,
  draft,
  patchDraft,
  demAvailable,
  demSource,
}: Props) {
  return (
    <div className="pad-clustering-calc">
      <header className="pad-clustering-calc__header">
        <Calculator size={16} aria-hidden />
        <span>Параметры расчёта</span>
      </header>

      <CalcGroup
        title="Траектория"
        library="welleng"
        hint="Влияют на плотность станций, построение ГС и проверку anti-collision (SF)."
        icon={<Route size={15} strokeWidth={2} />}
      >
        <CalcSubsection title="Станции и азимут">
          <CalcField label="Шаг станций (survey), м">
            <Input
              type="number"
              min={1}
              max={500}
              step={1}
              value={draft.stepM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ stepM: e.target.value })}
            />
          </CalcField>
          <CalcField label="Система азимута">
            <AppSelect
              options={AZI_REFERENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={draft.aziReference}
              onChange={(v) => patchDraft({ aziReference: v as AziReference })}
              disabled={readOnly}
              ariaLabel="Система азимута"
              fullWidth
            />
          </CalcField>
          <CalcField label="Модель погрешностей" span={2} hint="ISCWSA — для расчёта clearance между скважинами">
            <Input
              list="pad-clustering-error-models"
              value={draft.errorModel}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ errorModel: e.target.value })}
            />
            <datalist id="pad-clustering-error-models">
              {ERROR_MODEL_OPTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </CalcField>
          <CalcField
            label="DLS проектирования, °/30 м"
            span={2}
            hint="Ограничение искривления connector welleng при расчёте ННБ и ГС"
          >
            <Input
              type="number"
              min={0.1}
              max={30}
              step={0.1}
              value={draft.dlsDesign}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ dlsDesign: e.target.value })}
            />
          </CalcField>
        </CalcSubsection>

        <CalcSubsection title="Глубины">
          <CalcField label="TVD заготовки, м" hint="Вертикальный участок от устья">
            <Input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={draft.stubTvdM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ stubTvdM: e.target.value })}
            />
          </CalcField>
          <CalcField label="TVD забоя по умолч., м" hint="Если у забоя на карте TVD не задан">
            <Input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={draft.defaultTvdM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ defaultTvdM: e.target.value })}
            />
          </CalcField>
        </CalcSubsection>

        <CalcSubsection title="Горизонтальные скважины">
          <CalcField label={`Inc на ${GS_HEEL_LABEL} (ГС), °`}>
            <Input
              type="number"
              min={0}
              max={180}
              step={1}
              value={draft.incHeel}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ incHeel: e.target.value })}
            />
          </CalcField>
          <CalcField label="Шаг поиска входа ГС, м">
            <Input
              type="number"
              min={1}
              max={500}
              step={1}
              value={draft.gsEntrySearchStepM}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ gsEntrySearchStepM: e.target.value })}
            />
          </CalcField>
          <CalcField label="Порог SF" span={2} hint="Предупреждение anti-collision ниже этого значения">
            <Input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={draft.sfWarningThreshold}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => patchDraft({ sfWarningThreshold: e.target.value })}
            />
          </CalcField>
        </CalcSubsection>
      </CalcGroup>

      <CalcGroup
        title="Земляные работы и 3D"
        library="earthwork"
        hint="Оболочка влияет на объёмы cut/fill; рельеф — на отображение DEM в сцене."
        icon={<Mountain size={15} strokeWidth={2} />}
      >
        <CalcSubsection title="Оболочка площадки">
          <label className="pad-clustering-field pad-clustering-field--cell pad-clustering-field--span2 pad-clustering-field--checkbox">
            <input
              type="checkbox"
              checked={draft.envelopeEnabled}
              disabled={readOnly}
              onChange={(e) => patchDraft({ envelopeEnabled: e.target.checked })}
            />
            <span className="pad-clustering-field__label">Оболочка (envelope) вокруг контура</span>
          </label>
          <CalcField label="Ширина оболочки, м">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft.envelopeWrapWidthM}
              readOnly={readOnly}
              disabled={readOnly || !draft.envelopeEnabled}
              onChange={(e) => patchDraft({ envelopeWrapWidthM: e.target.value })}
            />
          </CalcField>
        </CalcSubsection>

        <CalcSubsection title="Рельеф">
          <div className="pad-clustering-field pad-clustering-field--cell pad-clustering-field--span2 pad-clustering-field--readonly">
            <span className="pad-clustering-field__label">Источник высот</span>
            <div className="pad-clustering-calc-terrain">
              <span
                className={`pad-clustering-badge pad-clustering-badge--${
                  demAvailable ? 'ok' : 'warn'
                }`}
              >
                {demAvailable ? 'DEM' : 'Плоский'}
              </span>
              <p>
                {demAvailable
                  ? demSource
                    ? `Цифровая модель рельефа · ${demSource}`
                    : 'Цифровая модель рельефа подключена'
                  : 'Загрузите DEM на карте для учёта рельефа'}
              </p>
            </div>
          </div>
        </CalcSubsection>
      </CalcGroup>
    </div>
  );
}
