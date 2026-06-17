import type { QueryClient } from '@tanstack/react-query';
import type { InfraObject } from '../api';
import { useAppStore } from '../../store';

/** Apply a list patch to full infra query and every viewport bbox slice for the project. */
export function patchAllInfraQueries(
  queryClient: QueryClient,
  projectId: string,
  merge: (list: InfraObject[]) => InfraObject[],
): void {
  queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
    merge(old ?? []),
  );
}

export function upsertInfraObjectInQueries(
  queryClient: QueryClient,
  projectId: string,
  object: InfraObject,
): void {
  patchAllInfraQueries(queryClient, projectId, (list) => {
    const idx = list.findIndex((o) => o.id === object.id);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = object;
      return next;
    }
    return [...list, object];
  });
}

export function removeInfraObjectsFromQueries(
  queryClient: QueryClient,
  projectId: string,
  ids: Iterable<string>,
): void {
  const drop = new Set(ids);
  if (drop.size === 0) return;
  patchAllInfraQueries(queryClient, projectId, (list) => list.filter((o) => !drop.has(o.id)));
}

/** Patch one or more infra rows in full + bbox caches (geometry, batch drag). */
export function patchInfraObjectsInQueries(
  queryClient: QueryClient,
  projectId: string,
  patch: (object: InfraObject) => InfraObject | null,
): void {
  patchAllInfraQueries(queryClient, projectId, (list) => {
    let changed = false;
    const next = list.map((o) => {
      const updated = patch(o);
      if (updated === null || updated === o) return o;
      changed = true;
      return updated;
    });
    return changed ? next : list;
  });
}

export function upsertInfraObjectsInQueries(
  queryClient: QueryClient,
  projectId: string,
  objects: InfraObject[],
): void {
  if (objects.length === 0) return;
  patchAllInfraQueries(queryClient, projectId, (list) => {
    const next = [...list];
    const indexById = new Map(next.map((o, i) => [o.id, i]));
    for (const obj of objects) {
      const idx = indexById.get(obj.id);
      if (idx != null) next[idx] = obj;
      else {
        indexById.set(obj.id, next.length);
        next.push(obj);
      }
    }
    return next;
  });
}

/** Refetch layers/infra/network and well trajectories after import or edits; clears map bbox filter via store nonce. */
export async function refreshMapQueries(queryClient: QueryClient, projectId: string) {
  useAppStore.getState().bumpMapRefresh();
  await queryClient.invalidateQueries({ queryKey: ['layers', projectId] });
  await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
  await queryClient.invalidateQueries({
    queryKey: ['infra', projectId],
    predicate: (q) => q.queryKey[2] === 'bbox',
  });
  await queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
  await queryClient.refetchQueries({ queryKey: ['layers', projectId] });
  await queryClient.refetchQueries({ queryKey: ['infra', projectId] });
  await queryClient.refetchQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
}
