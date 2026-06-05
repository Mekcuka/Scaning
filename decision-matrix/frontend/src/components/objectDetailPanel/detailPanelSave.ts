import { coordForSave, parseCoord } from '../../lib/coords';
import { formValuesToPoiPayload, type PoiFormValues } from '../../lib/poiParams';
import { buildInfraSavePayload } from './infraSavePayload';
import type { InfraDirtyDraft } from './detailDirty';
import type { SelectedFeature } from './types';

export function buildDetailPanelSaveHandler(params: {
  readOnly: boolean;
  isPoi: boolean;
  poiForm: PoiFormValues | null;
  selection: SelectedFeature;
  infraDirtyDraft: InfraDirtyDraft;
  name: string;
  description: string;
  subtype: string;
  layerId: string;
  lon: string;
  lat: string;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const {
    readOnly,
    isPoi,
    poiForm,
    selection,
    infraDirtyDraft,
    name,
    description,
    subtype,
    layerId,
    lon,
    lat,
    onSave,
  } = params;

  return () => {
    if (readOnly) return;
    if (isPoi && poiForm) {
      onSave(formValuesToPoiPayload(poiForm));
      return;
    }
    if (selection.kind === 'infra') {
      onSave(buildInfraSavePayload(infraDirtyDraft, selection.object));
      return;
    }
    const payload: Record<string, unknown> = {
      name,
      description,
      subtype,
      layer_id: layerId,
    };
    const poi = selection.poi;
    payload.lon = coordForSave(parseCoord(lon), poi.lon, lon);
    payload.lat = coordForSave(parseCoord(lat), poi.lat, lat);
    onSave(payload);
  };
}
