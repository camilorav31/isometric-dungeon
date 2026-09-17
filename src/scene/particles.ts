import * as THREE from 'three';

const GRAVITY = 9;

/** A short-lived burst of THREE.Points for hit sparks / death poofs — no shader, just one fading Points object. */
export class ParticleBurst {
  points: THREE.Points;
  private velocities: Float32Array;
  private life: number;
  private maxLife: number;

  constructor(position: THREE.Vector3, color: string, count = 10, speed = 3, maxLife = 0.4) {
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const theta = Math.random() * Math.PI * 2;
      const upBias = 0.5 + Math.random() * 0.5;
      const v = speed * (0.5 + Math.random() * 0.5);
      this.velocities[i * 3] = Math.cos(theta) * v;
      this.velocities[i * 3 + 1] = upBias * v;
      this.velocities[i * 3 + 2] = Math.sin(theta) * v;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: 0.14, transparent: true, opacity: 1, depthWrite: false });
    this.points = new THREE.Points(geometry, material);
    this.maxLife = maxLife;
    this.life = maxLife;
  }

  /** Returns false once the burst has fully faded, so the caller can remove/dispose it. */
  update(delta: number): boolean {
    this.life -= delta;
    if (this.life <= 0) return false;

    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) + this.velocities[i * 3] * delta);
      pos.setY(i, Math.max(0.02, pos.getY(i) + this.velocities[i * 3 + 1] * delta));
      pos.setZ(i, pos.getZ(i) + this.velocities[i * 3 + 2] * delta);
      this.velocities[i * 3 + 1] -= GRAVITY * delta;
    }
    pos.needsUpdate = true;
    (this.points.material as THREE.PointsMaterial).opacity = this.life / this.maxLife;
    return true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }
}
