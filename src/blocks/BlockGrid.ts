import { Direction } from '../dungeon/DungeonGenerator';

/**
 * B = H / n, where H = 1.80 is the player's reference height (see
 * geometryFactory.ts) and n≈1.8 — the character stands ~1.8 blocks tall,
 * the classic block-builder convention (avatar height ≈ block size).
 *
 * Independently confirmed against every dimension the dungeon/lobby system
 * already builds with: WALL_THICKNESS=1, WALL_HEIGHT=4, DOOR_WIDTH=4,
 * ROOM_SIZE=16 and GRID_SPACING=20 (DungeonBuilder.ts) are all exact
 * multiples of B=1 — the existing world is already a 1-unit lattice, this
 * module just names and formalizes it. With B=1, block-space and world-space
 * coordinates are numerically identical (no conversion factor anywhere).
 */
export const B = 1;

export type BlockType = 'floor' | 'wall' | 'corner' | 'door' | 'stair' | 'decoration';

/** Which pair of horizontal directions a wall/door segment blocks. */
export type WallAxis = 'NS' | 'EW';

/** A placed block. `wallAxis` applies to 'wall'/'door'; `corner` (the two
 * blocked directions) applies to 'corner'. Both omitted for 'floor'/'stair'/
 * 'decoration', which don't block horizontal movement. */
export interface PlacedBlock {
  type: BlockType;
  wallAxis?: WallAxis;
  corner?: [Direction, Direction];
}

function cellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Cube chunk size, in cells — power of two so chunk/local indices can be
 * bit-masked (`x >> 4`, `x & 15`) once this is on a hot path. Independent of
 * room/plot size by design: a room or plot may span several chunks or sit
 * smaller than one; chunks are a streaming granularity, not a content unit. */
export const CHUNK_SIZE = 16;

export function cellToChunk(x: number, y: number, z: number): { chunk: [number, number, number]; local: [number, number, number] } {
  const chunkOf = (v: number) => Math.floor(v / CHUNK_SIZE);
  const localOf = (v: number, c: number) => v - c * CHUNK_SIZE;
  const cx = chunkOf(x);
  const cy = chunkOf(y);
  const cz = chunkOf(z);
  return { chunk: [cx, cy, cz], local: [localOf(x, cx), localOf(y, cy), localOf(z, cz)] };
}

export function chunkKey(cx: number, cy: number, cz: number): string {
  return `${cx},${cy},${cz}`;
}

/**
 * Sparse world of blocks keyed by integer cell coordinate. Absence of an
 * entry means "air" (open/passable) by convention — structural emptiness is
 * the default, not something that has to be written explicitly.
 */
export class BlockGrid {
  private cells = new Map<string, PlacedBlock>();

  set(x: number, y: number, z: number, block: PlacedBlock): void {
    this.cells.set(cellKey(x, y, z), block);
  }

  /** Undefined means air (no block placed there). */
  get(x: number, y: number, z: number): PlacedBlock | undefined {
    return this.cells.get(cellKey(x, y, z));
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(cellKey(x, y, z));
  }

  get size(): number {
    return this.cells.size;
  }

  forEach(fn: (block: PlacedBlock, x: number, y: number, z: number) => void): void {
    for (const [k, block] of this.cells) {
      const [x, y, z] = k.split(',').map(Number);
      fn(block, x, y, z);
    }
  }

  /** Every chunk id touched by at least one placed block — used to decide what to stream. */
  chunkIdsInUse(): Set<string> {
    const ids = new Set<string>();
    this.forEach((_block, x, y, z) => {
      const { chunk } = cellToChunk(x, y, z);
      ids.add(chunkKey(...chunk));
    });
    return ids;
  }
}

/** Every chunk id a rectangular cell region touches — shared by BlockGrid
 * consumers (dungeon rooms) and Plot (housing) so both stream the same way. */
export function chunkIdsForBounds(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): string[] {
  const ids = new Set<string>();
  const { chunk: minChunk } = cellToChunk(minX, minY, minZ);
  const { chunk: maxChunk } = cellToChunk(maxX, maxY, maxZ);
  for (let cx = minChunk[0]; cx <= maxChunk[0]; cx++) {
    for (let cy = minChunk[1]; cy <= maxChunk[1]; cy++) {
      for (let cz = minChunk[2]; cz <= maxChunk[2]; cz++) {
        ids.add(chunkKey(cx, cy, cz));
      }
    }
  }
  return [...ids];
}
