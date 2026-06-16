import * as THREE from 'three';
import { createLineTubeGroup, type LineTubeBuildInput } from './map3dLineMeshes';

export type LineTubeSerialized = {
  anchorLon: number;
  anchorLat: number;
  anchorAlt: number;
  position: Float32Array;
  normal: Float32Array;
  index: Uint16Array | Uint32Array | null;
  colorHex: string;
  opacity: number;
};

export function serializeLineTubeBuild(input: LineTubeBuildInput): LineTubeSerialized | null {
  const built = createLineTubeGroup(input);
  if (!built) return null;
  const mesh = built.group.children[0] as THREE.Mesh;
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const norm = geom.getAttribute('normal') as THREE.BufferAttribute;
  const mat = mesh.material as THREE.MeshBasicMaterial;
  return {
    anchorLon: built.anchorLon,
    anchorLat: built.anchorLat,
    anchorAlt: built.anchorAlt,
    position: new Float32Array(pos.array),
    normal: new Float32Array(norm.array),
    index: geom.index ? new (geom.index.array.constructor as typeof Uint16Array)(geom.index.array) : null,
    colorHex: input.colorHex,
    opacity: mat.opacity,
  };
}

export function groupFromSerializedTube(data: LineTubeSerialized): THREE.Group {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
  if (data.index) geom.setIndex(new THREE.BufferAttribute(data.index, 1));

  const color = new THREE.Color(data.colorHex);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: data.opacity < 1,
    opacity: data.opacity,
    side: THREE.FrontSide,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 3,
    polygonOffsetUnits: 3,
  });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geom, mat));
  return group;
}
