import * as THREE from 'three';
import { generateDungeonGraph } from './DungeonGenerator';
import { buildDungeon, BuiltDungeon, RuntimeRoom, getBlockerAABB } from './DungeonBuilder';
import { DIRECTIONS } from './DungeonGenerator';
import { Player } from '../entities/Player';
import { Projectile, PROJECTILE_RADIUS } from '../entities/Projectile';
import { CameraController } from '../core/CameraController';
import { InputManager } from '../core/InputManager';
import { UIManager } from '../ui/UIManager';
import { AABB, intersects, makeAABB, circleIntersects, attemptMove } from '../utils/collision';
import { LOOT_TABLE, makeLootItem } from '../state/PlayerState';

export class DungeonController {
  scene: THREE.Scene;
  player: Player;
  ui: UIManager;
  camera: CameraController;
  input: InputManager;

  private built: BuiltDungeon | null = null;
  private projectiles: Projectile[] = [];
  private nearPortal = false;
  private onExitToLobby: (won: boolean) => void;
  private onPlayerDied: () => void;

  constructor(
    scene: THREE.Scene,
    player: Player,
    ui: UIManager,
    camera: CameraController,
    input: InputManager,
    onExitToLobby: (won: boolean) => void,
    onPlayerDied: () => void,
  ) {
    this.scene = scene;
    this.player = player;
    this.ui = ui;
    this.camera = camera;
    this.input = input;
    this.onExitToLobby = onExitToLobby;
    this.onPlayerDied = onPlayerDied;
  }

  generate(): THREE.Vector3 {
    this.dispose();
    const graph = generateDungeonGraph();
    this.built = buildDungeon(graph);
    this.scene.add(this.built.group);

    for (const room of this.built.rooms.values()) {
      for (const enemy of room.enemies) {
        this.ui.registerHealthBar(enemy);
      }
    }

    this.ui.showRoomBanner('Has entrado a la mazmorra');
    return new THREE.Vector3(0, 0, 3);
  }

  dispose() {
    if (!this.built) return;
    for (const room of this.built.rooms.values()) {
      for (const enemy of room.enemies) {
        this.ui.unregisterHealthBar(enemy);
      }
    }
    this.scene.remove(this.built.group);
    this.built = null;
    this.projectiles = [];
  }

  private getAllObstacles(): AABB[] {
    if (!this.built) return [];
    const obstacles = [...this.built.staticWallAABBs];
    for (const room of this.built.rooms.values()) {
      if (!room.sealed) continue;
      for (const dir of DIRECTIONS) {
        if (room.doorBlockerMeshes[dir]) obstacles.push(getBlockerAABB(room, dir));
      }
    }
    return obstacles;
  }

  private findRoomContaining(x: number, z: number): RuntimeRoom | null {
    if (!this.built) return null;
    for (const room of this.built.rooms.values()) {
      if (x >= room.bounds.minX && x <= room.bounds.maxX && z >= room.bounds.minZ && z <= room.bounds.maxZ) {
        return room;
      }
    }
    return null;
  }

  private sealRoom(room: RuntimeRoom) {
    room.sealed = true;
    for (const dir of DIRECTIONS) {
      const mesh = room.doorBlockerMeshes[dir];
      if (mesh) mesh.visible = true;
    }
  }

  private unsealRoom(room: RuntimeRoom) {
    room.sealed = false;
    for (const dir of DIRECTIONS) {
      const mesh = room.doorBlockerMeshes[dir];
      if (mesh) mesh.visible = false;
    }
  }

  update(delta: number) {
    if (!this.built) return;

    this.player.update(delta);
    if (this.skillCooldownRemaining > 0) this.skillCooldownRemaining -= delta;

    // ---- player movement (camera-relative) ----
    const axis = this.input.getMovementAxis();
    if (axis.x !== 0 || axis.z !== 0) {
      const dir = this.camera.computeMoveDirection(axis.x, axis.z);
      const speed = this.player.effectiveSpeed;
      const obstacles = this.getAllObstacles();
      attemptMove(() => this.player.getAABB(), this.player, dir.x * speed * delta, dir.z * speed * delta, obstacles);
      this.player.setFacingFromMovement(dir.x, dir.z);
    }

    // ---- player attack ----
    const wantsAttack = this.input.consumeLeftClick() || this.input.wasJustPressed('Space');
    if (wantsAttack) {
      const attack = this.player.performAttack();
      if (attack) {
        for (const room of this.built.rooms.values()) {
          for (const enemy of room.enemies) {
            if (!enemy.alive) continue;
            const dx = enemy.position.x - this.player.position.x;
            const dz = enemy.position.z - this.player.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > attack.range) continue;
            if (!Player.isWithinAttackCone(attack.facingAngle, dx, dz)) continue;
            enemy.takeDamage(attack.damage);
          }
        }
      }
    }

    // ---- skill activation ----
    if (this.input.wasJustPressed('Digit1')) {
      this.tryUseSkill();
    }

