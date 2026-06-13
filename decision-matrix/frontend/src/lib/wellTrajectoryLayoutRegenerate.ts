import type { PlanVertex } from './api/padEarthworkApi';
import { wellTrajectoryApi } from './api/wellTrajectoryApi';

export function wellsLocalEqual(a: PlanVertex[], b: PlanVertex[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (Math.abs(left.east_m - right.east_m) > 1e-6) return false;
    if (Math.abs(left.north_m - right.north_m) > 1e-6) return false;
  }
  return true;
}

const REGENERATE_MESSAGE =
  'Раскладка устьев изменилась. Пересчитать траектории из новой схемы? Существующие профили будут заменены заготовками.';

/** After pad layout save: offer generate-from-layout when trajectories already exist. */
export async function maybeRegenerateTrajectoriesAfterLayoutChange(input: {
  projectId: string;
  padId: string;
  previousWells: PlanVertex[];
  nextWells: PlanVertex[];
  confirm?: (message: string) => boolean;
}): Promise<boolean> {
  const { projectId, padId, previousWells, nextWells } = input;
  if (wellsLocalEqual(previousWells, nextWells)) return false;

  const last = await wellTrajectoryApi.getLast(projectId, padId);
  if ((last.trajectories?.length ?? 0) === 0) return false;

  const confirm = input.confirm ?? ((message: string) => window.confirm(message));
  if (!confirm(REGENERATE_MESSAGE)) return false;

  await wellTrajectoryApi.generateFromLayout(projectId, padId);
  return true;
}
