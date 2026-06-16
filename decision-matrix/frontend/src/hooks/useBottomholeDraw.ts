import { useCallback, useState } from 'react';
import type { DrawMode } from '../components/MapView';
import type { InfraObject } from '../lib/api';
import { SUBTYPE_LABELS } from '../lib/api';
import {
  DEFAULT_BOTTOMHOLE_TVD_M,
  DEFAULT_NNB_INC,
  GS_HEEL_LABEL,
  GS_TOE_LABEL,
  WELL_BOTTOMHOLE_GS_SUBTYPE,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_PARENT_ID,
  WELL_BOTTOMHOLE_ROLE,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TVD_M,
  findNearestMainBottomhole,
  findNearestPad,
} from '../lib/wellBottomholeProperties';

export type GsHeelDraft = {
  lon: number;
  lat: number;
  linkedPadId: string | null;
  parentId: string | null;
  isLateral: boolean;
};

function withOptionalLinkedPad(
  linkedPadId: string | null,
  props: Record<string, unknown>,
): Record<string, unknown> {
  if (!linkedPadId) return props;
  return { ...props, [WELL_BOTTOMHOLE_LINKED_PAD_ID]: linkedPadId };
}

export function useBottomholeDraw(params: {
  projectId: string | null;
  drawMode: DrawMode;
  infraObjects: InfraObject[];
  canWriteInfra: boolean;
  nextAutoName: (subtype: string) => string;
  placeBottomholeAt: (
    subtype: string,
    lon: number,
    lat: number,
    properties: Record<string, unknown>,
  ) => Promise<InfraObject | null>;
  placeGsBottomholeAt: (
    heelLon: number,
    heelLat: number,
    toeLon: number,
    toeLat: number,
    properties: Record<string, unknown>,
  ) => Promise<InfraObject | null>;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  onCreated?: () => void;
}) {
  const {
    projectId,
    drawMode,
    infraObjects,
    canWriteInfra,
    placeBottomholeAt,
    placeGsBottomholeAt,
    pushToast,
    onCreated,
  } = params;

  const [gsHeelDraft, setGsHeelDraft] = useState<GsHeelDraft | null>(null);

  const cancelBottomholeDraw = useCallback(() => {
    setGsHeelDraft(null);
  }, []);

  const handleMapClickForBottomholeDraw = useCallback(
    async (lon: number, lat: number) => {
      if (!projectId || !canWriteInfra) return;
      const isNnb =
        drawMode === 'bottomhole_nnb' || drawMode === 'bottomhole_lateral_nnb';
      const isGs =
        drawMode === 'bottomhole_gs' || drawMode === 'bottomhole_lateral_gs';
      if (!isNnb && !isGs) return;

      const pads = infraObjects.filter((o) => o.subtype === 'oil_pad' || o.subtype === 'gas_pad');
      const linkedPadId = findNearestPad(pads, lon, lat)?.id ?? null;
      const isLateral = drawMode === 'bottomhole_lateral_nnb' || drawMode === 'bottomhole_lateral_gs';

      if (isLateral) {
        const parent = findNearestMainBottomhole(infraObjects, lon, lat, linkedPadId);
        if (!parent) {
          pushToast('error', 'Рядом нет основного забоя — сначала создайте основной забой на кусте');
          return;
        }
        if (isNnb) {
          const created = await placeBottomholeAt(
            'well_bottomhole_nnb',
            lon,
            lat,
            {
              [WELL_BOTTOMHOLE_ROLE]: 'lateral',
              [WELL_BOTTOMHOLE_PARENT_ID]: parent.id,
              [WELL_BOTTOMHOLE_TVD_M]: DEFAULT_BOTTOMHOLE_TVD_M,
              [WELL_BOTTOMHOLE_TARGET_INC]: DEFAULT_NNB_INC,
            },
          );
          if (created) {
            pushToast('success', `Доп.ствол «${created.name}» создан (родитель: ${parent.name})`);
            onCreated?.();
          }
          return;
        }
        if (!gsHeelDraft) {
          setGsHeelDraft({ lon, lat, linkedPadId, parentId: parent.id, isLateral: true });
          pushToast('info', `${GS_HEEL_LABEL} доп.ствола — укажите ${GS_TOE_LABEL} на карте`);
          return;
        }
        const created = await placeGsBottomholeAt(
          gsHeelDraft.lon,
          gsHeelDraft.lat,
          lon,
          lat,
          {
            [WELL_BOTTOMHOLE_ROLE]: 'lateral',
            [WELL_BOTTOMHOLE_PARENT_ID]: gsHeelDraft.parentId,
            [WELL_BOTTOMHOLE_TVD_M]: DEFAULT_BOTTOMHOLE_TVD_M,
          },
        );
        setGsHeelDraft(null);
        if (created) {
          pushToast('success', `Доп.ствол ГС «${created.name}» создан`);
          onCreated?.();
        }
        return;
      }

      if (drawMode === 'bottomhole_nnb') {
        const created = await placeBottomholeAt(
          'well_bottomhole_nnb',
          lon,
          lat,
          withOptionalLinkedPad(linkedPadId, {
            [WELL_BOTTOMHOLE_TVD_M]: DEFAULT_BOTTOMHOLE_TVD_M,
            [WELL_BOTTOMHOLE_TARGET_INC]: DEFAULT_NNB_INC,
          }),
        );
        if (created) {
          pushToast(
            'success',
            `${SUBTYPE_LABELS.well_bottomhole_nnb ?? 'Забой (ННБ)'} «${created.name}» создан`,
          );
          onCreated?.();
        }
        return;
      }

      if (!gsHeelDraft) {
        setGsHeelDraft({ lon, lat, linkedPadId, parentId: null, isLateral: false });
        pushToast('info', `${GS_HEEL_LABEL} ГС задан — укажите ${GS_TOE_LABEL} на карте`);
        return;
      }

      const created = await placeGsBottomholeAt(
        gsHeelDraft.lon,
        gsHeelDraft.lat,
        lon,
        lat,
        withOptionalLinkedPad(gsHeelDraft.linkedPadId ?? linkedPadId, {
          [WELL_BOTTOMHOLE_TVD_M]: DEFAULT_BOTTOMHOLE_TVD_M,
        }),
      );
      setGsHeelDraft(null);
      if (created) {
        pushToast(
          'success',
          `${SUBTYPE_LABELS[WELL_BOTTOMHOLE_GS_SUBTYPE] ?? 'ГС'} «${created.name}» создан`,
        );
        onCreated?.();
      }
    },
    [
      projectId,
      canWriteInfra,
      drawMode,
      infraObjects,
      gsHeelDraft,
      placeBottomholeAt,
      placeGsBottomholeAt,
      pushToast,
      onCreated,
    ],
  );

  const isBottomholeDrawActive =
    drawMode === 'bottomhole_nnb' ||
    drawMode === 'bottomhole_gs' ||
    drawMode === 'bottomhole_lateral_nnb' ||
    drawMode === 'bottomhole_lateral_gs';

  return {
    gsHeelDraft,
    cancelBottomholeDraw,
    handleMapClickForBottomholeDraw,
    isBottomholeDrawActive,
  };
}
