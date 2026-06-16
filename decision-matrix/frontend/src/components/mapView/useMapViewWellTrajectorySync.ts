import { useEffect } from 'react';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import type { WellTrajectoryGeoJsonFeature } from '../../lib/api/wellTrajectoryApi';
import type { MapViewRefs } from './mapViewRefs';

export function useMapViewWellTrajectorySync(
  refs: MapViewRefs,
  {
    features,
    showWellTrajectories,
    showWellBottomholes,
  }: {
    features: WellTrajectoryGeoJsonFeature[];
    showWellTrajectories: boolean;
    showWellBottomholes: boolean;
  },
): void {
  useEffect(() => {
    const planSource = refs.wellTrajectoryPlanSourceRef.current;
    const bhSource = refs.wellTrajectoryBottomholeSourceRef.current;
    planSource.clear();
    bhSource.clear();

    for (const f of features) {
      const kind = f.properties.kind;
      const props = {
        kind,
        well_index: f.properties.well_index,
        name: f.properties.name,
        infra_object_id: f.properties.infra_object_id,
        pad_name: f.properties.pad_name,
      };
      if ((kind === 'trajectory_plan' || kind === 'pywellgeo_branch') && showWellTrajectories) {
        const coords = f.geometry.coordinates as number[][];
        if (coords.length >= 2) {
          const branchId = (f.properties as { branch_id?: string }).branch_id;
          planSource.addFeature(
            new Feature({
              geometry: new LineString(coords.map((c) => fromLonLat([c[0], c[1]]))),
              ...props,
              branch_name: (f.properties as { branch_name?: string }).branch_name,
              branch_id: branchId,
              feature_key: branchId
                ? `${f.properties.infra_object_id}:${f.properties.well_index}:${branchId}`
                : `${f.properties.infra_object_id}:${f.properties.well_index}:${kind}`,
            }),
          );
        }
      }
      if (kind === 'bottomhole_target' && showWellBottomholes) {
        const c = f.geometry.coordinates as number[];
        bhSource.addFeature(
          new Feature({
            geometry: new Point(fromLonLat([c[0], c[1]])),
            ...props,
            tvd_m: f.properties.tvd_m,
          }),
        );
      }
    }

    refs.wellTrajectoryPlanLayerRef.current?.setVisible(showWellTrajectories);
    refs.wellTrajectoryBottomholeLayerRef.current?.setVisible(showWellBottomholes);
    refs.wellTrajectoryPlanLayerRef.current?.changed();
    refs.wellTrajectoryBottomholeLayerRef.current?.changed();
  }, [refs, features, showWellTrajectories, showWellBottomholes]);
}
