import * as THREE from 'three';
import { AABB, makeAABB, attemptMove } from '../utils/collision';

const KNOCKBACK_DECAY = 8; // per second

export abstract class Entity {
  group: THREE.Group = new THREE.Group();
  hp: number;
  maxHp: number;
  alive = true;
  halfWidth: number;
  halfDepth: number;
  speed: number;
  knockback = { x: 0, z: 0 };

  private flashTimer = 0;
  private flashMaterials: THREE.MeshStandardMaterial[] = [];
  private flashOriginal: THREE.Color[] = [];

  private walkCycleTime = 0;
  private lastBobX = NaN;
  private lastBobZ = NaN;

  constructor(maxHp: number, halfWidth: number, halfDepth: number, speed: number) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.halfWidth = halfWidth;
    this.halfDepth = halfDepth;
    this.speed = speed;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  getAABB(): AABB {
    return makeAABB(this.group.position.x, this.group.position.z, this.halfWidth, this.halfDepth);
  }

  takeDamage(amount: number) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
  }

  /** World-space position used to anchor a floating HP bar (above the head). */
  getHeadWorldPosition(target: THREE.Vector3) {
    target.copy(this.group.position);
    target.y += 2.05;
  }

  /** Briefly tints every material in this entity's mesh (hit feedback). */
  triggerFlash(color: THREE.ColorRepresentation = 0xffffff, duration = 0.15) {
    if (this.flashTimer <= 0) {
      this.flashMaterials = [];
      this.flashOriginal = [];
      this.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          this.flashMaterials.push(obj.material);
          this.flashOriginal.push(obj.material.emissive.clone());
          obj.material.emissive.set(color);
        }
      });
    }
    this.flashTimer = duration;
  }

  protected updateFlash(delta: number) {
    if (this.flashTimer <= 0) return;
    this.flashTimer -= delta;
    if (this.flashTimer <= 0) {
      this.flashMaterials.forEach((mat, i) => mat.emissive.copy(this.flashOriginal[i]));
      this.flashMaterials = [];
      this.flashOriginal = [];
    }
  }

  /** Shoves the entity away from (dirX, dirZ); accumulates so overlapping hits stack a bit. */
  applyKnockback(dirX: number, dirZ: number, strength: number) {
    const len = Math.hypot(dirX, dirZ) || 1;
    this.knockback.x += (dirX / len) * strength;
    this.knockback.z += (dirZ / len) * strength;
  }

  /** Applies and decays any pending knockback; call once per frame with the current obstacle set. */
  updateKnockback(delta: number, obstacles: AABB[]) {
    if (Math.abs(this.knockback.x) < 0.02 && Math.abs(this.knockback.z) < 0.02) {
      this.knockback.x = 0;
      this.knockback.z = 0;
      return;
    }
    attemptMove(() => this.getAABB(), this, this.knockback.x * delta, this.knockback.z * delta, obstacles);
    const decay = Math.max(0, 1 - KNOCKBACK_DECAY * delta);
    this.knockback.x *= decay;
    this.knockback.z *= decay;
  }

  /** A small procedural bob while actually displacing, settling back to 0 when still. */
  protected updateWalkBob(delta: number, amplitude = 0.06, frequency = 9) {
    if (Number.isNaN(this.lastBobX)) {
      this.lastBobX = this.group.position.x;
      this.lastBobZ = this.group.position.z;
      return;
    }
    const moved = Math.hypot(this.group.position.x - this.lastBobX, this.group.position.z - this.lastBobZ);
    this.lastBobX = this.group.position.x;
    this.lastBobZ = this.group.position.z;

    if (moved > 0.002) {
      this.walkCycleTime += delta * frequency;
      this.group.position.y = Math.abs(Math.sin(this.walkCycleTime)) * amplitude;
    } else {
      this.group.position.y = THREE.MathUtils.damp(this.group.position.y, 0, 12, delta);
    }
  }
}
