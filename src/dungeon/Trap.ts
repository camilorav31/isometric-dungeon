import * as THREE from 'three';
import { createSpikeTrap } from '../utils/geometryFactory';

const SAFE_DURATION = 1.6;
const RISING_DURATION = 0.15;
const DANGER_DURATION = 0.7;
export const TRAP_DAMAGE = 10;
export const TRAP_RADIUS = 0.9;

type Phase = 'safe' | 'rising' | 'danger';

/** A floor spike trap that cycles safe -> rising -> danger -> safe, hurting the player once per danger phase. */
export class Trap {
  group: THREE.Group;
  private spikesGroup: THREE.Group;
  private phase: Phase = 'safe';
  private timer = SAFE_DURATION;
  private hasHitThisCycle = false;

  constructor(x: number, z: number) {
    const mesh = createSpikeTrap();
    this.group = mesh.group;
    this.spikesGroup = mesh.spikesGroup;
    this.group.position.set(x, 0, z);
    // Stagger traps so multiple in view don't all pulse in lockstep.
    this.timer = SAFE_DURATION * Math.random();
  }

  isDangerous(): boolean {
    return this.phase === 'danger';
  }

  update(delta: number) {
    this.timer -= delta;
    if (this.timer > 0) return;

    if (this.phase === 'safe') {
      this.phase = 'rising';
      this.timer = RISING_DURATION;
      this.spikesGroup.visible = true;
      this.hasHitThisCycle = false;
    } else if (this.phase === 'rising') {
      this.phase = 'danger';
      this.timer = DANGER_DURATION;
    } else {
      this.phase = 'safe';
      this.timer = SAFE_DURATION;
      this.spikesGroup.visible = false;
      this.spikesGroup.scale.y = 0.05;
    }
  }

  /** Called every frame while rising/danger to animate the spikes popping up. */
  animate() {
    if (this.phase === 'rising') {
      const progress = 1 - this.timer / RISING_DURATION;
      this.spikesGroup.scale.y = THREE.MathUtils.lerp(0.05, 1, progress);
    } else if (this.phase === 'danger') {
      this.spikesGroup.scale.y = 1;
    }
  }

  tryDamagePlayer(playerX: number, playerZ: number): boolean {
    if (!this.isDangerous() || this.hasHitThisCycle) return false;
    const dx = playerX - this.group.position.x;
    const dz = playerZ - this.group.position.z;
    if (Math.hypot(dx, dz) > TRAP_RADIUS) return false;
    this.hasHitThisCycle = true;
    return true;
  }
}
