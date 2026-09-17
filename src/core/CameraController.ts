import * as THREE from 'three';
import { InputManager } from './InputManager';

const PITCH = THREE.MathUtils.degToRad(35);
const DISTANCE = 34;
const MIN_ZOOM = 8;
const MAX_ZOOM = 26;
const ROTATE_SNAP_SPEED = 8; // lerp speed for Q/E snapping
const DRAG_SENSITIVITY = 0.008;
const WHEEL_ZOOM_SPEED = 0.02;

export class CameraController {
  camera: THREE.OrthographicCamera;
  yaw = Math.PI / 4;
  private targetYaw = Math.PI / 4;
  private zoom = 16;
  private aspect: number;
  private shakeTime = 0;
  private shakeMagnitude = 0;

  constructor(aspect: number) {
    this.aspect = aspect;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.updateProjection();
  }

  setAspect(aspect: number) {
    this.aspect = aspect;
    this.updateProjection();
  }

  private updateProjection() {
    const halfH = this.zoom;
    const halfW = this.zoom * this.aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  handleInput(input: InputManager, delta: number) {
    if (input.wasJustPressed('KeyQ')) this.targetYaw += Math.PI / 2;
    if (input.wasJustPressed('KeyE')) this.targetYaw -= Math.PI / 2;

    const drag = input.consumeDrag();
    if (drag.dx !== 0) {
      const rot = -drag.dx * DRAG_SENSITIVITY;
      this.yaw += rot;
      this.targetYaw = this.yaw;
    }

    const wheel = input.consumeWheel();
    if (wheel !== 0) {
      this.zoom = THREE.MathUtils.clamp(this.zoom + wheel * WHEEL_ZOOM_SPEED, MIN_ZOOM, MAX_ZOOM);
      this.updateProjection();
    }

    // smoothly approach targetYaw (handles Q/E snap; no-op while dragging since target==yaw)
    const diff = this.targetYaw - this.yaw;
    if (Math.abs(diff) > 0.0001) {
      this.yaw += diff * Math.min(1, ROTATE_SNAP_SPEED * delta);
    }
  }

  /** Direction the camera is looking, flattened to the XZ plane (normalized). */
  getForward(): THREE.Vector2 {
    return new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
  }

  getRight(): THREE.Vector2 {
    return new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
  }

  /** Converts a WASD input axis into a camera-relative, normalized world-space (x, z) direction. */
  computeMoveDirection(axisX: number, axisZ: number): { x: number; z: number } {
    if (axisX === 0 && axisZ === 0) return { x: 0, z: 0 };
    const forward = this.getForward();
    const right = this.getRight();
    let x = forward.x * -axisZ + right.x * axisX;
    let z = forward.y * -axisZ + right.y * axisX;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }

  /** Punchy feedback for hits — a brief random jolt layered on top of the follow position. */
  shake(magnitude: number, duration: number) {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(target: THREE.Vector3, delta = 0) {
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(PITCH),
      Math.sin(PITCH),
      Math.cos(this.yaw) * Math.cos(PITCH),
    ).multiplyScalar(DISTANCE);
    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target);

    if (this.shakeTime > 0) {
      this.shakeTime -= delta;
      const s = this.shakeMagnitude;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.5;
      this.camera.position.z += (Math.random() - 0.5) * s;
      if (this.shakeTime <= 0) this.shakeMagnitude = 0;
    }
  }
}
