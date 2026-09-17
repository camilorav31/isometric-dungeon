import * as THREE from 'three';
import { DIRECTIONS, Direction, DungeonGraph, RoomNode } from './DungeonGenerator';
import { AABB, makeAABB } from '../utils/collision';
import {
  createDoorBlocker,
  createFloor,
  createPillar,
  createPortal,
  createTorch,
  createTreasureItem,
  createWallSegment,
  PALETTE,
} from '../utils/geometryFactory';
import { Enemy, EnemyType } from '../entities/Enemy';
import { Trap } from './Trap';

export const ROOM_SIZE = 16;
export const WALL_THICKNESS = 1;
export const WALL_HEIGHT = 4;
export const GRID_SPACING = 20;
export const DOOR_WIDTH = 4;
const CORRIDOR_LENGTH = GRID_SPACING - ROOM_SIZE;
const CORRIDOR_HALF = CORRIDOR_LENGTH / 2;
const HALF_ROOM = ROOM_SIZE / 2;
const SIDE_SEGMENT_LEN = (ROOM_SIZE - DOOR_WIDTH) / 2;

export interface RuntimeRoom {
  node: RoomNode;
  worldX: number;
  worldZ: number;
  bounds: AABB;
  /** Walls/floor/torches/pillars for this room — toggled wholesale for render/light culling. */
  roomGroup: THREE.Group;
  doorBlockerMeshes: Partial<Record<Direction, THREE.Mesh>>;
  wallMeshesByDir: Partial<Record<Direction, THREE.Mesh[]>>;
  sealed: boolean;
  enemies: Enemy[];
  treasureMesh?: THREE.Group;
  treasureCollected: boolean;
  portalMesh?: THREE.Group;
  descendMesh?: THREE.Group;
  activated: boolean;
  /** Whether the player has ever stood in this room — gates minimap visibility. */
  visited: boolean;
}

