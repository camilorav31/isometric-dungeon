import * as THREE from 'three';
import { Entity } from './Entity';
import { PlayerState } from '../state/PlayerState';
import { createCharacterMesh, createSwordMesh, PALETTE } from '../utils/geometryFactory';

export const PLAYER_ATTACK_RANGE = 2.2;
export const PLAYER_ATTACK_ANGLE = Math.PI / 2.2; // cone half-angle-ish (used as dot threshold below)
const ATTACK_COOLDOWN = 0.55;
const ATTACK_DOT_THRESHOLD = 0.35;
const ATTACK_ANIM_DURATION = 0.2;
const SWORD_REST_ROTATION = -0.4;
const SWORD_SWING_START = -1.9;
const SWORD_SWING_END = 0.9;

export class Player extends Entity {
  facingAngle = Math.PI; // radians, 0 = +Z
  private attackCooldownTimer = 0;
  isAttacking = false;
  private attackAnimTimer = 0;
  speedMultiplier = 1;
  private speedBoostTimer = 0;
  private nextAttackDamageMultiplier = 1;
  private swordPivot: THREE.Group;

  constructor(public playerState: PlayerState) {
    super(playerState.maxHp, 0.4, 0.3, playerState.speed);
    this.group = createCharacterMesh('#5b6b7a', PALETTE.loot);

    this.swordPivot = new THREE.Group();
    this.swordPivot.position.set(0.42, 0.95, 0);
    this.swordPivot.rotation.x = SWORD_REST_ROTATION;
    const sword = createSwordMesh();
    sword.position.set(0, -0.3, 0.15);
    this.swordPivot.add(sword);
    this.group.add(this.swordPivot);

    this.syncStatsFromState();
  }

  syncStatsFromState() {
    this.maxHp = this.playerState.maxHp;
    this.hp = this.playerState.currentHp;
    this.speed = this.playerState.speed;
    this.alive = this.hp > 0;
  }

  get effectiveSpeed(): number {
    return this.speed * this.speedMultiplier;
  }

  applySpeedBoost(multiplier: number, duration: number) {
    this.speedMultiplier = multiplier;
    this.speedBoostTimer = duration;
  }

  queueDoubleDamageNextAttack() {
    this.nextAttackDamageMultiplier = 2;
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.playerState.currentHp = this.hp;
  }

  takeDamage(amount: number) {
    super.takeDamage(amount);
    this.playerState.currentHp = this.hp;
  }

  setFacingFromMovement(dx: number, dz: number) {
    if (dx === 0 && dz === 0) return;
    this.facingAngle = Math.atan2(dx, dz);
    this.group.rotation.y = this.facingAngle;
  }

  update(delta: number) {
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= delta;
    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= delta;
      if (this.attackAnimTimer <= 0) {
        this.isAttacking = false;
        this.attackAnimTimer = 0;
      }
    }
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= delta;
      if (this.speedBoostTimer <= 0) this.speedMultiplier = 1;
    }

    if (this.isAttacking) {
      const progress = 1 - this.attackAnimTimer / ATTACK_ANIM_DURATION;
      this.swordPivot.rotation.x = THREE.MathUtils.lerp(SWORD_SWING_START, SWORD_SWING_END, progress);
    } else {
      this.swordPivot.rotation.x = SWORD_REST_ROTATION;
    }
  }

  canAttack(): boolean {
    return this.attackCooldownTimer <= 0;
  }

  /** Triggers the attack animation/cooldown and returns the damage to apply, plus range/facing info. */
  performAttack(): { damage: number; range: number; facingAngle: number } | null {
    if (!this.canAttack()) return null;
    this.attackCooldownTimer = ATTACK_COOLDOWN;
    this.isAttacking = true;
    this.attackAnimTimer = ATTACK_ANIM_DURATION;
    const damage = this.playerState.damage * this.nextAttackDamageMultiplier;
    this.nextAttackDamageMultiplier = 1;
    return { damage, range: PLAYER_ATTACK_RANGE, facingAngle: this.facingAngle };
  }

  static isWithinAttackCone(attackerFacingAngle: number, toTargetX: number, toTargetZ: number): boolean {
    const dist = Math.hypot(toTargetX, toTargetZ);
    if (dist < 0.001) return true;
    const facingDirX = Math.sin(attackerFacingAngle);
    const facingDirZ = Math.cos(attackerFacingAngle);
    const dot = (toTargetX / dist) * facingDirX + (toTargetZ / dist) * facingDirZ;
    return dot > ATTACK_DOT_THRESHOLD;
  }
}
