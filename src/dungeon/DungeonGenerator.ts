export type RoomType = 'start' | 'combat' | 'treasure';
export type Direction = 'N' | 'S' | 'E' | 'W';

export const DIRECTIONS: Direction[] = ['N', 'S', 'E', 'W'];

export const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export const DIR_OFFSET: Record<Direction, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

export interface RoomNode {
  id: string;
  gridX: number;
  gridY: number;
  type: RoomType;
  doors: Partial<Record<Direction, string>>; // direction -> connected room id
  enemyCount: number;
  cleared: boolean;
}

export interface DungeonGraph {
  rooms: Map<string, RoomNode>;
  startRoomId: string;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateDungeonGraph(): DungeonGraph {
  const targetCount = randInt(5, 8);
  const rooms = new Map<string, RoomNode>();
  const occupied = new Set<string>();

  const startId = key(0, 0);
  const startRoom: RoomNode = {
    id: startId,
    gridX: 0,
    gridY: 0,
    type: 'start',
    doors: {},
    enemyCount: 0,
    cleared: true,
  };
  rooms.set(startId, startRoom);
  occupied.add(key(0, 0));

  const frontier: RoomNode[] = [startRoom];

  while (rooms.size < targetCount && frontier.length > 0) {
    const from = frontier[randInt(0, frontier.length - 1)];
    const shuffledDirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);
    let grew = false;

    for (const dir of shuffledDirs) {
      const offset = DIR_OFFSET[dir];
      const nx = from.gridX + offset.dx;
      const ny = from.gridY + offset.dy;
      const nk = key(nx, ny);
      if (occupied.has(nk)) continue;

      const newRoom: RoomNode = {
        id: nk,
        gridX: nx,
        gridY: ny,
        type: 'combat',
        doors: {},
        enemyCount: 0,
        cleared: false,
      };
      from.doors[dir] = nk;
      newRoom.doors[OPPOSITE[dir]] = from.id;

      rooms.set(nk, newRoom);
      occupied.add(nk);
      frontier.push(newRoom);
      grew = true;
      break;
    }

    if (!grew) {
      const idx = frontier.indexOf(from);
      if (idx >= 0) frontier.splice(idx, 1);
    }
  }

  // Pick a leaf room (single connection, not start) to become the treasure room.
  const leaves = [...rooms.values()].filter((r) => r.type !== 'start' && Object.keys(r.doors).length === 1);
  if (leaves.length > 0) {
    const treasureRoom = leaves[randInt(0, leaves.length - 1)];
    treasureRoom.type = 'treasure';
  }

  for (const room of rooms.values()) {
    if (room.type === 'combat') {
      room.enemyCount = randInt(1, 4);
    }
  }

  return { rooms, startRoomId: startId };
}
