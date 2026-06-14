import { useMemo } from 'react';
import { resolvePadClusteringSceneTrajectoryDisplay } from '../lib/padClusteringSceneTrajectories';
import { wellsLocalMatch } from '../lib/padClusteringLayoutSync';
import type { PlanShapeSketch, PlanVertex } from '../lib/padEarthworkSketch';
import type { PadClusteringPadDraft } from '../lib/padClusteringSave';

export function usePadClusteringEditorScene(input: {
  trajectories: unknown[];
  wellsLocal: PlanVertex[];
  activeWellsLocal: PlanVertex[];
  layoutPreviewStale: boolean;
}) {
  const { trajectories, wellsLocal, activeWellsLocal, layoutPreviewStale } = input;

  const sceneTrajectoryDisplay = useMemo(
    () =>
      resolvePadClusteringSceneTrajectoryDisplay({
        trajectories,
        persistedWellsLocal: wellsLocal,
        activeWellsLocal,
      }),
    [trajectories, wellsLocal, activeWellsLocal],
  );

  const sceneTrajectories = sceneTrajectoryDisplay.sceneTrajectories;
  const sceneWellsLocal = sceneTrajectoryDisplay.sceneWellsLocal;
  const sceneTrajectoriesHidden = sceneTrajectoryDisplay.sceneTrajectoriesHidden;

  const sceneUsesPersistedWells =
    sceneTrajectories.length > 0 &&
    wellsLocalMatch(sceneWellsLocal, wellsLocal) &&
    !wellsLocalMatch(activeWellsLocal, wellsLocal);

  const sceneLayoutCallout = useMemo(() => {
    if (layoutPreviewStale && sceneUsesPersistedWells && sceneTrajectories.length > 0) {
      return `Траектории показаны для сохранённой раскладки (${wellsLocal.length} уст.). Параметры слева отличаются — сгенерируйте план и сохраните куст.`;
    }
    if (layoutPreviewStale) {
      return 'На холсте — предпросмотр раскладки по параметрам слева. Нажмите «Сгенерировать план», затем «Сохранить».';
    }
    if (sceneTrajectoriesHidden) {
      return 'Траектории скрыты: раскладка изменилась. Сгенерируйте план, сохраните куст и пересчитайте траектории.';
    }
    return null;
  }, [
    layoutPreviewStale,
    sceneUsesPersistedWells,
    sceneTrajectories.length,
    wellsLocal.length,
    sceneTrajectoriesHidden,
  ]);

  return {
    sceneTrajectories,
    sceneWellsLocal,
    sceneTrajectoriesHidden,
    sceneLayoutCallout,
  };
}

export function resolveActiveLayout(input: {
  useLiveLayoutPreview: boolean;
  layoutPreview: { sketch: PlanShapeSketch; wellsLocal: PlanVertex[] } | null;
  localSketch: PlanShapeSketch | null;
  sketch: PlanShapeSketch;
  sketchDirty: boolean;
  localWellsLocal: PlanVertex[];
  wellsLocal: PlanVertex[];
}) {
  const {
    useLiveLayoutPreview,
    layoutPreview,
    localSketch,
    sketch,
    sketchDirty,
    localWellsLocal,
    wellsLocal,
  } = input;

  const activeSketch = useLiveLayoutPreview
    ? layoutPreview!.sketch
    : localSketch ?? sketch;
  const activeWellsLocal = useLiveLayoutPreview
    ? layoutPreview!.wellsLocal
    : sketchDirty
      ? localWellsLocal
      : wellsLocal;

  return { activeSketch, activeWellsLocal };
}

export function isPadFormDraftDirty(
  pad: { id: string } | null,
  activeDraft: PadClusteringPadDraft | null,
  savedPadDraft: PadClusteringPadDraft | null,
) {
  if (!pad || !activeDraft || !savedPadDraft) return false;
  return (Object.keys(savedPadDraft) as (keyof PadClusteringPadDraft)[]).some(
    (key) => activeDraft[key] !== savedPadDraft[key],
  );
}
