import { DIRECTIONS, Direction, DIR_OFFSET, DungeonGraph, RoomNode } from '../dungeon/DungeonGenerator';
import { DOOR_WIDTH, GRID_SPACING, ROOM_SIZE, WALL_HEIGHT } from '../dungeon/DungeonBuilder';
import { BlockGrid, PlacedBlock, WallAxis } from './BlockGrid';

/**
 * Layer B of the block-map plan: stamps the existing (unchanged) room graph
 * from DungeonGenerator into an explicit per-cell BlockGrid, instead of
 * DungeonBuilder's current approach of emitting one big mesh per wall/floor.
 * Reuses DungeonBuilder's own constants as the single source of truth, so
 * this always describes the same room shape the live renderer builds —
 * it does not (yet) replace that renderer; it's an additive, verifiable
 * translation you can run and inspect on its own.
 *
 * Deliberately does NOT try to reproduce DungeonBuilder's cosmetic mesh
 * fudge factors (the floor's "+0.4" overlap bleed, the wall's "+WALL_THICKNESS"
 * length pad) — those exist only to hide seams between continuous meshes,
 * which is exactly the problem a block grid's exact-cell adjacency removes.
 * The block grid uses the clean integer constants (16, 4, 4, 20) directly.
 */

const HALF_ROOM = ROOM_SIZE / 2; // 8
const SIDE_SEGMENT_LEN = (ROOM_SIZE - DOOR_WIDTH) / 2; // 6
const CORRIDOR_LENGTH = GRID_SPACING - ROOM_SIZE; // 4

const WALL_AXIS_BY_DIR: Record<Direction, WallAxis> = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' };

/** Local (room-relative) min/max cell index along the wall-ring's two axes. */
const LOCAL_MIN = -HALF_ROOM; // -8
const LOCAL_MAX = HALF_ROOM - 1; // 7, giving exactly ROOM_SIZE (16) cells: -8..7

function doorGapRange(): [number, number] {
  const gapStart = -DOOR_WIDTH / 2; // -2
  return [gapStart, gapStart + DOOR_WIDTH - 1]; // -2..1 (4 cells)
}

/** Fills one room's floor, wall ring, corners and door gaps into `grid`, in world cells. */
function stampRoom(grid: BlockGrid, node: RoomNode): void {
  const worldX = node.gridX * GRID_SPACING;
  const worldZ = node.gridY * GRID_SPACING;
  const [gapLo, gapHi] = doorGapRange();

  // Floor spans the room's full footprint, including under the wall ring —
  // matches the existing single-plane floor, which already extends that far.
  for (let lx = LOCAL_MIN; lx <= LOCAL_MAX; lx++) {
    for (let lz = LOCAL_MIN; lz <= LOCAL_MAX; lz++) {
      grid.set(worldX + lx, 0, worldZ + lz, { type: 'floor' });
    }
  }

  const isCorner = (lx: number, lz: number) =>
    (lx === LOCAL_MIN || lx === LOCAL_MAX) && (lz === LOCAL_MIN || lz === LOCAL_MAX);

  const cornerDirs = (lx: number, lz: number): [Direction, Direction] => [
    lz === LOCAL_MIN ? 'N' : 'S',
    lx === LOCAL_MIN ? 'W' : 'E',
  ];

  for (let y = 1; y <= WALL_HEIGHT; y++) {
    // North/South rows (fixed lz, varying lx) and East/West columns (fixed lx, varying lz).
    for (let lx = LOCAL_MIN; lx <= LOCAL_MAX; lx++) {
      placeRingCell(grid, node, worldX, worldZ, lx, LOCAL_MIN, y, 'N', gapLo, gapHi, isCorner, cornerDirs);
      placeRingCell(grid, node, worldX, worldZ, lx, LOCAL_MAX, y, 'S', gapLo, gapHi, isCorner, cornerDirs);
    }
    for (let lz = LOCAL_MIN + 1; lz <= LOCAL_MAX - 1; lz++) {
      placeRingCell(grid, node, worldX, worldZ, LOCAL_MIN, lz, y, 'W', gapLo, gapHi, isCorner, cornerDirs);
      placeRingCell(grid, node, worldX, worldZ, LOCAL_MAX, lz, y, 'E', gapLo, gapHi, isCorner, cornerDirs);
    }
  }
}

function placeRingCell(
  grid: BlockGrid,
  node: RoomNode,
  worldX: number,
  worldZ: number,
  lx: number,
  lz: number,
  y: number,
  sideDir: Direction,
  gapLo: number,
  gapHi: number,
  isCorner: (lx: number, lz: number) => boolean,
  cornerDirs: (lx: number, lz: number) => [Direction, Direction],
): void {
  const x = worldX + lx;
  const z = worldZ + lz;
  if (isCorner(lx, lz)) {
    grid.set(x, y, z, { type: 'corner', corner: cornerDirs(lx, lz) });
    return;
  }
  const along = sideDir === 'N' || sideDir === 'S' ? lx : lz;
  const inGap = along >= gapLo && along <= gapHi;
  const block: PlacedBlock = inGap
    ? { type: node.doors[sideDir] ? 'door' : 'wall', wallAxis: WALL_AXIS_BY_DIR[sideDir] }
    : { type: 'wall', wallAxis: WALL_AXIS_BY_DIR[sideDir] };
  grid.set(x, y, z, block);
}

/** Fills the bare floor strip between two doored rooms (no walls — matches
 * DungeonBuilder's existing corridors, which are open hallways). */
function stampCorridor(grid: BlockGrid, from: RoomNode, dir: Direction): void {
  const { dx, dy } = DIR_OFFSET[dir];
  const fromWorldX = from.gridX * GRID_SPACING;
  const fromWorldZ = from.gridY * GRID_SPACING;
  const [gapLo, gapHi] = doorGapRange();

  // The ring's outer edge sits at local index `HALF_ROOM - 1` on the positive
  // side and `-HALF_ROOM` on the negative side (see LOCAL_MIN/LOCAL_MAX) — so
  // "one cell past the wall" is `+HALF_ROOM` going out the positive side, but
  // `-(HALF_ROOM + 1)` going out the negative side, not `-HALF_ROOM` (which
  // would land back on the wall's own row instead of past it).
  const edgeOutAxis = (offset: number) => (offset > 0 ? HALF_ROOM : -(HALF_ROOM + 1));
  const alongLocalBase = dx !== 0 ? edgeOutAxis(dx) : edgeOutAxis(dy);

  for (let step = 0; step < CORRIDOR_LENGTH; step++) {
    // One row/column of the corridor, `step` cells past this room's own wall ring.
    const along = alongLocalBase + (dx !== 0 ? dx : dy) * step;
    for (let cross = gapLo; cross <= gapHi; cross++) {
      const x = dx !== 0 ? fromWorldX + along : fromWorldX + cross;
      const z = dy !== 0 ? fromWorldZ + along : fromWorldZ + cross;
      grid.set(x, 0, z, { type: 'floor' });
    }
  }
}

export function buildBlockGridFromDungeonGraph(graph: DungeonGraph): BlockGrid {
  const grid = new BlockGrid();
  const visitedEdges = new Set<string>();

  for (const node of graph.rooms.values()) {
    stampRoom(grid, node);
  }

  for (const node of graph.rooms.values()) {
    for (const dir of DIRECTIONS) {
      const neighborId = node.doors[dir];
      if (!neighborId) continue;
      const edgeKey = [node.id, neighborId].sort().join('|');
      if (visitedEdges.has(edgeKey)) continue;
      visitedEdges.add(edgeKey);
      stampCorridor(grid, node, dir);
    }
  }

  return grid;
}
