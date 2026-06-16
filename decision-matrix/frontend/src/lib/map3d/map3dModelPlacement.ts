import * as THREE from 'three';

/** Mercator transform goes on placement; glTF scale/anchor stays on inner model group. */
export function wrapModelWithPlacement(modelGroup: THREE.Group): THREE.Group {
  const placement = new THREE.Group();
  placement.matrixAutoUpdate = false;
  placement.add(modelGroup);
  return placement;
}

export function modelGroupFromPlacement(placement: THREE.Group): THREE.Group | null {
  const child = placement.children[0];
  return child instanceof THREE.Group ? child : null;
}

/** Max axis length of inner model in its local space (unchanged when placement matrix updates). */
export function innerModelMaxDim(placement: THREE.Group): number {
  const model = modelGroupFromPlacement(placement);
  if (!model) return 0;
  const box = new THREE.Box3();
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry as THREE.BufferGeometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const lb = geom.boundingBox!.clone();
    lb.applyMatrix4(mesh.matrix);
    box.union(lb);
  });
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z);
}
