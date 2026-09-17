import * as THREE from 'three';
import { generateDungeonGraph } from './DungeonGenerator';
import { buildDungeon, BuiltDungeon, RuntimeRoom, getBlockerAABB } from './DungeonBuilder';
import { TRAP_DAMAGE } from './Trap';
import { DIRECTIONS } from './DungeonGenerator';
import { Player } from '../entities/Player';
import { Enemy, ENEMY_SEPARATION_RADIUS } from '../entities/Enemy';
import { Projectile, PROJECTILE_RADIUS } from '../entities/Projectile';
import { CameraController } from '../core/CameraController';
import { InputManager } from '../core/InputManager';
import { UIManager } from '../ui/UIManager';
import { AABB, intersects, makeAABB, circleIntersects, attemptMove } from '../utils/collision';
import { rollLootItem, RARITY_LABEL, SKILL_POOL } from '../state/PlayerState';
import { updateWallFade } from '../scene/wallFade';
import { updateTorchFlicker } from '../scene/torchFlicker';
import { ParticleBurst } from '../scene/particles';

interface MinimapRoomData {
  gridX: number;
  gridY: number;
  type: string;
  visited: boolean;
  cleared: boolean;
  current: boolean;
}

// Combat rooms only seal/activate once the player has cleared this margin past
// the doorway; otherwise the door blocker spawns right on top of the player.
const ACTIVATION_MARGIN = 3;

// A room (and its torch lights) stays rendered while the player is within this
// radius of its center — comfortably covers "in the room" and "in the doorway
// approaching/leaving it" without keeping every room in the dungeon lit at once.
const ROOM_VISIBILITY_RADIUS = 14;

function isCombatRoomType(type: string): boolean {
  return type === 'combat' || type === 'boss';
}

const PLAYER_HIT_KNOCKBACK = 5;
const ENEMY_HIT_PLAYER_KNOCKBACK = 4;
const PROJECTILE_HIT_KNOCKBACK = 2.5;
const DIFFICULTY_PER_FLOOR = 0.18;

function separateEnemies(enemies: Enemy[], obstacles: AABB[]) {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (!b.alive) continue;
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.0001 && dist < ENEMY_SEPARATION_RADIUS) {
        const push = (ENEMY_SEPARATION_RADIUS - dist) / 2;
        const nx = dx / dist;
        const nz = dz / dist;
        attemptMove(() => a.getAABB(), a, -nx * push, -nz * push, obstacles);
        attemptMove(() => b.getAABB(), b, nx * push, nz * push, obstacles);
      }
    }
  }
}

export class DungeonController {
  scene: THREE.Scene;
  player: Player;
  ui: UIManager;
  camera: CameraController;
  input: InputManager;

  private built: BuiltDungeon | null = null;
  private projectiles: Projectile[] = [];
  private particleBursts: ParticleBurst[] = [];
  private elapsed = 0;
  private nearPortal = false;
  private nearDescend = false;
  private onExitToLobby: (won: boolean) => void;
  private onPlayerDied: () => void;
  private onDescend: () => void;

  constructor(
    scene: THREE.Scene,
    player: Player,
    ui: UIManager,
    camera: CameraController,
    input: InputManager,
    onExitToLobby: (won: boolean) => void,
    onPlayerDied: () => void,
    onDescend: () => void,
  ) {
    this.scene = scene;
    this.player = player;
    this.ui = ui;
    this.camera = camera;
    this.input = input;
    this.onExitToLobby = onExitToLobby;
    this.onPlayerDied = onPlayerDied;
    this.onDescend = onDescend;
  }

  generate(floor = 1): THREE.Vector3 {
    this.dispose();
    const graph = generateDungeonGraph();
    const difficultyMultiplier = 1 + (floor - 1) * DIFFICULTY_PER_FLOOR;
    this.built = buildDungeon(graph, difficultyMultiplier);
    this.scene.add(this.built.group);

    for (const room of this.built.rooms.values()) {
      for (const enemy of room.enemies) {
        this.ui.registerHealthBar(enemy);
      }
    }

    this.ui.showRoomBanner(floor > 1 ? `Piso ${floor}` : 'Has entrado a la mazmorra');
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
    for (const burst of this.particleBursts) burst.dispose();
    this.particleBursts = [];
  }

