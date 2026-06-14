import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfraObject } from '../../lib/api';
import { wellTrajectoryApi } from '../../lib/api/wellTrajectoryApi';
import { readWellTrajectoryStepM } from '../../lib/padClusteringCalcSettings';
import { wellTrajectoryQueryKeys } from '../../hooks/useWellTrajectoryGeoJson';
import {
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_GS_ENTRY_MODE,
  DEFAULT_GS_ENTRY_MODE,
  GS_ENTRY_MODE_OPTIONS,
  readGsEntryMode,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_TOE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
  DEFAULT_NNB_INC,
  readBottomholeLinkedPadId,
  readBottomholeTvdM,
  readGsHeelTvdM,
  readGsToeTvdM,
} from '../../lib/wellBottomholeProperties';
import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, PanelSection, PanelSubsection, ReadOnlyValue } from './panelUi';
import { translateWellTrajectoryUserMessage } from '../../lib/wellTrajectoryUserMessages';

interface InfraBottomholeDetailSectionProps {
  projectId: string;
  infraObject: InfraObject;
  padOptions: InfraObject[];
  readOnly: boolean;
  onPropertiesChange: (patch: Record<string, unknown>) => void;
}

function NumberField({
  label,
  unit,
  value,
  readOnly,
  min,
  max,
  integer,
  allowEmpty,
  placeholder,
  onCommit,
}: {
  label: string;
  unit?: string;
  value: number | string;
  readOnly: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
  onCommit: (value: number | '') => void;
}) {
  return (
    <label className="object-detail-panel__field">
      <FieldLabel unit={unit}>{label}</FieldLabel>
      <div className="object-detail-panel__field-control">
        {readOnly ? (
          <ReadOnlyValue placeholder={placeholder ?? '—'}>
            {value === '' || value == null ? null : String(value)}
          </ReadOnlyValue>
        ) : (
          <DeferredNumberInput
            allowEmpty={allowEmpty}
            integer={integer}
            min={min}
            max={max}
            className="input object-detail-panel__input"
            placeholder={placeholder}
            value={value}
            onCommit={onCommit}
          />
        )}
      </div>
    </label>
  );
}

