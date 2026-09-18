import * as THREE from 'three';
import { Player } from '../entities/Player';
import { CameraController } from '../core/CameraController';
import { InputManager } from '../core/InputManager';
import { UIManager } from '../ui/UIManager';
import { AABB, makeAABB, attemptMove } from '../utils/collision';
import { createChest, createPillar, createPortal, createStoneBlockWall, createStoneTileFloor, createTable, createTorch, PALETTE } from '../utils/geometryFactory';
import { openBankPanel, openCharacterPanel, openUpgradesPanel } from '../ui/panels';
import { PlayerState } from '../state/PlayerState';
import { Direction } from '../dungeon/DungeonGenerator';
import { updateWallFade } from '../scene/wallFade';
import { updateTorchFlicker } from '../scene/torchFlicker';

const ROOM_HALF = 11;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 1;

// Castle great-hall palette — warmer, more varied flagstone tones for the
// floor (worn stone, not a flat dungeon slab) and a cooler cut-stone gray
// for walls/pillars, distinct from the dungeon proper's rougher dark stone.
const FLOOR_TILE_COLORS = ['#5c574e', '#4f4a42', '#665f54', '#453f37', '#59544a', '#4a453d'];
const WALL_STONE_COLORS = ['#5b5e63', '#4f5257', '#666a70', '#454850', '#5f6268', '#585b60'];
const PILLAR_POSITIONS: [number, number][] = [
  [-3, -4],
  [3, -4],
];

export class LobbyController {
  private group: THREE.Group | null = null;
  private wallAABBs: AABB[] = [];
  private wallMeshesByDir: Partial<Record<Direction, THREE.Mesh[]>> = {};
  private torchLights: THREE.PointLight[] = [];
  private elapsed = 0;
  private portalPos = new THREE.Vector3(0, 0, -8);
  private nearPortal = false;
  private chestPos = new THREE.Vector3(-7, 0, -7);
  private nearChest = false;

  constructor(
    private scene: THREE.Scene,
    private player: Player,
    private playerState: PlayerState,
    private ui: UIManager,
    private camera: CameraController,
    private input: InputManager,
    private onEnterDungeon: () => void,
  ) {}

  build(): THREE.Vector3 {
    const group = new THREE.Group();
    this.wallAABBs = [];

    const floor = createStoneTileFloor({
      halfExtent: ROOM_HALF,
      colors: FLOOR_TILE_COLORS,
      wobble: 0.02,
      raise: { x: this.portalPos.x, z: this.portalPos.z, radius: 3.5, height: 0.1 },
    });
    group.add(floor);

    const wallDefs: Array<[Direction, number, number, number, number]> = [
      // dir, x, z, width(along x), depth(along z)
      ['N', 0, -ROOM_HALF, ROOM_HALF * 2 + WALL_THICKNESS, WALL_THICKNESS],
      ['S', 0, ROOM_HALF, ROOM_HALF * 2 + WALL_THICKNESS, WALL_THICKNESS],
      ['W', -ROOM_HALF, 0, WALL_THICKNESS, ROOM_HALF * 2 + WALL_THICKNESS],
      ['E', ROOM_HALF, 0, WALL_THICKNESS, ROOM_HALF * 2 + WALL_THICKNESS],
    ];
    this.wallMeshesByDir = {};
    for (const [dir, x, z, w, d] of wallDefs) {
      const axis: 'x' | 'z' = dir === 'N' || dir === 'S' ? 'x' : 'z';
      const wall = createStoneBlockWall({
        length: axis === 'x' ? w : d,
        height: WALL_HEIGHT,
        thickness: axis === 'x' ? d : w,
        axis,
        colors: WALL_STONE_COLORS,
        fadeable: true,
      });
      wall.position.set(x, 0, z);
      group.add(wall);
      this.wallAABBs.push(makeAABB(x, z, w / 2, d / 2));
      this.wallMeshesByDir[dir] = [wall];
    }

    for (const [px, pz] of PILLAR_POSITIONS) {
      const pillar = createPillar(WALL_HEIGHT);
      pillar.position.set(px, 0, pz);
      group.add(pillar);
      this.wallAABBs.push(makeAABB(px, pz, 0.65, 0.65));
    }

    const chest = createChest();
    chest.position.copy(this.chestPos);
    chest.rotation.y = Math.PI / 4;
    group.add(chest);

    const table = createTable();
    table.position.set(6, 0, -6);
    group.add(table);

    const torchPositions: [number, number][] = [
      [-ROOM_HALF + 0.8, -ROOM_HALF + 0.8],
      [ROOM_HALF - 0.8, -ROOM_HALF + 0.8],
      [-ROOM_HALF + 0.8, ROOM_HALF - 0.8],
      [ROOM_HALF - 0.8, ROOM_HALF - 0.8],
    ];
    this.torchLights = [];
    for (const [x, z] of torchPositions) {
      const torch = createTorch();
      torch.group.position.set(x, 0, z);
      group.add(torch.group);
      this.torchLights.push(torch.light);
    }

    const portal = createPortal(PALETTE.loot);
    portal.position.copy(this.portalPos);
    group.add(portal);

    this.group = group;
    this.scene.add(group);
    this.setupMenu();

    return new THREE.Vector3(0, 0, 4);
  }

