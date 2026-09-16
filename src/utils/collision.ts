export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function makeAABB(x: number, z: number, halfW: number, halfD: number): AABB {
  return { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
}

export function intersects(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/**
 * Resolves `moving` out of `obstacle` by pushing along the axis of least overlap.
 * Returns the correction vector applied (dx, dz).
 */
export function resolveAABB(moving: AABB, obstacle: AABB): { dx: number; dz: number } {
  if (!intersects(moving, obstacle)) return { dx: 0, dz: 0 };

  const overlapX = Math.min(moving.maxX, obstacle.maxX) - Math.max(moving.minX, obstacle.minX);
  const overlapZ = Math.min(moving.maxZ, obstacle.maxZ) - Math.max(moving.minZ, obstacle.minZ);

  const movingCenterX = (moving.minX + moving.maxX) / 2;
  const obstacleCenterX = (obstacle.minX + obstacle.maxX) / 2;
  const movingCenterZ = (moving.minZ + moving.maxZ) / 2;
  const obstacleCenterZ = (obstacle.minZ + obstacle.maxZ) / 2;

  if (overlapX < overlapZ) {
    const dir = movingCenterX < obstacleCenterX ? -1 : 1;
    return { dx: overlapX * dir, dz: 0 };
  } else {
    const dir = movingCenterZ < obstacleCenterZ ? -1 : 1;
    return { dx: 0, dz: overlapZ * dir };
  }
}

export function circleIntersects(x1: number, z1: number, r1: number, x2: number, z2: number, r2: number): boolean {
  const dx = x1 - x2;
  const dz = z1 - z2;
  const rr = r1 + r2;
  return dx * dx + dz * dz < rr * rr;
}

/**
 * Moves `moveObj` by (dx, dz), testing each axis independently against `obstacles`
 * so the mover slides along walls instead of getting fully stopped by them.
 */
export function attemptMove(
  getAABB: () => AABB,
  moveObj: { position: { x: number; z: number } },
  dx: number,
  dz: number,
  obstacles: AABB[],
) {
  const startX = moveObj.position.x;
  const startZ = moveObj.position.z;

  moveObj.position.x = startX + dx;
  if (obstacles.some((o) => intersects(getAABB(), o))) moveObj.position.x = startX;

  moveObj.position.z = startZ + dz;
  if (obstacles.some((o) => intersects(getAABB(), o))) moveObj.position.z = startZ;
}
