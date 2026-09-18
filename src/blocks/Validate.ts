import { DIRECTIONS, DIR_OFFSET, DungeonGraph, RoomNode } from '../dungeon/DungeonGenerator';
import { GRID_SPACING, ROOM_SIZE, WALL_HEIGHT } from '../dungeon/DungeonBuilder';
import { BlockGrid } from './BlockGrid';

/**
 * Concrete, checkable form of the plan's "face matching" idea. An abstract
 * 4-value open/solid/wallEnd/void socket algebra turned out to mis-model the
 * one case that matters most here — a wall's inner face bounding open room
 * space is correct, not a defect — so this validates three specific,
 * meaningful invariants instead of a generic pairwise socket table:
 *
 *  1. Every wall/door/corner ring cell has a structural neighbor continuing
 *     the ring (no gaps left by a stamping bug).
 *  2. Every door leads to real floor on both sides (never straight into void).
 *  3. Every interior floor cell has clear headroom up to WALL_HEIGHT (no
 *     wall accidentally bled into the walkable interior).
 *
 * Returns a list of human-readable issues; empty means the grid is consistent.
 */
export function validateBlockGrid(grid: BlockGrid, graph: DungeonGraph): string[] {
  const issues: string[] = [];
  const HALF_ROOM = ROOM_SIZE / 2;

  for (const node of graph.rooms.values()) {
    checkRing(grid, node, HALF_ROOM, issues);
    checkHeadroom(grid, node, HALF_ROOM, issues);
  }

  return issues;
}

function checkRing(grid: BlockGrid, node: RoomNode, halfRoom: number, issues: string[]): void {
  const worldX = node.gridX * GRID_SPACING;
  const worldZ = node.gridY * GRID_SPACING;
  const min = -halfRoom;
  const max = halfRoom - 1;

  const ringCells: Array<[number, number]> = [];
  for (let lx = min; lx <= max; lx++) {
    ringCells.push([lx, min], [lx, max]);
  }
  for (let lz = min + 1; lz <= max - 1; lz++) {
    ringCells.push([min, lz], [max, lz]);
  }

  for (const [lx, lz] of ringCells) {
    for (let y = 1; y <= WALL_HEIGHT; y++) {
      const here = grid.get(worldX + lx, y, worldZ + lz);
      if (!here || here.type === 'floor' || here.type === 'decoration') {
        issues.push(`room ${node.id}: ring cell (${lx},${y},${lz}) is not structural (${here?.type ?? 'air'})`);
        continue;
      }
      if (here.type !== 'door') continue;
      // A door's two blocking-direction neighbors (one step further out on
      // each side) must both land on floor — never straight into void.
      for (const dir of DIRECTIONS) {
        const { dx, dy } = DIR_OFFSET[dir];
        const neighbor = grid.get(worldX + lx + dx, 0, worldZ + lz + dy);
        const isBlockingAxis = (dx !== 0 && (lx === min || lx === max)) || (dy !== 0 && (lz === min || lz === max));
        if (!isBlockingAxis) continue;
        if (!neighbor || neighbor.type !== 'floor') {
          issues.push(`room ${node.id}: door at (${lx},${lz}) has no floor beyond it toward ${dir}`);
        }
      }
    }
  }
}

function checkHeadroom(grid: BlockGrid, node: RoomNode, halfRoom: number, issues: string[]): void {
  const worldX = node.gridX * GRID_SPACING;
  const worldZ = node.gridY * GRID_SPACING;
  const min = -halfRoom + 1;
  const max = halfRoom - 2;

  for (let lx = min; lx <= max; lx++) {
    for (let lz = min; lz <= max; lz++) {
      for (let y = 1; y <= WALL_HEIGHT; y++) {
        const cell = grid.get(worldX + lx, y, worldZ + lz);
        if (cell && cell.type !== 'decoration') {
          issues.push(`room ${node.id}: interior cell (${lx},${lz}) blocked by ${cell.type} at y=${y}`);
        }
      }
    }
  }
}
