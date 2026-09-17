import * as THREE from 'three';
import { Entity } from './Entity';
import { createCharacterMesh, createTelegraphIndicator, PALETTE } from '../utils/geometryFactory';

export type EnemyType = 'melee' | 'ranged' | 'tank' | 'boss';

const MELEE_STATS = { hp: 40, damage: 8, speed: 3.6, aggroRange: 12, attackRange: 1.6, attackCooldown: 1.1 };
const RANGED_STATS = { hp: 26, damage: 6, speed: 2.6, aggroRange: 14, attackRange: 0, attackCooldown: 1.8, preferredRange: 7, minRange: 4.5 };
// Tank/boss enemies telegraph their swing: they freeze for `telegraph` seconds
// (showing a warning marker) before the hit actually resolves, rewarding a dodge.
const TANK_STATS = { hp: 70, damage: 20, speed: 2.0, aggroRange: 10, attackRange: 1.9, attackCooldown: 2.2, telegraph: 0.6 };
const BOSS_STATS = { hp: 160, damage: 26, speed: 2.3, aggroRange: 16, attackRange: 2.2, attackCooldown: 1.8, telegraph: 0.55 };

export interface ShootRequest {
  dirX: number;
  dirZ: number;
  damage: number;
}

const DEATH_HIDE_DELAY = 0.25;
export const ENEMY_SEPARATION_RADIUS = 0.9;
const SOUL_VALUES: Record<EnemyType, number> = { melee: 5, ranged: 6, tank: 15, boss: 50 };

export class Enemy extends Entity {
  type: EnemyType;
  roomId: string;
  active = false;
  /** Persistent currency reward for the kill; awarded once by the caller. */
  soulValue: number;
  soulsAwarded = false;
  private attackTimer = 0;
  private telegraphTimer = 0;
  private telegraphDuration = 0;
  private telegraphIndicator: THREE.Mesh;
  private deathHideTimer = DEATH_HIDE_DELAY;
  damage: number;
  private aggroRange: number;
  private attackRange: number;
  private preferredRange: number;
  private minRange: number;
  private attackCooldown: number;

  constructor(type: EnemyType, roomId: string, difficultyMultiplier = 1) {
    const stats =
      type === 'melee' ? MELEE_STATS : type === 'ranged' ? RANGED_STATS : type === 'tank' ? TANK_STATS : BOSS_STATS;
    super(
      Math.round(stats.hp * difficultyMultiplier),
      type === 'boss' ? 0.6 : 0.4,
      type === 'boss' ? 0.45 : 0.3,
      stats.speed,
    );
    this.type = type;
    this.roomId = roomId;
    this.soulValue = Math.round(SOUL_VALUES[type] * difficultyMultiplier);
    this.damage = Math.round(stats.damage * difficultyMultiplier);
    this.aggroRange = stats.aggroRange;
    this.attackRange = type === 'ranged' ? 0 : stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.preferredRange = type === 'ranged' ? RANGED_STATS.preferredRange : 0;
    this.minRange = type === 'ranged' ? RANGED_STATS.minRange : 0;

    const bodyColor = type === 'melee' ? PALETTE.danger : type === 'ranged' ? '#5a2d5e' : type === 'tank' ? '#6b3210' : '#4a0d0d';
    this.group = createCharacterMesh(bodyColor, PALETTE.danger);
    const scale = type === 'boss' ? 1.6 : type === 'tank' ? 1.35 : type === 'melee' ? 1.15 : 0.95;
    this.group.scale.setScalar(scale);

    this.telegraphIndicator = createTelegraphIndicator();
    this.group.add(this.telegraphIndicator);
  }

  /** Flash + knockback decay + a brief delay before the corpse disappears. Call every frame. */
  update(delta: number) {
    this.updateFlash(delta);
    if (!this.alive && this.group.visible) {
      this.deathHideTimer -= delta;
      if (this.deathHideTimer <= 0) this.group.visible = false;
    }
  }

  private hasTelegraphedAttack(): boolean {
    return this.type === 'tank' || this.type === 'boss';
  }

  /** Returns a movement delta (world units, not yet scaled by delta-time) and optional shoot request. */
  aiUpdate(delta: number, playerPos: THREE.Vector3): { moveX: number; moveZ: number; meleeAttack: boolean; shoot: ShootRequest | null } {
    if (!this.alive || !this.active) return { moveX: 0, moveZ: 0, meleeAttack: false, shoot: null };

    if (this.attackTimer > 0) this.attackTimer -= delta;

    const toPlayerX = playerPos.x - this.group.position.x;
    const toPlayerZ = playerPos.z - this.group.position.z;
    const dist = Math.hypot(toPlayerX, toPlayerZ) || 0.0001;
    const dirX = toPlayerX / dist;
    const dirZ = toPlayerZ / dist;

    // Mid-windup: hold position, keep facing the player, and grow the warning marker.
    if (this.telegraphTimer > 0) {
      this.group.rotation.y = Math.atan2(dirX, dirZ);
      this.telegraphTimer -= delta;
      const progress = 1 - Math.max(0, this.telegraphTimer) / this.telegraphDuration;
      this.telegraphIndicator.scale.setScalar(THREE.MathUtils.lerp(0.4, 1.3, progress));
      if (this.telegraphTimer <= 0) {
        this.telegraphIndicator.visible = false;
        this.attackTimer = this.attackCooldown;
        return { moveX: 0, moveZ: 0, meleeAttack: dist <= this.attackRange, shoot: null };
      }
      return { moveX: 0, moveZ: 0, meleeAttack: false, shoot: null };
    }

    if (dist > this.aggroRange) {
      return { moveX: 0, moveZ: 0, meleeAttack: false, shoot: null };
    }

    this.group.rotation.y = Math.atan2(dirX, dirZ);

    if (this.type === 'melee' || this.hasTelegraphedAttack()) {
      if (dist > this.attackRange) {
        return { moveX: dirX * this.speed, moveZ: dirZ * this.speed, meleeAttack: false, shoot: null };
      }
      if (this.attackTimer <= 0) {
        if (this.hasTelegraphedAttack()) {
          this.telegraphDuration = this.type === 'tank' ? TANK_STATS.telegraph : BOSS_STATS.telegraph;
          this.telegraphTimer = this.telegraphDuration;
          this.telegraphIndicator.visible = true;
          this.telegraphIndicator.scale.setScalar(0.4);
          return { moveX: 0, moveZ: 0, meleeAttack: false, shoot: null };
        }
        this.attackTimer = this.attackCooldown;
        return { moveX: 0, moveZ: 0, meleeAttack: true, shoot: null };
      }
      return { moveX: 0, moveZ: 0, meleeAttack: false, shoot: null };
    } else {
      let moveX = 0;
      let moveZ = 0;
      if (dist < this.minRange) {
        moveX = -dirX * this.speed;
        moveZ = -dirZ * this.speed;
      } else if (dist > this.preferredRange) {
        moveX = dirX * this.speed;
        moveZ = dirZ * this.speed;
      }
      let shoot: ShootRequest | null = null;
      if (this.attackTimer <= 0) {
        shoot = { dirX, dirZ, damage: this.damage };
        this.attackTimer = this.attackCooldown;
      }
      return { moveX, moveZ, meleeAttack: false, shoot };
    }
  }
}
