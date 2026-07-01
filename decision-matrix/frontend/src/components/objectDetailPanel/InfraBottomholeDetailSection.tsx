import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'antd';
import type { InfraObject } from '../../lib/api';
import { wellTrajectoryApi } from '../../lib/api/wellTrajectoryApi';
import { readWellTrajectoryStepM } from '../../lib/padClusteringCalcSettings';
import { wellTrajectoryQueryKeys } from '../../hooks/useWellTrajectoryGeoJson';
import {
  BOTTOMHOLE_ROLE_OPTIONS,
  DEFAULT_GS_ENTRY_MODE,
  DEFAULT_NNB_INC,
  GS_ENTRY_MODE_OPTIONS,
  GS_HEEL_LABEL,
  GS_TOE_LABEL,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  gsEndpointRangeLabel,
  isLateralBottomhole,
  listProjectBottomholes,
} from '../../lib/wellBottomholeProperties';
import { AppSelect } from '../AppSelect';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FieldLabel, PanelSection, PanelSubsection, ReadOnlyValue } from './panelUi';
import { translateWellTrajectoryUserMessage } from '../../lib/wellTrajectoryUserMessages';
import type { BottomholeFormFields } from './bottomholeFormFields';

interface InfraBottomholeDetailSectionProps {
  projectId: string;
  infraObject: InfraObject;
  fields: BottomholeFormFields;
  onFieldsChange: (patch: Partial<BottomholeFormFields>) => void;
  padOptions: InfraObject[];
  infraObjects: InfraObject[];
  readOnly: boolean;
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
            className="object-detail-panel__input"
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
  fields,
  onFieldsChange,
  padOptions,
  infraObjects,
  readOnly,
}: InfraBottomholeDetailSectionProps) {
  const queryClient = useQueryClient();
  const linkedPadId = fields.linkedPadId;
  const isLateral = fields.role === 'lateral';
  const isGsLine = infraObject.subtype === 'well_bottomhole_gs';
  const isGsHeelOrLine =
    infraObject.subtype === 'well_bottomhole_gs_heel' || isGsLine;
  const gsHeelId = infraObject.properties?.[WELL_BOTTOMHOLE_GS_HEEL_ID];

  const linkedPad = padOptions.find((p) => p.id === linkedPadId);
  const stepM = readWellTrajectoryStepM({
    properties: linkedPad?.properties as Record<string, unknown> | undefined,
  });

  const padSelectOptions = [
    { value: '', label: '— выберите куст —' },
    ...padOptions.map((pad) => ({ value: pad.id, label: pad.name })),
  ];

  const mainBottomholeOptions = [
    { value: '', label: '— выберите основной забой —' },
    ...listProjectBottomholes(infraObjects)
      .filter((bh) => bh.id !== infraObject.id && !isLateralBottomhole(bh))
      .map((bh) => ({ value: bh.id, label: bh.name })),
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
        <FieldLabel>Роль</FieldLabel>
        <div className="object-detail-panel__field-control">
          <AppSelect
            variant="compact"
            value={fields.role}
            readOnly={readOnly || infraObject.subtype === 'well_bottomhole_gs_toe'}
            onChange={(value) =>
              onFieldsChange({
                role: value === 'lateral' ? 'lateral' : 'main',
                parentId: value === 'lateral' ? fields.parentId : '',
              })
            }
            options={BOTTOMHOLE_ROLE_OPTIONS}
          />
        </div>
      </label>

      {isLateral ? (
        <label className="object-detail-panel__field">
          <FieldLabel>Родительский забой</FieldLabel>
          <div className="object-detail-panel__field-control">
            <AppSelect
              variant="compact"
              value={fields.parentId}
              readOnly={readOnly}
              onChange={(value) => onFieldsChange({ parentId: value })}
              options={mainBottomholeOptions}
              placeholder="— выберите основной забой —"
            />
          </div>
        </label>
      ) : (
        <label className="object-detail-panel__field">
          <FieldLabel>Куст</FieldLabel>
          <div className="object-detail-panel__field-control">
            <AppSelect
              variant="compact"
              value={linkedPadId}
              readOnly={readOnly || infraObject.subtype === 'well_bottomhole_gs_toe'}
              onChange={(value) => onFieldsChange({ linkedPadId: value })}
              options={padSelectOptions}
              placeholder="— выберите куст —"
            />
          </div>
        </label>
      )}

      <NumberField
        label="Скважина №"
        value={fields.wellIndex}
        readOnly={readOnly || isLateral}
        min={0}
        max={63}
        integer
        allowEmpty
        placeholder="Авто"
        onCommit={(v) =>
          onFieldsChange({ wellIndex: v === '' ? '' : String(typeof v === 'number' ? v : Number(v)) })
        }
      />
      <p className="object-detail-panel__hint">0…63, пусто — номер подберётся автоматически.</p>

      {isGsLine ? (
        <div className="object-detail-panel__pair-grid">
          <div className="object-detail-panel__pair-grid-row">
            <FieldLabel unit="м">TVD {GS_HEEL_LABEL}</FieldLabel>
            <FieldLabel unit="м">TVD {GS_TOE_LABEL}</FieldLabel>
          </div>
          <div className="object-detail-panel__pair-grid-row">
            <div className="object-detail-panel__field-control">
              {readOnly ? (
                <ReadOnlyValue>{fields.heelTvdM}</ReadOnlyValue>
              ) : (
                <DeferredNumberInput
                  min={1}
                  className="object-detail-panel__input"
                  value={fields.heelTvdM}
                  onCommit={(v) => {
                    if (v === '' || !Number.isFinite(v)) return;
                    onFieldsChange({ heelTvdM: String(v) });
                  }}
                />
              )}
            </div>
            <div className="object-detail-panel__field-control">
              {readOnly ? (
                <ReadOnlyValue>{fields.toeTvdM}</ReadOnlyValue>
              ) : (
                <DeferredNumberInput
                  min={1}
                  className="object-detail-panel__input"
                  value={fields.toeTvdM}
                  onCommit={(v) => {
                    if (v === '' || !Number.isFinite(v)) return;
                    onFieldsChange({ toeTvdM: String(v) });
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
          value={fields.tvdM}
          readOnly={readOnly}
          min={1}
          onCommit={(v) => {
            if (v === '' || !Number.isFinite(v)) return;
            onFieldsChange({ tvdM: String(v) });
          }}
        />
      )}

      {infraObject.subtype === 'well_bottomhole_nnb' && (
        <NumberField
          label="Зенитный угол на забое"
          unit="°"
          value={fields.targetInc}
          readOnly={readOnly}
          min={0}
          max={360}
          onCommit={(v) => {
            if (v === '' || !Number.isFinite(v)) return;
            onFieldsChange({ targetInc: String(v) });
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
                value={fields.gsEntryMode}
                readOnly={readOnly}
                onChange={(value) =>
                  onFieldsChange({ gsEntryMode: value || DEFAULT_GS_ENTRY_MODE })
                }
                options={GS_ENTRY_MODE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>
          </label>
          <p className="object-detail-panel__hint">
            «Любая» — алгоритм подберёт точку вдоль {gsEndpointRangeLabel()} (min MD).
          </p>
        </>
      )}

      {(infraObject.subtype === 'well_bottomhole_nnb' ||
        infraObject.subtype === 'well_bottomhole_gs_toe') && (
        <NumberField
          label="Азимут цели"
          unit="°"
          value={fields.targetAzi}
          readOnly={readOnly}
          min={0}
          max={360}
          allowEmpty
          placeholder="Из схемы куста"
          onCommit={(v) =>
            onFieldsChange({ targetAzi: v === '' ? '' : String(v) })
          }
        />
      )}

      {infraObject.subtype === 'well_bottomhole_gs_toe' && typeof gsHeelId === 'string' && (
        <p className="object-detail-panel__meta">
          Связанный {GS_HEEL_LABEL}: <span className="font-mono">{gsHeelId.slice(0, 8)}…</span>
        </p>
      )}

      {linkedPadId && !readOnly && !isLateral && (
        <PanelSubsection title="Расчёт траектории">
          <Button
            block
            size="small"
            className="object-detail-panel__copy-btn"
            loading={designMut.isPending}
            onClick={() => designMut.mutate()}
          >
            {designMut.isPending ? 'Расчёт…' : 'Пересчитать траекторию с куста'}
          </Button>
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
