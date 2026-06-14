import type { PadPlacementComputeResponse, PadPlacementVariant } from './padPlacementTypes';

export function normalizePadPlacementComputeResponse(
  raw: unknown,
): PadPlacementComputeResponse {
  const data = (raw ?? {}) as Partial<PadPlacementComputeResponse> & Record<string, unknown>;
  const variants = Array.isArray(data.variants)
    ? (data.variants as PadPlacementVariant[])
    : [];
  return {
    request_id: String(data.request_id ?? ''),
    logical_well_count: Number(data.logical_well_count ?? 0),
    partitions_evaluated: Number(data.partitions_evaluated ?? 0),
    variants,
    warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
    computed_at: String(data.computed_at ?? new Date().toISOString()),
  };
}

export function defaultPadPlacementVariantIndex(
  variants: PadPlacementVariant[],
): number | null {
  if (variants.length === 0) return null;
  const first = variants[0]!;
  return typeof first.variant_index === 'number' ? first.variant_index : 0;
}

export function findPadPlacementVariant(
  result: PadPlacementComputeResponse | null,
  selectedVariantIndex: number | null,
): PadPlacementVariant | null {
  if (!result || selectedVariantIndex == null) return null;
  return (
    result.variants.find((v) => v.variant_index === selectedVariantIndex) ??
    result.variants[selectedVariantIndex] ??
    null
  );
}
