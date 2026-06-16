import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { cameraNorthCompassDeg } from '../../lib/padScene3dProjection';

export type CompassSceneView = {
  camera: THREE.Camera;
  target: THREE.Vector3;
  planViewLocked: boolean;
} | null;

type PadClusteringScene3DCompassProps = {
  getCompassView: () => CompassSceneView;
};

export function PadClusteringScene3DCompass({ getCompassView }: PadClusteringScene3DCompassProps) {
  const [rotationDeg, setRotationDeg] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const view = getCompassView();
      if (!view) return;
      const deg = cameraNorthCompassDeg(view.camera, view.target, view.planViewLocked);
      setRotationDeg((prev) => (Math.abs(prev - deg) < 0.25 ? prev : deg));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [getCompassView]);

  return (
    <div className="pad-clustering-scene3d-compass" role="img" aria-label="Ориентация: север">
      <svg viewBox="-20 -20 40 40" className="pad-clustering-scene3d-compass__svg">
        <g style={{ transform: `rotate(${rotationDeg}deg)`, transformOrigin: '0 0' }}>
          <line x1={0} y1={4} x2={0} y2={-12} stroke="currentColor" strokeWidth={2} />
          <polygon points="0,-14 -4,-8 4,-8" fill="currentColor" />
        </g>
        <text x={5} y={-10} className="pad-clustering-scene3d-compass__n">
          N
        </text>
      </svg>
    </div>
  );
}