  private setupMenu() {
    this.ui.setLobbyMenu([
      { label: 'Personaje', onClick: () => openCharacterPanel(this.ui, this.playerState, this.player) },
      { label: 'Mejoras', onClick: () => openUpgradesPanel(this.ui, this.playerState, this.player) },
    ]);
    this.ui.showSoulsDisplay(true);
  }

  /** Snapshot of debug data for the DEV-mode hitbox overlay + info panel. */
  getDevOverlayInfo() {
    return { walls: this.wallAABBs, rooms: [], enemies: [], traps: [], roomLabel: 'lobby', enemyCount: 0, projectileCount: 0, particleCount: 0 };
  }

  teardown() {
    if (this.group) this.scene.remove(this.group);
    this.group = null;
    this.ui.setLobbyMenu(null);
    this.ui.setInteractPrompt(null);
    this.ui.showSoulsDisplay(false);
  }

  update(delta: number) {
    this.elapsed += delta;
    updateTorchFlicker(this.torchLights, this.elapsed);

    const axis = this.input.getMovementAxis();
    if (axis.x !== 0 || axis.z !== 0) {
      const dir = this.camera.computeMoveDirection(axis.x, axis.z);
      const speed = this.player.effectiveSpeed;
      attemptMove(() => this.player.getAABB(), this.player, dir.x * speed * delta, dir.z * speed * delta, this.wallAABBs);
      this.player.setFacingFromMovement(dir.x, dir.z);
    }
    this.player.update(delta);
    updateWallFade(this.wallMeshesByDir, this.camera.yaw, delta, true);
    this.ui.updateSoulsDisplay(this.playerState.souls);

    const dx = this.portalPos.x - this.player.position.x;
    const dz = this.portalPos.z - this.player.position.z;
    this.nearPortal = Math.hypot(dx, dz) < 2.6;

    const cdx = this.chestPos.x - this.player.position.x;
    const cdz = this.chestPos.z - this.player.position.z;
    this.nearChest = Math.hypot(cdx, cdz) < 2.4;

    if (this.nearPortal) {
      this.ui.setInteractPrompt('[E] Entrar a la mazmorra');
    } else if (this.nearChest) {
      this.ui.setInteractPrompt('[E] Abrir banco');
    } else {
      this.ui.setInteractPrompt(null);
    }

    if (this.input.wasJustPressed('KeyE')) {
      if (this.nearPortal) {
        this.onEnterDungeon();
      } else if (this.nearChest) {
        openBankPanel(this.ui, this.playerState);
      }
    }
  }
}
