import * as THREE from 'three';
import { Player } from '../entities/Player';
import { CameraController } from '../core/CameraController';
import { InputManager } from '../core/InputManager';
import { UIManager } from '../ui/UIManager';
import { AABB, makeAABB, attemptMove } from '../utils/collision';
import { createChest, createFloor, createPortal, createTable, createTorch, createWallSegment, PALETTE } from '../utils/geometryFactory';
import { openCharacterPanel, openInventoryPanel, openSkillsPanel } from '../ui/panels';
import { PlayerState } from '../state/PlayerState';
import { Direction } from '../dungeon/DungeonGenerator';
import { updateWallFade } from '../scene/wallFade';

const ROOM_HALF = 11;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 1;

export class LobbyController {
  private group: THREE.Group | null = null;
  private wallAABBs: AABB[] = [];
  private wallMeshesByDir: Partial<Record<Direction, THREE.Mesh[]>> = {};
  private portalPos = new THREE.Vector3(0, 0, -8);
  private nearPortal = false;

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

    const floor = createFloor(ROOM_HALF * 2 + 1, ROOM_HALF * 2 + 1, PALETTE.stoneDark);
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
      const wall = createWallSegment(w, WALL_HEIGHT, d, PALETTE.stoneLight, true);
      wall.position.set(x, WALL_HEIGHT / 2, z);
      group.add(wall);
      this.wallAABBs.push(makeAABB(x, z, w / 2, d / 2));
      this.wallMeshesByDir[dir] = [wall];
    }

    const chest = createChest();
    chest.position.set(-7, 0, -7);
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
    for (const [x, z] of torchPositions) {
      const torch = createTorch();
      torch.position.set(x, 0, z);
      group.add(torch);
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
      { label: 'Personaje', onClick: () => openCharacterPanel(this.ui, this.playerState) },
      { label: 'Inventario', onClick: () => openInventoryPanel(this.ui, this.playerState) },
      { label: 'Habilidades', onClick: () => openSkillsPanel(this.ui, this.playerState) },
    ]);
  }

  teardown() {
    if (this.group) this.scene.remove(this.group);
    this.group = null;
    this.ui.setLobbyMenu(null);
    this.ui.setInteractPrompt(null);
  }

  update(delta: number) {
    const axis = this.input.getMovementAxis();
    if (axis.x !== 0 || axis.z !== 0) {
      const dir = this.camera.computeMoveDirection(axis.x, axis.z);
      const speed = this.player.effectiveSpeed;
      attemptMove(() => this.player.getAABB(), this.player, dir.x * speed * delta, dir.z * speed * delta, this.wallAABBs);
      this.player.setFacingFromMovement(dir.x, dir.z);
    }
    this.player.update(delta);
    updateWallFade(this.wallMeshesByDir, this.camera.yaw, delta, true);

    const dx = this.portalPos.x - this.player.position.x;
    const dz = this.portalPos.z - this.player.position.z;
    this.nearPortal = Math.hypot(dx, dz) < 2.6;
    this.ui.setInteractPrompt(this.nearPortal ? '[E] Entrar a la mazmorra' : null);

    if (this.nearPortal && this.input.wasJustPressed('KeyE')) {
      this.onEnterDungeon();
    }
  }
}
