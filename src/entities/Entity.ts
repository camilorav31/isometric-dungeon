import * as THREE from 'three';
import { AABB, makeAABB } from '../utils/collision';

export abstract class Entity {
  group: THREE.Group = new THREE.Group();
  hp: number;
  maxHp: number;
  alive = true;
  halfWidth: number;
  halfDepth: number;
  speed: number;

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
}
