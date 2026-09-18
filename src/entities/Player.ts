import * as THREE from 'three';
import { Entity } from './Entity';
import { PlayerState, Rarity } from '../state/PlayerState';
import {
  createCharacterMesh,
  createWeaponMesh,
  createFacingMarker,
  mountWeapon,
  CharacterRig,
  ELBOW_BEND_REST,
  ELBOW_SWING_START,
  ELBOW_SWING_END,
  PALETTE,
} from '../utils/geometryFactory';

export const PLAYER_ATTACK_RANGE = 2.2;
export const PLAYER_ATTACK_ANGLE = Math.PI / 2.2; // cone half-angle-ish (used as dot threshold below)
const ATTACK_COOLDOWN = 0.55;
const ATTACK_DOT_THRESHOLD = 0.35;
const ATTACK_ANIM_DURATION = 0.2;
const INVULN_DURATION = 0.5;
const INVULN_BLINK_RATE = 16; // blink cycles/sec while invulnerable

const STAMINA_REGEN_RATE = 30; // per second
const STAMINA_REGEN_DELAY = 0.45; // pause after spending before regen resumes
const ATTACK_STAMINA_COST = 12;
const ROLL_STAMINA_COST = 30;
const ROLL_DURATION = 0.32;
const ROLL_SPEED = 13;
const ROLL_TILT = -0.5;

// Distinct from the UI's RARITY_COLOR (tuned for text legibility) — this is how
// the blade itself should look: plain steel for commons, a glowing tint above that.
const BLADE_COLOR_BY_RARITY: Record<Rarity, string> = {
  common: '#c9c9c9',
  rare: '#6fd67f',
  unique: '#5aa8e8',
  magical: '#b57fe0',
  mythic: '#f2dd6e',
  legendary: '#ffab4d',
};

export class Player extends Entity {
  facingAngle = Math.PI; // radians, 0 = +Z
  private attackCooldownTimer = 0;
  isAttacking = false;
  private attackAnimTimer = 0;
  speedMultiplier = 1;
  private speedBoostTimer = 0;
  private nextAttackDamageMultiplier = 1;
  private rig: CharacterRig;
  private weaponPivot: THREE.Group;
  private weaponMesh: THREE.Group;
  private invulnTimer = 0;
  stamina: number;
  private staminaRegenDelayTimer = 0;
  private rollTimer = 0;
  private rollDirX = 0;
  private rollDirZ = 0;

  constructor(public playerState: PlayerState) {
    super(playerState.maxHp, 0.4, 0.3, playerState.speed);
    this.rig = createCharacterMesh('#5b6b7a', PALETTE.loot);
    this.group = this.rig.group;
    this.stamina = playerState.maxStamina;

    this.weaponMesh = createWeaponMesh();
    this.weaponPivot = mountWeapon(this.rig.rightHand, this.weaponMesh);
    this.group.add(createFacingMarker(PALETTE.loot));

    this.syncStatsFromState();
  }

  get maxStamina(): number {
    return this.playerState.maxStamina;
  }

  syncStatsFromState() {
    this.maxHp = this.playerState.maxHp;
    this.hp = this.playerState.currentHp;
    this.speed = this.playerState.speed;
    this.stamina = this.maxStamina;
    this.alive = this.hp > 0;
    this.refreshWeaponVisual();
  }