export interface BuiltDungeon {
  group: THREE.Group;
  rooms: Map<string, RuntimeRoom>;
  staticWallAABBs: AABB[];
  traps: Trap[];
  torchLights: THREE.PointLight[];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickEnemyType(): EnemyType {
  const roll = Math.random();
  if (roll < 0.45) return 'melee';
  if (roll < 0.8) return 'ranged';
  return 'tank';
}

export function getBlockerAABB(room: RuntimeRoom, dir: Direction): AABB {
  const isVertical = dir === 'N' || dir === 'S';
  const wallZ = dir === 'N' ? -HALF_ROOM : dir === 'S' ? HALF_ROOM : 0;
  const wallX = dir === 'E' ? HALF_ROOM : dir === 'W' ? -HALF_ROOM : 0;
  if (isVertical) {
    return makeAABB(room.worldX, room.worldZ + wallZ, DOOR_WIDTH / 2, WALL_THICKNESS / 2);
  }
  return makeAABB(room.worldX + wallX, room.worldZ, WALL_THICKNESS / 2, DOOR_WIDTH / 2);
}

const PILLAR_OFFSETS: [number, number][] = [
  [-4, -4],
  [4, -4],
  [-4, 4],
  [4, 4],
  [-4, 0],
  [4, 0],
];

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function buildDungeon(graph: DungeonGraph, difficultyMultiplier = 1): BuiltDungeon {
  const group = new THREE.Group();
  const rooms = new Map<string, RuntimeRoom>();
  const staticWallAABBs: AABB[] = [];
  const traps: Trap[] = [];
  const torchLights: THREE.PointLight[] = [];

  for (const node of graph.rooms.values()) {
    const worldX = node.gridX * GRID_SPACING;
    const worldZ = node.gridY * GRID_SPACING;
    const roomGroup = new THREE.Group();
    roomGroup.position.set(worldX, 0, worldZ);

    const floorColor = node.type === 'treasure' ? '#3a3428' : node.type === 'boss' ? '#3a1f1f' : PALETTE.stoneDark;
    const floor = createFloor(ROOM_SIZE + 0.4, ROOM_SIZE + 0.4, floorColor);
    roomGroup.add(floor);

    const doorBlockerMeshes: Partial<Record<Direction, THREE.Mesh>> = {};
    const wallMeshesByDir: Partial<Record<Direction, THREE.Mesh[]>> = {};

    for (const dir of DIRECTIONS) {
      const hasDoor = !!node.doors[dir];
      const isVertical = dir === 'N' || dir === 'S'; // wall runs along X axis
      const wallZ = dir === 'N' ? -HALF_ROOM : dir === 'S' ? HALF_ROOM : 0;
      const wallX = dir === 'E' ? HALF_ROOM : dir === 'W' ? -HALF_ROOM : 0;

      if (!hasDoor) {
        if (isVertical) {
          const wall = createWallSegment(ROOM_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS, PALETTE.stoneLight, true);
          wall.position.set(0, WALL_HEIGHT / 2, wallZ);
          roomGroup.add(wall);
          wallMeshesByDir[dir] = [wall];
          staticWallAABBs.push(makeAABB(worldX, worldZ + wallZ, (ROOM_SIZE + WALL_THICKNESS) / 2, WALL_THICKNESS / 2));
        } else {
          const wall = createWallSegment(WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE + WALL_THICKNESS, PALETTE.stoneLight, true);
          wall.position.set(wallX, WALL_HEIGHT / 2, 0);
          roomGroup.add(wall);
          wallMeshesByDir[dir] = [wall];
          staticWallAABBs.push(makeAABB(worldX + wallX, worldZ, WALL_THICKNESS / 2, (ROOM_SIZE + WALL_THICKNESS) / 2));
        }
        continue;
      }

      // Door present: two flanking segments + gap; gap filled with corridor floor + a togglable blocker.
      if (isVertical) {
        const segA = createWallSegment(SIDE_SEGMENT_LEN, WALL_HEIGHT, WALL_THICKNESS, PALETTE.stoneLight, true);
        segA.position.set(-(DOOR_WIDTH / 2 + SIDE_SEGMENT_LEN / 2), WALL_HEIGHT / 2, wallZ);
        const segB = createWallSegment(SIDE_SEGMENT_LEN, WALL_HEIGHT, WALL_THICKNESS, PALETTE.stoneLight, true);
        segB.position.set(DOOR_WIDTH / 2 + SIDE_SEGMENT_LEN / 2, WALL_HEIGHT / 2, wallZ);
        roomGroup.add(segA, segB);
        wallMeshesByDir[dir] = [segA, segB];
        staticWallAABBs.push(
          makeAABB(worldX + segA.position.x, worldZ + wallZ, SIDE_SEGMENT_LEN / 2, WALL_THICKNESS / 2),
        );
        staticWallAABBs.push(
          makeAABB(worldX + segB.position.x, worldZ + wallZ, SIDE_SEGMENT_LEN / 2, WALL_THICKNESS / 2),
        );

        const corridorFloor = createFloor(DOOR_WIDTH, CORRIDOR_HALF, PALETTE.stoneDark);
        const corridorZ = wallZ + (dir === 'N' ? -CORRIDOR_HALF / 2 : CORRIDOR_HALF / 2);
        corridorFloor.position.set(0, 0, corridorZ);
        roomGroup.add(corridorFloor);

        const blocker = createDoorBlocker(DOOR_WIDTH, WALL_HEIGHT, WALL_THICKNESS);
        blocker.position.set(0, WALL_HEIGHT / 2, wallZ);
        blocker.visible = false;
        roomGroup.add(blocker);
        doorBlockerMeshes[dir] = blocker;
      } else {
        const segA = createWallSegment(WALL_THICKNESS, WALL_HEIGHT, SIDE_SEGMENT_LEN, PALETTE.stoneLight, true);
        segA.position.set(wallX, WALL_HEIGHT / 2, -(DOOR_WIDTH / 2 + SIDE_SEGMENT_LEN / 2));
        const segB = createWallSegment(WALL_THICKNESS, WALL_HEIGHT, SIDE_SEGMENT_LEN, PALETTE.stoneLight, true);
        segB.position.set(wallX, WALL_HEIGHT / 2, DOOR_WIDTH / 2 + SIDE_SEGMENT_LEN / 2);
        roomGroup.add(segA, segB);
        wallMeshesByDir[dir] = [segA, segB];
        staticWallAABBs.push(
          makeAABB(worldX + wallX, worldZ + segA.position.z, WALL_THICKNESS / 2, SIDE_SEGMENT_LEN / 2),
        );
        staticWallAABBs.push(
          makeAABB(worldX + wallX, worldZ + segB.position.z, WALL_THICKNESS / 2, SIDE_SEGMENT_LEN / 2),
        );

        const corridorFloor = createFloor(CORRIDOR_HALF, DOOR_WIDTH, PALETTE.stoneDark);
        const corridorX = wallX + (dir === 'W' ? -CORRIDOR_HALF / 2 : CORRIDOR_HALF / 2);
        corridorFloor.position.set(corridorX, 0, 0);
        roomGroup.add(corridorFloor);

        const blocker = createDoorBlocker(WALL_THICKNESS, WALL_HEIGHT, DOOR_WIDTH);
        blocker.position.set(wallX, WALL_HEIGHT / 2, 0);
        blocker.visible = false;
        roomGroup.add(blocker);
        doorBlockerMeshes[dir] = blocker;
      }
    }

    // Corner torches for ambience.
    const torchOffsets: [number, number][] = [
      [-HALF_ROOM + 0.6, -HALF_ROOM + 0.6],
      [HALF_ROOM - 0.6, -HALF_ROOM + 0.6],
      [-HALF_ROOM + 0.6, HALF_ROOM - 0.6],
      [HALF_ROOM - 0.6, HALF_ROOM - 0.6],
    ];
    for (const [tx, tz] of torchOffsets) {
      const torch = createTorch();
      torch.group.position.set(tx, 0, tz);
      roomGroup.add(torch.group);
      torchLights.push(torch.light);
    }

    // Interior pillars: tactical cover/obstacles in combat and boss rooms.
    const wantsPillars = node.type === 'boss' || (node.type === 'combat' && Math.random() < 0.5);
    if (wantsPillars) {
      const count = node.type === 'boss' ? 4 : randInt(2, 3);
      for (const [px, pz] of shuffled(PILLAR_OFFSETS).slice(0, count)) {
        const pillar = createPillar(WALL_HEIGHT);
        pillar.position.set(px, 0, pz);
        roomGroup.add(pillar);
        staticWallAABBs.push(makeAABB(worldX + px, worldZ + pz, 0.65, 0.65));
      }
    }

    // A spike trap adds ambient danger independent of the room's enemies (skip
    // rooms that already got pillars, so the two obstacle types never overlap).
    if (node.type === 'combat' && !wantsPillars && Math.random() < 0.35) {
      const [tx, tz] = PILLAR_OFFSETS[randInt(0, PILLAR_OFFSETS.length - 1)];
      const trap = new Trap(worldX + tx, worldZ + tz);
      group.add(trap.group);
      traps.push(trap);
    }

    const runtimeRoom: RuntimeRoom = {
      node,
      worldX,
      worldZ,
      bounds: makeAABB(worldX, worldZ, HALF_ROOM, HALF_ROOM),
      roomGroup,
      doorBlockerMeshes,
      wallMeshesByDir,
      sealed: false,
      enemies: [],
      treasureCollected: false,
      activated: node.type === 'start',
      visited: node.type === 'start',
    };

    if (node.type === 'combat') {
      for (let i = 0; i < node.enemyCount; i++) {
        const enemy = new Enemy(pickEnemyType(), node.id, difficultyMultiplier);
        const angle = Math.random() * Math.PI * 2;
        const radius = randInt(2, Math.floor(HALF_ROOM - 3));
        enemy.group.position.set(worldX + Math.cos(angle) * radius, 0, worldZ + Math.sin(angle) * radius);
        enemy.group.visible = false;
        runtimeRoom.enemies.push(enemy);
        group.add(enemy.group);
      }
    } else if (node.type === 'boss') {
      const boss = new Enemy('boss', node.id, difficultyMultiplier);
      boss.group.position.set(worldX, 0, worldZ);
      boss.group.visible = false;
      runtimeRoom.enemies.push(boss);
      group.add(boss.group);

      // Revealed once the boss falls: a stairway deeper, offered alongside the
      // safer choice of walking back to the start room's lobby portal.
      const descend = createPortal('#c9682a');
      descend.position.set(worldX, 0, worldZ + 4);
      descend.visible = false;
      group.add(descend);
      runtimeRoom.descendMesh = descend;
    } else if (node.type === 'treasure') {
      const treasure = createTreasureItem();
      treasure.position.set(worldX, 0, worldZ);
      group.add(treasure);
      runtimeRoom.treasureMesh = treasure;
    } else if (node.type === 'start') {
      const portal = createPortal();
      portal.position.set(worldX, 0, worldZ - 4);
      group.add(portal);
      runtimeRoom.portalMesh = portal;
    }

    group.add(roomGroup);
    rooms.set(node.id, runtimeRoom);
  }

  return { group, rooms, staticWallAABBs, traps, torchLights };
}
