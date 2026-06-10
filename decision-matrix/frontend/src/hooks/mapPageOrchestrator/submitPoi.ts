import { coordForSave, formatCoord, parseCoord } from '../../lib/coords';
import {
  emptyPoiFormValues,
  formValuesToPoiCreatePayload,
  nextPoiAutoName,
} from '../../lib/poiParams';
import { projectsApi, type POI } from '../../lib/api';

type CreatePoiPayload = Parameters<typeof projectsApi.createPoi>[1];

type PoiFormValues = ReturnType<typeof emptyPoiFormValues>;

export function submitPoiCreate(params: {
  projectId: string | null | undefined;
  modal: null | { type: 'poi'; lon: number; lat: number };
  poiForm: PoiFormValues;
  pois: POI[];
  pushToast: (type: 'error' | 'info', message: string) => void;
  createPoiMut: { mutate: (payload: CreatePoiPayload) => void };
}) {
  const { projectId, modal, poiForm, pois, pushToast, createPoiMut } = params;
  if (!projectId) {
    pushToast('error', 'Выберите проект в шапке приложения');
    return;
  }
  if (!modal || modal.type !== 'poi') return;
  const name = poiForm.name.trim() || nextPoiAutoName(pois);
  const lonDisplay = poiForm.lon || formatCoord(modal.lon);
  const latDisplay = poiForm.lat || formatCoord(modal.lat);
  const lon = coordForSave(parseCoord(lonDisplay), modal.lon, lonDisplay);
  const lat = coordForSave(parseCoord(latDisplay), modal.lat, latDisplay);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    pushToast('error', 'Укажите корректные координаты');
    return;
  }
  createPoiMut.mutate({
    ...formValuesToPoiCreatePayload({ ...poiForm, name }),
    lon,
    lat,
  } as CreatePoiPayload);
}
