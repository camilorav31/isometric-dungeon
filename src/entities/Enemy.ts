import * as THREE from 'three';
import { Entity } from './Entity';
import { createCharacterMesh, PALETTE } from '../utils/geometryFactory';

export type EnemyType = 'melee' | 'ranged';

const MELEE_STATS = { hp: 40, damage: 8, speed: 3.6, aggroRange: 12, attackRange: 1.6, attackCooldown: 1.1 };
const RANGED_STATS = { hp: 26, damage: 6, speed: 2.6, aggroRange: 14, preferredRange: 7, minRange: 4.5, shootCooldown: 1.8 };

export interface ShootRequest {
  dirX: number;
  dirZ: number;
  damage: number;
}

export class Enemy extends Entity {
  type: EnemyType;
  roomId: string;
  active = false;
  private attackTimer = 0;
  damage: number;
  private aggroRange: number;
  private attackRange: number;
  private preferredRange: number;
  private minRange: number;

  constructor(type: EnemyType, roomId: string) {
    const stats = type === 'melee' ? MELEE_STATS : RANGED_STATS;
    super(stats.hp, 0.4, 0.3, stats.speed);
    this.type = type;
    this.roomId = roomId;
    this.damage = stats.damage;
    this.aggroRange = stats.aggroRange;
    this.attackRange = type === 'melee' ? MELEE_STATS.attackRange : 0;
    this.preferredRange = type === 'ranged' ? RANGED_STATS.preferredRange : 0;
    this.minRange = type === 'ranged' ? RANGED_STATS.minRange : 0;

    const bodyColor = type === 'melee' ? PALETTE.danger : '#5a2d5e';
    this.group = createCharacterMesh(bodyColor, PALETTE.danger);
    this.group.scale.setScalar(type === 'melee' ? 1.15 : 0.95);
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

    if (dist > this.aggroRange) {
      return { moveX: 0, moveZ: 0, meleeAttack: false, shoot: null };
    }

    this.group.rotation.y = Math.atan2(dirX, dirZ);

    if (this.type === 'melee') {
      if (dist > this.attackRange) {
        return { moveX: dirX * this.speed, moveZ: dirZ * this.speed, meleeAttack: false, shoot: null };
      }
      let meleeAttack = false;
      if (this.attackTimer <= 0) {
        meleeAttack = true;
        this.attackTimer = MELEE_STATS.attackCooldown;
      }
      return { moveX: 0, moveZ: 0, meleeAttack, shoot: null };
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
        this.attackTimer = RANGED_STATS.shootCooldown;
      }
      return { moveX, moveZ, meleeAttack: false, shoot };
    }
  }
}
