import { SAND_VOLUME_INPUT_MODE_OPTIONS, type SandVolumeInputMode } from '../../lib/infraSandVolumes';
import type { SandLogisticsResult } from '../../lib/api';
import { AppSelect } from '../AppSelect';
import { SandHaulLegDetails } from '../logistics/SandHaulLegDetails';
import { SandVolumeYearPlanEditor } from '../logistics/SandVolumeYearPlanEditor';
import { FieldLabel, PanelSection } from './panelUi';

interface InfraDetailLogisticsTabProps {
  showSandQuarryFields: boolean;
  showSandDemandField: boolean;
  readOnly: boolean;
  sandInitialM3: string;
  setSandInitialM3: (value: string) => void;
  sandCurrentM3: string;
  setSandCurrentM3: (value: string) => void;
  sandVolumeMode: SandVolumeInputMode;
  setSandVolumeMode: (value: SandVolumeInputMode) => void;
  sandDemandM3: string;
  setSandDemandM3: (value: string) => void;
  sandVolumeByYear: Record<string, number>;
  setSandVolumeByYear: (value: Record<string, number>) => void;
  infraObjectId: string | null;
  sandLogistics: SandLogisticsResult | undefined;
  quarryVolumeWarning: boolean | '' | 0;
}

export function InfraDetailLogisticsTab({
  showSandQuarryFields,
  showSandDemandField,
  readOnly,
  sandInitialM3,
  setSandInitialM3,
  sandCurrentM3,
  setSandCurrentM3,
  sandVolumeMode,
  setSandVolumeMode,
  sandDemandM3,
  setSandDemandM3,
  sandVolumeByYear,
  setSandVolumeByYear,
  infraObjectId,
  sandLogistics,
  quarryVolumeWarning,
}: InfraDetailLogisticsTabProps) {
  return (
    <>
      {(showSandQuarryFields || showSandDemandField) && (
        <PanelSection title="Песок">
          {showSandQuarryFields && (
            <div className="object-detail-panel__coord-grid">
              <label className="object-detail-panel__field">
                <FieldLabel>Изначальный объём, м³</FieldLabel>
                <input
                  className="input object-detail-panel__input"
                  type="number"
                  min={0}
                  step="any"
                  value={sandInitialM3}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setSandInitialM3(e.target.value)}
                />
              </label>
              <label className="object-detail-panel__field">
                <FieldLabel>Текущий объём, м³</FieldLabel>
                <input
                  className="input object-detail-panel__input"
                  type="number"
                  min={0}
                  step="any"
                  value={sandCurrentM3}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setSandCurrentM3(e.target.value)}
                />
              </label>
            </div>
          )}
          {showSandDemandField && (
            <>
              <label className="object-detail-panel__field">
                <FieldLabel>Способ задания спроса</FieldLabel>
                <AppSelect
                  variant="sm"
                  fullWidth
                  ariaLabel="Способ задания объёма песка"
                  options={SAND_VOLUME_INPUT_MODE_OPTIONS}
                  value={sandVolumeMode}
                  disabled={readOnly}
                  onChange={(value) => {
                    if (value === 'single' || value === 'yearly') {
                      setSandVolumeMode(value);
                    }
                  }}
                />
              </label>
              {sandVolumeMode === 'single' ? (
                <label className="object-detail-panel__field">
                  <FieldLabel>Объём песка (спрос), м³</FieldLabel>
                  <input
                    className="input object-detail-panel__input"
                    type="number"
                    min={0}
                    step="any"
                    value={sandDemandM3}
                    readOnly={readOnly}
                    disabled={readOnly}
                    onChange={(e) => setSandDemandM3(e.target.value)}
                  />
                  <p className="object-detail-panel__hint text-xs">
                    Полный объём спроса учитывается с даты ввода объекта.
                  </p>
                </label>
              ) : (
                <div className="object-detail-panel__subsection">
                  <SandVolumeYearPlanEditor
                    key={`${infraObjectId ?? 'sand-plan'}-${sandVolumeMode}`}
                    value={sandVolumeByYear}
                    onChange={setSandVolumeByYear}
                    readOnly={readOnly}
                  />
                </div>
              )}
            </>
          )}
          {showSandDemandField && infraObjectId && (
            <div className="object-detail-panel__subsection">
              <h4 className="object-detail-panel__subsection-title">Плечо возки</h4>
              <SandHaulLegDetails
                variant="panel"
                objectId={infraObjectId}
                sandLogistics={sandLogistics ?? undefined}
                asOf={sandLogistics?.as_of}
              />
            </div>
          )}
          {quarryVolumeWarning && (
            <p className="object-detail-panel__hint text-amber-600">
              Текущий объём больше изначального.
            </p>
          )}
        </PanelSection>
      )}
    </>
  );
}