  /** Rebuilds the held weapon mesh to match the currently equipped weapon (or the bare default). */
  refreshWeaponVisual() {
    this.weaponPivot.remove(this.weaponMesh);
    const weapon = this.playerState.equipped.mainHand;
    const kind = weapon?.weaponVisual ?? 'sword';
    const color = weapon ? BLADE_COLOR_BY_RARITY[weapon.rarity] : BLADE_COLOR_BY_RARITY.common;
    this.weaponMesh = createWeaponMesh(kind, color);
    this.weaponPivot.add(this.weaponMesh);
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

  get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  get attackReadiness(): number {
    return 1 - Math.max(0, this.attackCooldownTimer) / ATTACK_COOLDOWN;
  }

  get staminaRatio(): number {
    return this.stamina / this.maxStamina;
  }

  get isRolling(): boolean {
    return this.rollTimer > 0;
  }

  /** Unit-direction * roll speed; multiply by delta to get this frame's displacement. */
  get rollVelocity(): { x: number; z: number } {
    return { x: this.rollDirX * ROLL_SPEED, z: this.rollDirZ * ROLL_SPEED };
  }

  private spendStamina(amount: number) {
    this.stamina = Math.max(0, this.stamina - amount);
    this.staminaRegenDelayTimer = STAMINA_REGEN_DELAY;
  }

  /** Dashes in (dirX, dirZ) — or the current facing if not moving — with i-frames. */
  tryRoll(dirX: number, dirZ: number): boolean {
    if (this.rollTimer > 0 || this.stamina < ROLL_STAMINA_COST) return false;
    let dx = dirX;
    let dz = dirZ;
    if (Math.hypot(dx, dz) < 0.001) {
      dx = Math.sin(this.facingAngle);
      dz = Math.cos(this.facingAngle);
    }
    const len = Math.hypot(dx, dz) || 1;
    this.rollDirX = dx / len;
    this.rollDirZ = dz / len;
    this.rollTimer = ROLL_DURATION;
    this.spendStamina(ROLL_STAMINA_COST);
    this.invulnTimer = Math.max(this.invulnTimer, ROLL_DURATION);
    this.setFacingFromMovement(this.rollDirX, this.rollDirZ);
    return true;
  }

  /** Returns false (no-op) if the hit was absorbed by post-hit invulnerability. */
  takeDamage(amount: number): boolean {
    if (this.invulnTimer > 0) return false;
    super.takeDamage(amount);
    this.playerState.currentHp = this.hp;
    this.invulnTimer = INVULN_DURATION;
    this.triggerFlash(0xff3030, 0.4);
    return true;
  }

  setFacingFromMovement(dx: number, dz: number) {
    if (dx === 0 && dz === 0) return;
    this.facingAngle = Math.atan2(dx, dz);
    this.group.rotation.y = this.facingAngle;
  }

  update(delta: number) {
    this.updateFlash(delta);
    if (!this.isRolling) this.updateWalkBob(delta);

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

    if (this.invulnTimer > 0) {
      this.invulnTimer -= delta;
      this.group.visible = Math.floor(this.invulnTimer * INVULN_BLINK_RATE) % 2 === 0;
    } else {
      this.group.visible = true;
    }

    if (this.rollTimer > 0) {
      this.rollTimer = Math.max(0, this.rollTimer - delta);
      const progress = 1 - this.rollTimer / ROLL_DURATION;
      this.group.rotation.x = Math.sin(progress * Math.PI) * ROLL_TILT;
    } else {
      this.group.rotation.x = 0;
    }

    if (this.staminaRegenDelayTimer > 0) {
      this.staminaRegenDelayTimer -= delta;
    } else if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN_RATE * delta);
    }

    if (this.isAttacking) {
      const progress = 1 - this.attackAnimTimer / ATTACK_ANIM_DURATION;
      this.rig.rightElbow.rotation.x = THREE.MathUtils.lerp(ELBOW_SWING_START, ELBOW_SWING_END, progress);
    } else {
      this.rig.rightElbow.rotation.x = ELBOW_BEND_REST;
    }
  }

  canAttack(): boolean {
    return this.attackCooldownTimer <= 0 && this.rollTimer <= 0 && this.stamina >= ATTACK_STAMINA_COST;
  }

  /** Triggers the attack animation/cooldown and returns the damage to apply, plus range/facing info. */
  performAttack(): { damage: number; range: number; facingAngle: number } | null {
    if (!this.canAttack()) return null;
    this.attackCooldownTimer = ATTACK_COOLDOWN;
    this.isAttacking = true;
    this.attackAnimTimer = ATTACK_ANIM_DURATION;
    this.spendStamina(ATTACK_STAMINA_COST);
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
