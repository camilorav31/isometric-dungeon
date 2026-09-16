import * as THREE from 'three';
import { Entity } from './Entity';
import { PlayerState } from '../state/PlayerState';
import { createCharacterMesh, PALETTE } from '../utils/geometryFactory';

export const PLAYER_ATTACK_RANGE = 2.2;
export const PLAYER_ATTACK_ANGLE = Math.PI / 2.2; // cone half-angle-ish (used as dot threshold below)
const ATTACK_COOLDOWN = 0.55;
const ATTACK_DOT_THRESHOLD = 0.35;

export class Player extends Entity {
  facingAngle = Math.PI; // radians, 0 = +Z
  private attackCooldownTimer = 0;
  isAttacking = false;
  private attackAnimTimer = 0;
  speedMultiplier = 1;
  private speedBoostTimer = 0;
  private nextAttackDamageMultiplier = 1;

  constructor(public playerState: PlayerState) {
    super(playerState.maxHp, 0.4, 0.3, playerState.speed);
    this.group = createCharacterMesh('#5b6b7a', PALETTE.loot);
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
      if (this.attackAnimTimer <= 0) this.isAttacking = false;
    }
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= delta;
      if (this.speedBoostTimer <= 0) this.speedMultiplier = 1;
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
    this.attackAnimTimer = 0.2;
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
