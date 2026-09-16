import * as THREE from 'three';
import { createProjectileMesh } from '../utils/geometryFactory';

const PROJECTILE_SPEED = 9;
const PROJECTILE_LIFESPAN = 4;
export const PROJECTILE_RADIUS = 0.18;

export class Projectile {
  group: THREE.Group = new THREE.Group();
  velocity = new THREE.Vector3();
  damage: number;
  private life = PROJECTILE_LIFESPAN;
  alive = true;
  roomId: string;

  constructor(originX: number, originZ: number, dirX: number, dirZ: number, damage: number, roomId: string) {
    this.damage = damage;
    this.roomId = roomId;
    const mesh = createProjectileMesh();
    this.group.add(mesh);
    this.group.position.set(originX, 1.1, originZ);
    const len = Math.hypot(dirX, dirZ) || 1;
    this.velocity.set((dirX / len) * PROJECTILE_SPEED, 0, (dirZ / len) * PROJECTILE_SPEED);
  }

  update(delta: number) {
    this.group.position.x += this.velocity.x * delta;
    this.group.position.z += this.velocity.z * delta;
    this.life -= delta;
    if (this.life <= 0) this.alive = false;
  }
}