  private spawnBurst(position: THREE.Vector3, color: string, count = 8, speed = 3) {
    if (!this.built) return;
    const burst = new ParticleBurst(position, color, count, speed);
    this.built.group.add(burst.points);
    this.particleBursts.push(burst);
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

    this.elapsed += delta;
    updateTorchFlicker(this.built.torchLights, this.elapsed);

    this.player.update(delta);
    for (let i = 0; i < this.skillCooldowns.length; i++) {
      if (this.skillCooldowns[i] > 0) this.skillCooldowns[i] -= delta;
    }

    // ---- player movement (camera-relative) ----
    const movementObstacles = this.getAllObstacles();
    const axis = this.input.getMovementAxis();

    if (this.input.wasJustPressed('ShiftLeft') || this.input.wasJustPressed('ShiftRight')) {
      const rollDir = axis.x !== 0 || axis.z !== 0 ? this.camera.computeMoveDirection(axis.x, axis.z) : { x: 0, z: 0 };
      if (!this.player.tryRoll(rollDir.x, rollDir.z)) {
        this.ui.showToast('Sin estamina para rodar');
      }
    }

    if (this.player.isRolling) {
      const v = this.player.rollVelocity;
      attemptMove(() => this.player.getAABB(), this.player, v.x * delta, v.z * delta, movementObstacles);
    } else if (axis.x !== 0 || axis.z !== 0) {
      const dir = this.camera.computeMoveDirection(axis.x, axis.z);
      const speed = this.player.effectiveSpeed;
      attemptMove(() => this.player.getAABB(), this.player, dir.x * speed * delta, dir.z * speed * delta, movementObstacles);
      this.player.setFacingFromMovement(dir.x, dir.z);
    }
    this.player.updateKnockback(delta, movementObstacles);

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
            enemy.triggerFlash(0xffffff, 0.15);
            enemy.applyKnockback(dx, dz, PLAYER_HIT_KNOCKBACK);
            const headPos = new THREE.Vector3();
            enemy.getHeadWorldPosition(headPos);
            this.ui.spawnDamageNumber(headPos, this.camera.camera, attack.damage, 'enemy');
            this.camera.shake(0.12, 0.1);
            if (!enemy.alive && !enemy.soulsAwarded) {
              enemy.soulsAwarded = true;
              this.player.playerState.souls += enemy.soulValue;
              this.ui.showToast(`+${enemy.soulValue} almas`);
              this.spawnBurst(headPos, '#ffffff', 14, 4);
              this.camera.shake(0.2, 0.14);
            } else {
              this.spawnBurst(headPos, '#ffd699', 8, 3);
            }
          }
        }
      }
    }

    // ---- skill activation (hotbar slots 1/2/3) ----
    if (this.input.wasJustPressed('Digit1')) this.tryUseSkill(0);
    if (this.input.wasJustPressed('Digit2')) this.tryUseSkill(1);
    if (this.input.wasJustPressed('Digit3')) this.tryUseSkill(2);

    // ---- room activation check ----
    // Only trigger once the player has stepped well clear of the doorway, so the
    // door blocker never spawns on top of them (which used to trap/hide the player).
    const currentRoom = this.findRoomContaining(this.player.position.x, this.player.position.z);
    if (currentRoom) currentRoom.visited = true;
    if (
      currentRoom &&
      isCombatRoomType(currentRoom.node.type) &&
      !currentRoom.activated &&
      this.player.position.x > currentRoom.bounds.minX + ACTIVATION_MARGIN &&
      this.player.position.x < currentRoom.bounds.maxX - ACTIVATION_MARGIN &&
      this.player.position.z > currentRoom.bounds.minZ + ACTIVATION_MARGIN &&
      this.player.position.z < currentRoom.bounds.maxZ - ACTIVATION_MARGIN
    ) {
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

    // ---- room culling: only render/light rooms near the player ----
    // With up to 8 rooms each holding 4 torch lights, leaving them all live at once
    // was the main source of the reported lag (dozens of simultaneous point lights
    // plus their walls/floors/pillars). Only the current room and its immediate
    // neighborhood stay visible; everything else is hidden wholesale.
    for (const room of this.built.rooms.values()) {
      const dx = room.worldX - this.player.position.x;
      const dz = room.worldZ - this.player.position.z;
      const near = room === currentRoom || Math.hypot(dx, dz) < ROOM_VISIBILITY_RADIUS;
      room.roomGroup.visible = near;
      if (room.treasureMesh) room.treasureMesh.visible = near;
      if (room.portalMesh) room.portalMesh.visible = near;
      if (room.descendMesh) room.descendMesh.visible = near && room.node.cleared;
    }
    for (const trap of this.built.traps) {
      const dx = trap.group.position.x - this.player.position.x;
      const dz = trap.group.position.z - this.player.position.z;
      trap.group.visible = Math.hypot(dx, dz) < ROOM_VISIBILITY_RADIUS;
    }

    // ---- fade walls facing the camera in the player's current room ----
    for (const room of this.built.rooms.values()) {
      if (!room.roomGroup.visible) continue;
      updateWallFade(room.wallMeshesByDir, this.camera.yaw, delta, room === currentRoom);
    }

    // ---- enemy AI + projectiles for active rooms ----
    const obstaclesForEnemies = this.getAllObstacles();
    for (const room of this.built.rooms.values()) {
      if (!isCombatRoomType(room.node.type) || !room.activated || room.node.cleared) continue;

      let anyAlive = false;
      for (const enemy of room.enemies) {
        enemy.update(delta);
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
        enemy.updateKnockback(delta, obstaclesForEnemies);
        if (result.meleeAttack) {
          const dx = this.player.position.x - enemy.position.x;
          const dz = this.player.position.z - enemy.position.z;
          if (this.player.takeDamage(enemy.damage)) {
            this.player.applyKnockback(dx, dz, ENEMY_HIT_PLAYER_KNOCKBACK);
            const headPos = new THREE.Vector3();
            this.player.getHeadWorldPosition(headPos);
            this.ui.spawnDamageNumber(headPos, this.camera.camera, enemy.damage, 'player');
            this.spawnBurst(headPos, '#ff4d4d', 10, 3.5);
            this.camera.shake(0.22, 0.16);
          }
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

      separateEnemies(room.enemies, obstaclesForEnemies);

      if (!anyAlive && !room.node.cleared) {
        room.node.cleared = true;
        this.unsealRoom(room);
        if (room.node.type === 'boss') {
          // room.node.cleared now gates the descend stairway's visibility every
          // frame in the room-culling pass below — no one-time reveal needed here.
          this.ui.showToast('¡El jefe ha caído! Se revela una escalera hacia lo profundo.');
        } else {
          this.ui.showToast('Sala despejada');
        }
      }
    }

    // ---- environmental traps (independent of room activation) ----
    for (const trap of this.built.traps) {
      trap.update(delta);
      trap.animate();
      if (trap.tryDamagePlayer(this.player.position.x, this.player.position.z)) {
        if (this.player.takeDamage(TRAP_DAMAGE)) {
          const headPos = new THREE.Vector3();
          this.player.getHeadWorldPosition(headPos);
          this.ui.spawnDamageNumber(headPos, this.camera.camera, TRAP_DAMAGE, 'player');
          this.spawnBurst(headPos, '#ff4d4d', 10, 3.5);
          this.camera.shake(0.22, 0.16);
        }
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
        if (this.player.takeDamage(proj.damage)) {
          this.player.applyKnockback(proj.velocity.x, proj.velocity.z, PROJECTILE_HIT_KNOCKBACK);
          const headPos = new THREE.Vector3();
          this.player.getHeadWorldPosition(headPos);
          this.ui.spawnDamageNumber(headPos, this.camera.camera, proj.damage, 'player');
          this.spawnBurst(headPos, '#ff4d4d', 10, 3.5);
          this.camera.shake(0.22, 0.16);
        }
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

    // ---- particle bursts (hit sparks / death poofs) ----
    for (let i = this.particleBursts.length - 1; i >= 0; i--) {
      if (!this.particleBursts[i].update(delta)) {
        this.built.group.remove(this.particleBursts[i].points);
        this.particleBursts[i].dispose();
        this.particleBursts.splice(i, 1);
      }
    }

    // ---- treasure pickup ----
    if (currentRoom && currentRoom.node.type === 'treasure' && !currentRoom.treasureCollected && currentRoom.treasureMesh) {
      const dx = currentRoom.worldX - this.player.position.x;
      const dz = currentRoom.worldZ - this.player.position.z;
      if (Math.hypot(dx, dz) < 1.6) {
        currentRoom.treasureCollected = true;
        this.built.group.remove(currentRoom.treasureMesh);
        const item = rollLootItem();
        this.player.playerState.addLoot(item);
        this.ui.showToast(`+ [${RARITY_LABEL[item.rarity]}] ${item.name}`);
      } else {
        currentRoom.treasureMesh.rotation.y += delta * 1.2;
      }
    }

    // ---- portal / descend-stairway interact prompts ----
    const startRoom = [...this.built.rooms.values()].find((r) => r.node.type === 'start');
    this.nearPortal = false;
    if (startRoom && startRoom.portalMesh) {
      const dx = startRoom.portalMesh.position.x - this.player.position.x;
      const dz = startRoom.portalMesh.position.z - this.player.position.z;
      if (Math.hypot(dx, dz) < 2.6) this.nearPortal = true;
    }

    const bossRoom = [...this.built.rooms.values()].find((r) => r.node.type === 'boss');
    this.nearDescend = false;
    if (bossRoom?.node.cleared && bossRoom.descendMesh) {
      const dx = bossRoom.descendMesh.position.x - this.player.position.x;
      const dz = bossRoom.descendMesh.position.z - this.player.position.z;
      if (Math.hypot(dx, dz) < 2.6) this.nearDescend = true;
    }

    if (this.nearPortal) {
      this.ui.setInteractPrompt('[E] Volver al Lobby');
    } else if (this.nearDescend) {
      this.ui.setInteractPrompt('[E] Descender más profundo');
    } else {
      this.ui.setInteractPrompt(null);
    }

    if (this.input.wasJustPressed('KeyE')) {
      if (this.nearPortal) {
        this.onExitToLobby(true);
        return;
      } else if (this.nearDescend) {
        this.onDescend();
        return;
      }
    }

    // ---- death check ----
    if (this.player.hp <= 0) {
      this.onPlayerDied();
      return;
    }

    const minimapRooms: MinimapRoomData[] = [...this.built.rooms.values()].map((room) => ({
      gridX: room.node.gridX,
      gridY: room.node.gridY,
      type: room.node.type,
      visited: room.visited,
      cleared: room.node.cleared,
      current: room === currentRoom,
    }));
    this.ui.updateMinimap(minimapRooms);

    const skillReadiness = SKILL_POOL.map(
      (skill, i) => 1 - THREE.MathUtils.clamp(this.skillCooldowns[i] / skill.cooldown, 0, 1),
    );
    this.ui.updateHUD(
      this.player.hp,
      this.player.maxHp,
      this.player.stamina,
      this.player.maxStamina,
      this.player.attackReadiness,
      skillReadiness,
    );
  }

  private skillCooldowns = [0, 0, 0];
  private tryUseSkill(slot: number) {
    const skill = SKILL_POOL[slot];
    if (!skill) return;
    if (this.skillCooldowns[slot] > 0) {
      this.ui.showToast('Habilidad en enfriamiento');
      return;
    }
    this.skillCooldowns[slot] = skill.cooldown;
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
