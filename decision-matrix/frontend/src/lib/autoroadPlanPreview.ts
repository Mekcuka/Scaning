import type { AutoroadConnectResult, NetworkPlanResponse } from './api';

export type AutoroadPlanPreviewLine = {
  coordinates: number[][];
  kind: string;
};

/** Overlay lines from solution JSON (preferred over GeoJSON preview). */
export function linesFromNetworkPlanResponse(
  plan: NetworkPlanResponse | null | undefined,
): AutoroadPlanPreviewLine[] {
  if (!plan?.new_lines?.length) {
    return linesFromAutoroadPlanPreview(plan?.preview ?? null);
  }
  const out: AutoroadPlanPreviewLine[] = [];
  for (const ln of plan.new_lines) {
    if (!Array.isArray(ln.coordinates) || ln.coordinates.length < 2) continue;
    const line: number[][] = [];
    for (const c of ln.coordinates) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      line.push([lon, lat]);
    }
    if (line.length >= 2) {
      out.push({ coordinates: line, kind: ln.kind ?? 'link' });
    }
  }
  return out;
}

/** Extract plan line geometries from backend GeoJSON preview for map overlay. */
export function linesFromAutoroadPlanPreview(
  preview: AutoroadConnectResult['preview'],
): AutoroadPlanPreviewLine[] {
  if (!preview || preview.type !== 'FeatureCollection' || !Array.isArray(preview.features)) {
    return [];
  }
  const out: AutoroadPlanPreviewLine[] = [];
  for (const raw of preview.features) {
    const feat = raw as {
      geometry?: { type?: string; coordinates?: unknown };
      properties?: { kind?: string };
    };
    if (feat.geometry?.type !== 'LineString') continue;
    const coords = feat.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const line: number[][] = [];
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      line.push([lon, lat]);
    }
    if (line.length >= 2) {
      out.push({
        coordinates: line,
        kind: feat.properties?.kind ?? 'link',
      });
    }
  }
  return out;
}

/** Map NetworkPlanResponse to legacy preview shape for the confirm modal. */
export function networkPlanToConnectPreview(plan: NetworkPlanResponse): AutoroadConnectResult {
  return {
    dry_run: true,
    terminals: plan.terminals.map((t) => ({
      object_id: t.id,
      name: t.name,
      graph_node_id: t.graph_node_id ?? null,
      warning: t.warning ?? null,
    })),
    new_line_count: plan.new_line_count,
    new_node_count: plan.new_node_count,
    split_count: plan.split_count,
    used_existing_edge_ids: plan.used_existing_edge_ids,
    total_new_km: plan.total_new_km,
    warnings: plan.warnings,
    preview: plan.preview ?? null,
    created_node_ids: [],
    created_line_ids: [],
    created_nodes: 0,
    created_lines: 0,
  };
}
