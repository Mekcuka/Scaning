import { clampNdsDeg, DEFAULT_PAD_NDS_DEG, padParamsFromObject, resolveGeneratorNdsDeg } from '../lib/infraPadEarthwork';
import { padWellFieldsFromForm, padWellFormStringsFromObject } from '../lib/infraPadWells';
import type { InfraObject } from '../lib/api';
import type { PadEarthworkParams } from '../lib/api/padEarthworkApi';
import type { PadClusteringPadDraft } from '../lib/padClusteringSave';
import { logicalWellCountFromBottomholes } from '../lib/wellBottomholeProperties';

function padDraftFieldsDirty(
  active: PadClusteringPadDraft,
  saved: PadClusteringPadDraft,
): boolean {
  return !padClusteringDraftsEqual(active, saved);
}

export function padClusteringDraftsEqual(
  a: PadClusteringPadDraft,
  b: PadClusteringPadDraft,
): boolean {
  return (Object.keys(a) as (keyof PadClusteringPadDraft)[]).every(
    (key) => a[key] === b[key],
  );
}

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

/** Draft from infra properties + persisted earthwork snapshot (same sources as map card). */
export function draftFromPadSources(input: {
  pad: InfraObject;
  wellsCount?: number;
  earthworkParams?: PadEarthworkParams | null;
  linkedBottomholes?: InfraObject[];
}): PadClusteringPadDraft {
  const wellsCount = input.wellsCount ?? 0;
  let draft = draftFromPad(input.pad, wellsCount);

  const bottomholes = input.linkedBottomholes ?? [];
  if (bottomholes.length > 0) {
    draft = {
      ...draft,
      padWellCount: String(logicalWellCountFromBottomholes(bottomholes)),
    };
  } else if (wellsCount > 0 && draft.padWellCount !== String(wellsCount)) {
    draft = { ...draft, padWellCount: String(wellsCount) };
  }

  const params = input.earthworkParams;
  if (params) {
    draft = {
      ...draft,
      lengthM: String(params.length_m),
      widthM: String(params.width_m),
      heightM: String(params.height_m),
      referenceElevationM: String(params.reference_elevation_m),
      rotationDeg: resolveGeneratorNdsDeg(
        String(params.rotation_deg ?? DEFAULT_PAD_NDS_DEG),
        wellsCount > 0,
      ),
    };
  }

  return draft;
}

export function padClusteringDraftSourceKey(draft: PadClusteringPadDraft | null): string {
  return draft ? JSON.stringify(draft) : '';
}

export function resolvePadClusteringDraftSync(
  prev: PadClusteringPadDraft | null,
  serverDraft: PadClusteringPadDraft,
  lastServerDraft: PadClusteringPadDraft | null,
  padChanged: boolean,
): PadClusteringPadDraft {
  if (padChanged || !prev) return serverDraft;
  if (!lastServerDraft) return serverDraft;
  if (!padDraftFieldsDirty(prev, lastServerDraft)) return serverDraft;
  if (!padDraftFieldsDirty(prev, serverDraft)) return serverDraft;
  return prev;
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
