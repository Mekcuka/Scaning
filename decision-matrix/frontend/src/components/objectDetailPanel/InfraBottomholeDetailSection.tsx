import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfraObject } from '../../lib/api';
import { SUBTYPE_LABELS } from '../../lib/api';
import { wellTrajectoryApi } from '../../lib/api/wellTrajectoryApi';
import { readWellTrajectoryStepM } from '../../lib/padClusteringCalcSettings';
import { wellTrajectoryQueryKeys } from '../../hooks/useWellTrajectoryGeoJson';
import {
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
  DEFAULT_NNB_INC,
  readBottomholeLinkedPadId,
  readBottomholeTvdM,
} from '../../lib/wellBottomholeProperties';
import { FieldLabel, PanelSection } from './panelUi';

interface InfraBottomholeDetailSectionProps {
  projectId: string;
  infraObject: InfraObject;
  padOptions: InfraObject[];
  readOnly: boolean;
  onPropertiesChange: (patch: Record<string, unknown>) => void;
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
  const tvdM = readBottomholeTvdM(props);
  const wellIndexRaw = props[WELL_BOTTOMHOLE_WELL_INDEX];
  const wellIndex =
    wellIndexRaw === '' || wellIndexRaw == null ? '' : String(wellIndexRaw);
  const targetInc = props[WELL_BOTTOMHOLE_TARGET_INC];
  const targetAzi = props[WELL_BOTTOMHOLE_TARGET_AZI];
  const gsHeelId = props[WELL_BOTTOMHOLE_GS_HEEL_ID];

  const linkedPad = padOptions.find((p) => p.id === linkedPadId);
  const stepM = readWellTrajectoryStepM({
    properties: linkedPad?.properties as Record<string, unknown> | undefined,
  });

  const designMut = useMutation({
    mutationFn: async () => {
      if (!linkedPadId) throw new Error('Укажите куст');
      await wellTrajectoryApi.syncBottomholes(projectId, linkedPadId);
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

  const subtypeLabel = SUBTYPE_LABELS[infraObject.subtype] ?? infraObject.subtype;

  return (
    <PanelSection title={`Забой — ${subtypeLabel}`}>
      <FieldLabel>Куст</FieldLabel>
      <select
        className="object-detail-panel__input"
        disabled={readOnly || infraObject.subtype === 'well_bottomhole_gs_toe'}
        value={linkedPadId}
        onChange={(e) =>
          onPropertiesChange({ [WELL_BOTTOMHOLE_LINKED_PAD_ID]: e.target.value || undefined })
        }
      >
        <option value="">— выберите куст —</option>
        {padOptions.map((pad) => (
          <option key={pad.id} value={pad.id}>
            {pad.name}
          </option>
        ))}
      </select>

      <FieldLabel>Скважина № (0…63, пусто = авто)</FieldLabel>
      <input
        className="object-detail-panel__input"
        type="number"
        min={0}
        max={63}
        disabled={readOnly}
        value={wellIndex}
        onChange={(e) =>
          onPropertiesChange({
            [WELL_BOTTOMHOLE_WELL_INDEX]:
              e.target.value === '' ? undefined : Number(e.target.value),
          })
        }
      />

      <FieldLabel>TVD, м</FieldLabel>
      <input
        className="object-detail-panel__input"
        type="number"
        min={1}
        disabled={readOnly}
        value={tvdM}
        onChange={(e) =>
          onPropertiesChange({ [WELL_BOTTOMHOLE_TVD_M]: Number(e.target.value) })
        }
      />

      {infraObject.subtype === 'well_bottomhole_nnb' && (
        <>
          <FieldLabel>Зенитный угол на забое, °</FieldLabel>
          <input
            className="object-detail-panel__input"
            type="number"
            min={0}
            max={360}
            disabled={readOnly}
            value={targetInc ?? DEFAULT_NNB_INC}
            onChange={(e) =>
              onPropertiesChange({ [WELL_BOTTOMHOLE_TARGET_INC]: Number(e.target.value) })
            }
          />
        </>
      )}

      {(infraObject.subtype === 'well_bottomhole_nnb' ||
        infraObject.subtype === 'well_bottomhole_gs_toe') && (
        <>
          <FieldLabel>Азимут цели, °</FieldLabel>
          <input
            className="object-detail-panel__input"
            type="number"
            min={0}
            max={360}
            disabled={readOnly}
            value={targetAzi ?? ''}
            placeholder="из NDS куста"
            onChange={(e) =>
              onPropertiesChange({
                [WELL_BOTTOMHOLE_TARGET_AZI]:
                  e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </>
      )}

      {infraObject.subtype === 'well_bottomhole_gs_toe' && typeof gsHeelId === 'string' && (
        <p className="object-detail-panel__hint text-xs">
          Связанный heel: {gsHeelId.slice(0, 8)}…
        </p>
      )}

      {linkedPadId && !readOnly && (
        <div className="object-detail-panel__actions-row">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={designMut.isPending}
            onClick={() => designMut.mutate()}
          >
            {designMut.isPending ? 'Расчёт…' : 'Пересчитать траекторию с куста'}
          </button>
        </div>
      )}

      {designMut.error && (
        <p className="object-detail-panel__hint text-xs text-red-600">
          {designMut.error instanceof Error ? designMut.error.message : 'Ошибка расчёта'}
        </p>
      )}
    </PanelSection>
  );
}