    // ---- room activation check ----
    const currentRoom = this.findRoomContaining(this.player.position.x, this.player.position.z);
    if (currentRoom && currentRoom.node.type === 'combat' && !currentRoom.activated) {
      currentRoom.activated = true;
      const aliveEnemies = currentRoom.enemies.filter((e) => e.alive);
      if (aliveEnemies.length > 0) {
        this.sealRoom(currentRoom);
        for (const enemy of currentRoom.enemies) enemy.active = true;
        this.ui.showRoomBanner('¡Enemigos cerca!');
      } else {
        currentRoom.node.cleared = true;
      }
    }
    // ---- enemy AI + projectiles for active rooms ----
    const obstaclesForEnemies = this.getAllObstacles();
    for (const room of this.built.rooms.values()) {
      if (room.node.type !== 'combat' || !room.activated || room.node.cleared) continue;

      let anyAlive = false;
      for (const enemy of room.enemies) {
        if (!enemy.alive) continue;
        anyAlive = true;
        if (!enemy.group.visible) enemy.group.visible = true;

        const result = enemy.aiUpdate(delta, this.player.position);
        if (result.moveX !== 0 || result.moveZ !== 0) {
          attemptMove(
            () => enemy.getAABB(),
            enemy,
            result.moveX * delta,
            result.moveZ * delta,
            obstaclesForEnemies,
          );
        }
        if (result.meleeAttack) {
          this.player.takeDamage(enemy.damage);
        }
        if (result.shoot) {
          const proj = new Projectile(
            enemy.position.x,
            enemy.position.z,
            result.shoot.dirX,
            result.shoot.dirZ,
            result.shoot.damage,
            room.node.id,
          );
          this.projectiles.push(proj);
          this.built.group.add(proj.group);
        }
      }

      if (!anyAlive && !room.node.cleared) {
        room.node.cleared = true;
        this.unsealRoom(room);
        this.ui.showToast('Sala despejada');
      }
    }

    // ---- projectiles ----
    const wallObstacles = this.built.staticWallAABBs;
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      proj.update(delta);

      if (
        circleIntersects(proj.group.position.x, proj.group.position.z, PROJECTILE_RADIUS, this.player.position.x, this.player.position.z, 0.4)
      ) {
        this.player.takeDamage(proj.damage);
        proj.alive = false;
        continue;
      }

      const projAABB = makeAABB(proj.group.position.x, proj.group.position.z, PROJECTILE_RADIUS, PROJECTILE_RADIUS);
      if (wallObstacles.some((o) => intersects(projAABB, o))) {
        proj.alive = false;
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].alive) {
        this.built.group.remove(this.projectiles[i].group);
        this.projectiles.splice(i, 1);
      }
    }

    // ---- treasure pickup ----
    if (currentRoom && currentRoom.node.type === 'treasure' && !currentRoom.treasureCollected && currentRoom.treasureMesh) {
      const dx = currentRoom.worldX - this.player.position.x;
      const dz = currentRoom.worldZ - this.player.position.z;
      if (Math.hypot(dx, dz) < 1.6) {
        currentRoom.treasureCollected = true;
        this.built.group.remove(currentRoom.treasureMesh);
        const template = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
        const item = makeLootItem(template);
        this.player.playerState.addLoot(item);
        this.ui.showToast(`+ Objeto encontrado: ${item.name}`);
      } else {
        currentRoom.treasureMesh.rotation.y += delta * 1.2;
      }
    }

    // ---- portal interact prompt ----
    const startRoom = [...this.built.rooms.values()].find((r) => r.node.type === 'start');
    this.nearPortal = false;
    if (startRoom && startRoom.portalMesh) {
      const dx = startRoom.portalMesh.position.x - this.player.position.x;
      const dz = startRoom.portalMesh.position.z - this.player.position.z;
      if (Math.hypot(dx, dz) < 2.6) {
        this.nearPortal = true;
      }
    }
    this.ui.setInteractPrompt(this.nearPortal ? '[E] Volver al Lobby' : null);
    if (this.nearPortal && this.input.wasJustPressed('KeyE')) {
      this.onExitToLobby(true);
      return;
    }

    // ---- death check ----
    if (this.player.hp <= 0) {
      this.onPlayerDied();
      return;
    }

    this.ui.updateHUD(this.player.hp, this.player.maxHp, this.player.playerState.equippedSkill.name);
  }

  private skillCooldownRemaining = 0;
  private tryUseSkill() {
    if (this.skillCooldownRemaining > 0) {
      this.ui.showToast('Habilidad en enfriamiento');
      return;
    }
    const skill = this.player.playerState.equippedSkill;
    this.skillCooldownRemaining = skill.cooldown;
    if (skill.id === 'power_strike') {
      this.player.queueDoubleDamageNextAttack();
      this.ui.showToast('¡Golpe Poderoso listo!');
    } else if (skill.id === 'minor_heal') {
      this.player.heal(this.player.maxHp * 0.3);
      this.ui.showToast('Curación Menor aplicada');
    } else if (skill.id === 'swift_step') {
      this.player.applySpeedBoost(1.7, 4);
      this.ui.showToast('¡Paso Veloz!');
    }
  }
}
