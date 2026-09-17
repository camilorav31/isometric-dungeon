import * as THREE from 'three';
import { Direction } from '../dungeon/DungeonGenerator';

const MIN_OPACITY = 0.08;
const FADE_SPEED = 10; // opacity units/sec, for a smooth dissolve instead of an instant pop

const DIR_DOT: Record<Direction, (yaw: number) => number> = {
  N: (yaw) => -Math.cos(yaw),
  S: (yaw) => Math.cos(yaw),
  E: (yaw) => Math.sin(yaw),
  W: (yaw) => -Math.sin(yaw),
};

// A wall's normal is at best 45° off the camera direction (the camera only ever
// looks at a room corner-on), so the raw dot product tops out at cos(45°)≈0.707.
// Normalize by that so the "most facing" walls actually reach full fade.
const MAX_DOT = Math.SQRT1_2;

function targetOpacityFor(dir: Direction, camYaw: number): number {
  const facingCamera = THREE.MathUtils.clamp(DIR_DOT[dir](camYaw) / MAX_DOT, 0, 1);
  return THREE.MathUtils.lerp(1, MIN_OPACITY, facingCamera);
}

function applyOpacity(mesh: THREE.Mesh, opacity: number, delta: number) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.opacity = THREE.MathUtils.damp(mat.opacity, opacity, FADE_SPEED, delta);
  mesh.castShadow = mat.opacity > 0.5;
}

/**
 * Smoothly fades the walls facing the camera (the ones that would otherwise block
 * the view into the room) toward near-invisible, and restores the rest to opaque.
 */
export function updateWallFade(
  wallMeshesByDir: Partial<Record<Direction, THREE.Mesh[]>>,
  camYaw: number,
  delta: number,
  active: boolean,
) {
  for (const dir of Object.keys(wallMeshesByDir) as Direction[]) {
    const meshes = wallMeshesByDir[dir];
    if (!meshes) continue;
    const target = active ? targetOpacityFor(dir, camYaw) : 1;
    for (const mesh of meshes) applyOpacity(mesh, target, delta);
  }
}
