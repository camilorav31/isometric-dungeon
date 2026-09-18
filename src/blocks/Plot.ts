import { BlockType, chunkIdsForBounds } from './BlockGrid';

/**
 * A player-buildable region, living in the exact same integer cell space
 * (world units, since B=1) as dungeon rooms — not a parallel coordinate
 * system. Housing streams through the same chunk mechanism dungeon rooms
 * do: `chunkIds` are computed with the same `chunkIdsForBounds` helper
 * BlockGrid itself uses, so a plot and a dungeon room are interchangeable
 * from the streaming layer's point of view.
 */
export interface Plot {
  id: string;
  ownerId: string;
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  allowedBlockTypes: BlockType[];
  chunkIds: string[];
}

export function createPlot(
  id: string,
  ownerId: string,
  bounds: Plot['bounds'],
  allowedBlockTypes: BlockType[] = ['floor', 'wall', 'corner', 'door', 'stair', 'decoration'],
): Plot {
  const chunkIds = chunkIdsForBounds(bounds.minX, bounds.minY, bounds.minZ, bounds.maxX, bounds.maxY, bounds.maxZ);
  return { id, ownerId, bounds, allowedBlockTypes, chunkIds };
}

export function plotContainsCell(plot: Plot, x: number, y: number, z: number): boolean {
  const b = plot.bounds;
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ;
}
