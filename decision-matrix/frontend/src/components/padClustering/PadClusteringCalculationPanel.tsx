import type { ReactNode } from 'react';
import { AppSelect } from '../AppSelect';
import type { PadClusteringCalcDraft, AziReference } from '../../lib/padClusteringCalcSettings';
import { AZI_REFERENCE_OPTIONS, ERROR_MODEL_OPTIONS } from '../../lib/padClusteringCalcSettings';

type Props = {
  readOnly: boolean;
  draft: PadClusteringCalcDraft;
  patchDraft: (patch: Partial<PadClusteringCalcDraft>) => void;
  demAvailable: boolean;
  demSource: string | null;
};

function CalcGroup({
  title,
  library,
  hint,
  children,
}: {
  title: string;
  library: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="pad-clustering-calc-group">
      <header className="pad-clustering-calc-group__head">
        <div>
          <h3 className="pad-clustering-calc-group__title">{title}</h3>
          <p className="pad-clustering-calc-group__lib">{library}</p>
        </div>
      </header>
      <p className="pad-clustering-calc-group__hint">{hint}</p>
      <div className="pad-clustering-field-grid">{children}</div>
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
      <CalcGroup
        title="Траектория (welleng)"
        library="well-trajectory-planner"
        hint="Шаг survey и азимут влияют на плотность станций и расчёт connector / ГС."
      >
        <label className="pad-clustering-field">
          <span>Шаг survey, м</span>
          <input
            className="input"
            type="number"
            min={1}
            max={500}
            step={1}
            value={draft.stepM}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => patchDraft({ stepM: e.target.value })}
          />
        </label>
        <label className="pad-clustering-field">
          <span>Азимут (azi_reference)</span>
          <AppSelect
            options={AZI_REFERENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={draft.aziReference}
            onChange={(v) => patchDraft({ aziReference: v as AziReference })}
            disabled={readOnly}
            ariaLabel="Система азимута"
            fullWidth
          />
        </label>
        <label className="pad-clustering-field pad-clustering-field--span2">
          <span>Модель погрешностей (error_model)</span>
          <input
            className="input"
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
        </label>
        <label className="pad-clustering-field">
          <span>TVD заготовки, м</span>
          <input
            className="input"
            type="number"
            min={1}
            max={10000}
            step={1}
            value={draft.stubTvdM}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => patchDraft({ stubTvdM: e.target.value })}
          />
        </label>
        <label className="pad-clustering-field">
          <span>TVD забоя по умолч., м</span>
          <input
            className="input"
            type="number"
            min={1}
            max={10000}
            step={1}
            value={draft.defaultTvdM}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => patchDraft({ defaultTvdM: e.target.value })}
          />
        </label>
        <label className="pad-clustering-field">
          <span>Inc на heel (ГС), °</span>
          <input
            className="input"
            type="number"
            min={0}
            max={180}
            step={1}
            value={draft.incHeel}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => patchDraft({ incHeel: e.target.value })}
          />
        </label>
        <label className="pad-clustering-field">
          <span>Порог SF (anti-collision)</span>
          <input
            className="input"
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={draft.sfWarningThreshold}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => patchDraft({ sfWarningThreshold: e.target.value })}
          />
        </label>
      </CalcGroup>

      <CalcGroup
        title="Земляные работы и 3D"
        library="pad-earthwork-planner"
        hint="Оболочка площадки влияет на объёмы cut/fill и отображение DEM в 3D."
      >
        <label className="pad-clustering-field pad-clustering-field--span2 pad-clustering-field--checkbox">
          <input
            type="checkbox"
            checked={draft.envelopeEnabled}
            disabled={readOnly}
            onChange={(e) => patchDraft({ envelopeEnabled: e.target.checked })}
          />
          <span>Оболочка (envelope) вокруг контура</span>
        </label>
        <label className="pad-clustering-field">
          <span>Ширина оболочки, м</span>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={draft.envelopeWrapWidthM}
            readOnly={readOnly}
            disabled={readOnly || !draft.envelopeEnabled}
            onChange={(e) => patchDraft({ envelopeWrapWidthM: e.target.value })}
          />
        </label>
        <div className="pad-clustering-field pad-clustering-field--readonly">
          <span>Рельеф (terrain)</span>
          <p>
            {demAvailable
              ? `DEM${demSource ? ` · ${demSource}` : ''}`
              : 'Плоский (flat) — загрузите DEM на карте'}
          </p>
        </div>
      </CalcGroup>
    </div>
  );
}