export function InfraBottomholeDetailSection({
  projectId,
  infraObject,
  padOptions,
  readOnly,
  onPropertiesChange,
}: InfraBottomholeDetailSectionProps) {
  const queryClient = useQueryClient();
  const props = infraObject.properties ?? {};
  const linkedPadId = readBottomholeLinkedPadId(props) ?? '';
  const isGsLine = infraObject.subtype === 'well_bottomhole_gs';
  const isGsHeelOrLine =
    infraObject.subtype === 'well_bottomhole_gs_heel' || isGsLine;
  const tvdM = readBottomholeTvdM(props);
  const heelTvdM = readGsHeelTvdM(props);
  const toeTvdM = readGsToeTvdM(props);
  const wellIndexRaw = props[WELL_BOTTOMHOLE_WELL_INDEX];
  const wellIndex =
    wellIndexRaw === '' || wellIndexRaw == null ? '' : String(wellIndexRaw);
  const targetInc = props[WELL_BOTTOMHOLE_TARGET_INC];
  const targetAzi = props[WELL_BOTTOMHOLE_TARGET_AZI];
  const gsHeelId = props[WELL_BOTTOMHOLE_GS_HEEL_ID];
  const gsEntryMode = readGsEntryMode(props);

  const linkedPad = padOptions.find((p) => p.id === linkedPadId);
  const stepM = readWellTrajectoryStepM({
    properties: linkedPad?.properties as Record<string, unknown> | undefined,
  });

  const padSelectOptions = [
    { value: '', label: '— выберите куст —' },
    ...padOptions.map((pad) => ({ value: pad.id, label: pad.name })),
  ];

  const designMut = useMutation({
    mutationFn: async () => {
      if (!linkedPadId) throw new Error('Укажите куст');
      return wellTrajectoryApi.designFromBottomholes(projectId, linkedPadId, { step_m: stepM });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
      if (linkedPadId) {
        void queryClient.invalidateQueries({
          queryKey: wellTrajectoryQueryKeys(projectId, linkedPadId).last,
        });
      }
    },
  });

  return (
    <PanelSection title="Параметры забоя" card>
      <label className="object-detail-panel__field">
        <FieldLabel>Куст</FieldLabel>
        <div className="object-detail-panel__field-control">
          <AppSelect
            variant="compact"
            value={linkedPadId}
            readOnly={readOnly || infraObject.subtype === 'well_bottomhole_gs_toe'}
            onChange={(value) =>
              onPropertiesChange({ [WELL_BOTTOMHOLE_LINKED_PAD_ID]: value || undefined })
            }
            options={padSelectOptions}
            placeholder="— выберите куст —"
          />
        </div>
      </label>

      <NumberField
        label="Скважина №"
        value={wellIndex}
        readOnly={readOnly}
        min={0}
        max={63}
        integer
        allowEmpty
        placeholder="Авто"
        onCommit={(v) =>
          onPropertiesChange({
            [WELL_BOTTOMHOLE_WELL_INDEX]: v === '' ? undefined : Number(v),
          })
        }
      />
      <p className="object-detail-panel__hint">0…63, пусто — номер подберётся автоматически.</p>

      {isGsLine ? (
        <div className="object-detail-panel__pair-grid">
          <div className="object-detail-panel__pair-grid-row">
            <FieldLabel unit="м">TVD heel</FieldLabel>
            <FieldLabel unit="м">TVD toe</FieldLabel>
          </div>
          <div className="object-detail-panel__pair-grid-row">
            <div className="object-detail-panel__field-control">
              {readOnly ? (
                <ReadOnlyValue>{heelTvdM}</ReadOnlyValue>
              ) : (
                <DeferredNumberInput
                  min={1}
                  className="input object-detail-panel__input"
                  value={heelTvdM}
                  onCommit={(v) => {
                    if (v === '' || !Number.isFinite(v)) return;
                    onPropertiesChange({ [WELL_BOTTOMHOLE_HEEL_TVD_M]: Number(v) });
                  }}
                />
              )}
            </div>
            <div className="object-detail-panel__field-control">
              {readOnly ? (
                <ReadOnlyValue>{toeTvdM}</ReadOnlyValue>
              ) : (
                <DeferredNumberInput
                  min={1}
                  className="input object-detail-panel__input"
                  value={toeTvdM}
                  onCommit={(v) => {
                    if (v === '' || !Number.isFinite(v)) return;
                    onPropertiesChange({ [WELL_BOTTOMHOLE_TOE_TVD_M]: Number(v) });
                  }}
                />
              )}
            </div>
          </div>
          <div className="object-detail-panel__pair-grid-row object-detail-panel__pair-grid-row--hints">
            <p className="object-detail-panel__hint">Синхронизируется с Z в геометрии.</p>
            <p className="object-detail-panel__hint">{'\u00a0'}</p>
          </div>
        </div>
      ) : (
        <NumberField
          label="TVD"
          unit="м"
          value={tvdM}
          readOnly={readOnly}
          min={1}
          onCommit={(v) => {
            if (v === '' || !Number.isFinite(v)) return;
            onPropertiesChange({ [WELL_BOTTOMHOLE_TVD_M]: Number(v) });
          }}
        />
      )}

      {infraObject.subtype === 'well_bottomhole_nnb' && (
        <NumberField
          label="Зенитный угол на забое"
          unit="°"
          value={targetInc ?? DEFAULT_NNB_INC}
          readOnly={readOnly}
          min={0}
          max={360}
          onCommit={(v) => {
            if (v === '' || !Number.isFinite(v)) return;
            onPropertiesChange({ [WELL_BOTTOMHOLE_TARGET_INC]: Number(v) });
          }}
        />
      )}

      {isGsHeelOrLine && (
        <>
          <label className="object-detail-panel__field">
            <FieldLabel>Точка входа при расчёте</FieldLabel>
            <div className="object-detail-panel__field-control">
              <AppSelect
                variant="compact"
                value={gsEntryMode}
                readOnly={readOnly}
                onChange={(value) =>
                  onPropertiesChange({
                    [WELL_BOTTOMHOLE_GS_ENTRY_MODE]: value || DEFAULT_GS_ENTRY_MODE,
                  })
                }
                options={GS_ENTRY_MODE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>
          </label>
          <p className="object-detail-panel__hint">
            «Любая» — алгоритм подберёт точку вдоль пятка–стока (min MD).
          </p>
        </>
      )}

      {(infraObject.subtype === 'well_bottomhole_nnb' ||
        infraObject.subtype === 'well_bottomhole_gs_toe') && (
        <NumberField
          label="Азимут цели"
          unit="°"
          value={targetAzi ?? ''}
          readOnly={readOnly}
          min={0}
          max={360}
          allowEmpty
          placeholder="Из схемы куста"
          onCommit={(v) =>
            onPropertiesChange({
              [WELL_BOTTOMHOLE_TARGET_AZI]: v === '' ? undefined : Number(v),
            })
          }
        />
      )}

      {infraObject.subtype === 'well_bottomhole_gs_toe' && typeof gsHeelId === 'string' && (
        <p className="object-detail-panel__meta">
          Связанная пятка: <span className="font-mono">{gsHeelId.slice(0, 8)}…</span>
        </p>
      )}

      {linkedPadId && !readOnly && (
        <PanelSubsection title="Расчёт траектории">
          <button
            type="button"
            className="btn btn-secondary btn-sm object-detail-panel__copy-btn object-detail-panel__copy-btn--block"
            disabled={designMut.isPending}
            onClick={() => designMut.mutate()}
          >
            {designMut.isPending ? 'Расчёт…' : 'Пересчитать траекторию с куста'}
          </button>
          {designMut.error && (
            <p className="object-detail-panel__hint odp-traj-error">
              {translateWellTrajectoryUserMessage(
                designMut.error instanceof Error ? designMut.error.message : 'Ошибка расчёта',
              )}
            </p>
          )}
        </PanelSubsection>
      )}
    </PanelSection>
  );
}
