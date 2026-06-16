import type { InfraObject } from '../../lib/api';
import {
  DEFAULT_BOTTOMHOLE_ROLE,
  DEFAULT_GS_ENTRY_MODE,
  DEFAULT_NNB_INC,
  WELL_BOTTOMHOLE_GS_ENTRY_MODE,
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_PARENT_ID,
  WELL_BOTTOMHOLE_ROLE,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TOE_TVD_M,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
  bottomholePropertyValuesEqual,
  isBottomholePropCleared,
  readBottomholeLinkedPadId,
  readBottomholeParentId,
  readBottomholeRole,
  readBottomholeTvdM,
  readGsEntryMode,
  readGsHeelTvdM,
  readGsToeTvdM,
} from '../../lib/wellBottomholeProperties';

export type BottomholeFormFields = {
  linkedPadId: string;
  wellIndex: string;
  role: string;
  parentId: string;
  tvdM: string;
  heelTvdM: string;
  toeTvdM: string;
  gsEntryMode: string;
  targetInc: string;
  targetAzi: string;
};

export const EMPTY_BOTTOMHOLE_FORM_FIELDS: BottomholeFormFields = {
  linkedPadId: '',
  wellIndex: '',
  role: DEFAULT_BOTTOMHOLE_ROLE,
  parentId: '',
  tvdM: '',
  heelTvdM: '',
  toeTvdM: '',
  gsEntryMode: DEFAULT_GS_ENTRY_MODE,
  targetInc: String(DEFAULT_NNB_INC),
  targetAzi: '',
};

export function bottomholeFormFieldsFromInfraObject(obj: InfraObject): BottomholeFormFields {
  const props = obj.properties ?? {};
  const wellIndexRaw = props[WELL_BOTTOMHOLE_WELL_INDEX];
  const targetIncRaw = props[WELL_BOTTOMHOLE_TARGET_INC];
  const targetAziRaw = props[WELL_BOTTOMHOLE_TARGET_AZI];
  return {
    linkedPadId: readBottomholeLinkedPadId(props) ?? '',
    wellIndex:
      wellIndexRaw === '' || wellIndexRaw == null ? '' : String(wellIndexRaw),
    role: readBottomholeRole(props),
    parentId: readBottomholeParentId(props) ?? '',
    tvdM: String(readBottomholeTvdM(props)),
    heelTvdM: String(readGsHeelTvdM(props)),
    toeTvdM: String(readGsToeTvdM(props)),
    gsEntryMode: readGsEntryMode(props),
    targetInc:
      targetIncRaw === '' || targetIncRaw == null
        ? String(DEFAULT_NNB_INC)
        : String(targetIncRaw),
    targetAzi:
      targetAziRaw === '' || targetAziRaw == null ? '' : String(targetAziRaw),
  };
}

export function bottomholeFormFieldsToProperties(
  fields: BottomholeFormFields,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const role = fields.role.trim() === 'lateral' ? 'lateral' : 'main';
  props[WELL_BOTTOMHOLE_ROLE] = role;

  if (role === 'lateral') {
    if (fields.parentId.trim()) {
      props[WELL_BOTTOMHOLE_PARENT_ID] = fields.parentId.trim();
    } else {
      props[WELL_BOTTOMHOLE_PARENT_ID] = null;
    }
    props[WELL_BOTTOMHOLE_LINKED_PAD_ID] = null;
    props[WELL_BOTTOMHOLE_WELL_INDEX] = null;
  } else {
    props[WELL_BOTTOMHOLE_PARENT_ID] = null;
    if (fields.linkedPadId.trim()) {
      props[WELL_BOTTOMHOLE_LINKED_PAD_ID] = fields.linkedPadId.trim();
    } else {
      props[WELL_BOTTOMHOLE_LINKED_PAD_ID] = null;
    }
    if (fields.wellIndex.trim()) {
      const n = Number(fields.wellIndex.trim());
      if (Number.isFinite(n)) props[WELL_BOTTOMHOLE_WELL_INDEX] = Math.round(n);
    } else {
      props[WELL_BOTTOMHOLE_WELL_INDEX] = null;
    }
  }

  const tvd = Number(fields.tvdM.trim());
  if (Number.isFinite(tvd) && tvd > 0) props[WELL_BOTTOMHOLE_TVD_M] = tvd;
  const heelTvd = Number(fields.heelTvdM.trim());
  if (Number.isFinite(heelTvd) && heelTvd > 0) props[WELL_BOTTOMHOLE_HEEL_TVD_M] = heelTvd;
  const toeTvd = Number(fields.toeTvdM.trim());
  if (Number.isFinite(toeTvd) && toeTvd > 0) props[WELL_BOTTOMHOLE_TOE_TVD_M] = toeTvd;
  props[WELL_BOTTOMHOLE_GS_ENTRY_MODE] = fields.gsEntryMode.trim() || DEFAULT_GS_ENTRY_MODE;
  const inc = Number(fields.targetInc.trim());
  if (Number.isFinite(inc)) props[WELL_BOTTOMHOLE_TARGET_INC] = inc;
  if (fields.targetAzi.trim()) {
    const azi = Number(fields.targetAzi.trim());
    if (Number.isFinite(azi)) props[WELL_BOTTOMHOLE_TARGET_AZI] = azi;
  } else {
    props[WELL_BOTTOMHOLE_TARGET_AZI] = null;
  }
  return props;
}

export function bottomholeFormFieldsDirty(
  serverProps: Record<string, unknown> | null | undefined,
  fields: BottomholeFormFields,
): boolean {
  const saved = bottomholeFormFieldsFromInfraObject({
    id: '',
    name: '',
    subtype: 'well_bottomhole_nnb',
    lon: 0,
    lat: 0,
    properties: serverProps ?? {},
  } as InfraObject);
  return (Object.keys(fields) as (keyof BottomholeFormFields)[]).some(
    (key) => !bottomholePropertyValuesEqual(saved[key], fields[key]),
  );
}

export function bottomholeFormFieldsEqual(a: BottomholeFormFields, b: BottomholeFormFields): boolean {
  return (Object.keys(a) as (keyof BottomholeFormFields)[]).every((key) =>
    bottomholePropertyValuesEqual(a[key], b[key]),
  );
}

export function mergeBottomholeFormFields(
  base: BottomholeFormFields,
  patch: Partial<BottomholeFormFields>,
): BottomholeFormFields {
  return { ...base, ...patch };
}

export { isBottomholePropCleared, bottomholePropertyValuesEqual };
