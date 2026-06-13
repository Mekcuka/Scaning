import { useCallback, useState } from 'react';
import type { DrawMode } from '../components/MapView';
import type { InfraObject } from '../lib/api';
import { SUBTYPE_LABELS } from '../lib/api';
import {
  DEFAULT_BOTTOMHOLE_TVD_M,
  DEFAULT_NNB_INC,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TVD_M,
  findNearestPad,
} from '../lib/wellBottomholeProperties';

export type GsHeelDraft = {
  id: string;
  lon: number;
  lat: number;
  linkedPadId: string | null;
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
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  onCreated?: () => void;
}) {
  const {
    projectId,
    drawMode,
    infraObjects,
    canWriteInfra,
    nextAutoName,
    placeBottomholeAt,
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
      if (drawMode !== 'bottomhole_nnb' && drawMode !== 'bottomhole_gs') return;

      const pads = infraObjects.filter((o) => o.subtype === 'oil_pad' || o.subtype === 'gas_pad');
      const linkedPadId = findNearestPad(pads, lon, lat)?.id ?? null;

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
        const created = await placeBottomholeAt(
          'well_bottomhole_gs_heel',
          lon,
          lat,
          withOptionalLinkedPad(linkedPadId, {
            [WELL_BOTTOMHOLE_TVD_M]: DEFAULT_BOTTOMHOLE_TVD_M,
          }),
        );
        if (created) {
          setGsHeelDraft({
            id: created.id,
            lon,
            lat,
            linkedPadId,
          });
          pushToast('info', 'Heel задан — кликните toe на карте');
        }
        return;
      }

      const created = await placeBottomholeAt(
        'well_bottomhole_gs_toe',
        lon,
        lat,
        withOptionalLinkedPad(gsHeelDraft.linkedPadId, {
          [WELL_BOTTOMHOLE_GS_HEEL_ID]: gsHeelDraft.id,
          [WELL_BOTTOMHOLE_TVD_M]: DEFAULT_BOTTOMHOLE_TVD_M,
        }),
      );
      setGsHeelDraft(null);
      if (created) {
        pushToast(
          'success',
          `${SUBTYPE_LABELS.well_bottomhole_gs_toe ?? 'ГС — toe'} «${created.name}» создан`,
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
      pushToast,
      onCreated,
    ],
  );

  const isBottomholeDrawActive =
    drawMode === 'bottomhole_nnb' || drawMode === 'bottomhole_gs';

  return {
    gsHeelDraft,
    cancelBottomholeDraw,
    handleMapClickForBottomholeDraw,
    isBottomholeDrawActive,
  };
}
