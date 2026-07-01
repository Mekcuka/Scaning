import type { PadEarthworkParams } from '../../lib/api/padEarthworkApi';
import type { InfraObject } from '../../lib/api';
import {
  DEFAULT_PAD_NDS_DEG,
  padParamsFromObject,
  resolveGeneratorNdsDeg,
} from '../../lib/infraPadEarthwork';

export type PadEarthworkFormFields = {
  lengthM: string;
  widthM: string;
  heightM: string;
  rotationDeg: string;
  referenceElevationM: string;
};

export function normalizePadEarthworkField(raw: string): string {
  const t = raw.trim().replace(',', '.');
  if (!t) return '';
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : t;
}

export function padEarthworkFormFieldsEqual(
  a: PadEarthworkFormFields,
  b: PadEarthworkFormFields,
): boolean {
  return (
    normalizePadEarthworkField(a.lengthM) === normalizePadEarthworkField(b.lengthM) &&
    normalizePadEarthworkField(a.widthM) === normalizePadEarthworkField(b.widthM) &&
    normalizePadEarthworkField(a.heightM) === normalizePadEarthworkField(b.heightM) &&
    normalizePadEarthworkField(a.rotationDeg) === normalizePadEarthworkField(b.rotationDeg) &&
    normalizePadEarthworkField(a.referenceElevationM) ===
      normalizePadEarthworkField(b.referenceElevationM)
  );
}

export function padEarthworkFormFieldsFromObject(
  infraObject: Pick<InfraObject, 'properties'>,
): PadEarthworkFormFields {
  return padParamsFromObject(infraObject);
}

export function padEarthworkFormFieldsFromLastParams(
  params: PadEarthworkParams,
  hasGeneratedWells: boolean,
): PadEarthworkFormFields {
  return {
    lengthM: String(params.length_m),
    widthM: String(params.width_m),
    heightM: String(params.height_m),
    rotationDeg: resolveGeneratorNdsDeg(
      String(params.rotation_deg ?? DEFAULT_PAD_NDS_DEG),
      hasGeneratedWells,
    ),
    referenceElevationM: String(params.reference_elevation_m),
  };
}

export function currentPadEarthworkFormFields(state: {
  lengthM: string;
  widthM: string;
  heightM: string;
  rotationDeg: string;
  referenceElevationM: string;
}): PadEarthworkFormFields {
  return {
    lengthM: state.lengthM,
    widthM: state.widthM,
    heightM: state.heightM,
    rotationDeg: state.rotationDeg,
    referenceElevationM: state.referenceElevationM,
  };
}
