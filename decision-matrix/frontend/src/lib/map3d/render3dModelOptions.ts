import type { Map3dCustomModel } from '../api';
import { SUBTYPE_LABELS } from '../api';
import { customModelPropertyId } from './map3dCustomAssets';
import { catalogEntryForSubtype, MAP3D_MODEL_BY_SUBTYPE } from './map3dModelCatalog';

export type Render3dModelSelectOption = { value: string; label: string };

function customModelAssignedToSubtype(subtype: string, model: Map3dCustomModel): boolean {
  const st = subtype.trim().toLowerCase();
  const assigned = (model.assigned_subtypes ?? []).map((s) => s.trim().toLowerCase());
  if (assigned.includes(st)) return true;
  // Legacy GLB assignments before oil_pad / gas_pad split.
  if (st === 'oil_pad' && assigned.includes('pad')) return true;
  return false;
}

/** Point subtypes that support bundled glTF on the 3D map. */
export function map3dAssignableSubtypes(): string[] {
  return Object.keys(MAP3D_MODEL_BY_SUBTYPE)
    .filter((st) => st !== 'poi' && catalogEntryForSubtype(st)?.gltfAssetId != null)
    .sort((a, b) =>
      (SUBTYPE_LABELS[a] ?? a).localeCompare(SUBTYPE_LABELS[b] ?? b, 'ru'),
    );
}

export function buildRender3dModelOptions(
  subtype: string,
  models: Map3dCustomModel[],
): Render3dModelSelectOption[] {
  const st = subtype.trim().toLowerCase();
  const catalog = catalogEntryForSubtype(st);
  const subtypeLabel = SUBTYPE_LABELS[st] ?? st;
  const standardAsset = catalog?.gltfAssetId ?? '—';
  const options: Render3dModelSelectOption[] = [
    {
      value: '',
      label: `Стандартная — ${subtypeLabel} (${standardAsset})`,
    },
  ];
  for (const m of models) {
    if (customModelAssignedToSubtype(st, m)) {
      options.push({
        value: customModelPropertyId(m.id),
        label: m.filename,
      });
    }
  }
  return options;
}

/** Map stored render_3d_model_id to a select value (empty = standard). */
export function render3dModelSelectValue(
  subtype: string,
  models: Map3dCustomModel[],
  rawModelId: string,
): string {
  const trimmed = rawModelId.trim();
  if (!trimmed) return '';
  const normalized = trimmed.toLowerCase();
  const options = buildRender3dModelOptions(subtype, models);
  if (options.some((o) => o.value === normalized)) return normalized;
  if (normalized.startsWith('custom:')) {
    const id = normalized.slice('custom:'.length);
    if (models.some((m) => m.id === id)) return normalized;
  }
  return '';
}
