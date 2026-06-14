import { clampNdsDeg, DEFAULT_PAD_NDS_DEG, padParamsFromObject, resolveGeneratorNdsDeg } from '../lib/infraPadEarthwork';
import { padWellFieldsFromForm, padWellFormStringsFromObject } from '../lib/infraPadWells';
import type { InfraObject } from '../lib/api';
import type { PadClusteringPadDraft } from '../lib/padClusteringSave';

export function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseHeightRef(heightM: string, referenceElevationM: string) {
  const height = parsePositive(heightM);
  const refRaw = referenceElevationM.trim().replace(',', '.');
  const ref = refRaw === '' ? 0 : Number(refRaw);
  if (height == null || !Number.isFinite(ref)) return null;
  return { height_m: height, reference_elevation_m: ref };
}

export function draftFromPad(pad: InfraObject, wellsCount = 0): PadClusteringPadDraft {
  const p = padParamsFromObject(pad);
  const wells = padWellFormStringsFromObject(pad.properties);
  return {
    ...wells,
    lengthM: p.lengthM,
    widthM: p.widthM,
    heightM: p.heightM,
    rotationDeg: resolveGeneratorNdsDeg(p.rotationDeg, wellsCount > 0),
    referenceElevationM: p.referenceElevationM,
  };
}

export function buildGenerateBodyFromDraft(activeDraft: PadClusteringPadDraft) {
  const fields = padWellFieldsFromForm(activeDraft);
  const rotRaw = activeDraft.rotationDeg.trim().replace(',', '.');
  const rotation = rotRaw === '' ? DEFAULT_PAD_NDS_DEG : Number(rotRaw);
  return {
    well_count: fields.wellCount,
    wells_per_group: fields.wellsPerGroup,
    well_spacing_m: fields.wellSpacingM,
    group_spacing_m: fields.groupSpacingM,
    margins: {
      left_m: fields.leftM,
      bottom_m: fields.bottomM,
      top_m: fields.topM,
      end_m: fields.endM,
    },
    rotation_deg: Number.isFinite(rotation) ? clampNdsDeg(rotation) : DEFAULT_PAD_NDS_DEG,
  };
}
