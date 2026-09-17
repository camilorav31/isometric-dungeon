import * as THREE from 'three';
import { AABB } from '../utils/collision';

export interface DevOverlayInfo {
  walls: AABB[];
  rooms: AABB[];
  enemies: AABB[];
  traps: AABB[];
  roomLabel: string;
  enemyCount: number;
  projectileCount: number;
  particleCount: number;
}

const HITBOX_Y = 0.08;

function boxLine(aabb: AABB, color: number, y = HITBOX_Y): THREE.LineLoop {
  const points = [
    new THREE.Vector3(aabb.minX, y, aabb.minZ),
    new THREE.Vector3(aabb.maxX, y, aabb.minZ),
    new THREE.Vector3(aabb.maxX, y, aabb.maxZ),
    new THREE.Vector3(aabb.minX, y, aabb.maxZ),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.LineLoop(geometry, material);
}

/**
 * Developer/tester toggle (F1): hitbox wireframes, a ground grid, an info
 * panel and a god-mode HP toggle — a foundation for later verifying a future
 * tile-based scene construction system, not part of that system itself.
 */
export class DevMode {
  enabled = false;
  godMode = false;

  private overlayGroup: THREE.Group;
  private gridHelper: THREE.GridHelper;
  private infoPanel: HTMLDivElement;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private fpsDisplay = 0;

  constructor(private scene: THREE.Scene, uiRoot: HTMLElement) {
    this.overlayGroup = new THREE.Group();
    this.overlayGroup.visible = false;
    this.scene.add(this.overlayGroup);

    this.gridHelper = new THREE.GridHelper(200, 200, 0x5a8fd6, 0x2a3a4a);
    this.gridHelper.position.y = 0.02;
    this.gridHelper.visible = false;
    this.scene.add(this.gridHelper);

    this.infoPanel = document.createElement('div');
    this.infoPanel.className = 'dev-info-panel';
    this.infoPanel.style.display = 'none';
    uiRoot.appendChild(this.infoPanel);
  }

  toggle() {
    this.enabled = !this.enabled;
    this.overlayGroup.visible = this.enabled;
    this.gridHelper.visible = this.enabled;
    this.infoPanel.style.display = this.enabled ? 'block' : 'none';
  }

  toggleGodMode() {
    this.godMode = !this.godMode;
  }

  private clearOverlay() {
    for (const child of [...this.overlayGroup.children]) {
      this.overlayGroup.remove(child);
      const line = child as THREE.LineLoop;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
  }

  update(delta: number, info: DevOverlayInfo, playerAABB: AABB, playerPos: THREE.Vector3) {
    if (!this.enabled) return;

    this.clearOverlay();
    for (const aabb of info.walls) this.overlayGroup.add(boxLine(aabb, 0xff5555));
    for (const aabb of info.rooms) this.overlayGroup.add(boxLine(aabb, 0x4f8fc4, 0.05));
    for (const aabb of info.enemies) this.overlayGroup.add(boxLine(aabb, 0xffaa33));
    for (const aabb of info.traps) this.overlayGroup.add(boxLine(aabb, 0xaa44ff));
    this.overlayGroup.add(boxLine(playerAABB, 0x7fff7f));

    this.fpsAccum += delta;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.infoPanel.innerHTML = `
      <div><b>DEV MODE</b> (F1)</div>
      <div>FPS: ${this.fpsDisplay} · frame: ${(delta * 1000).toFixed(1)}ms</div>
      <div>Pos: ${playerPos.x.toFixed(1)}, ${playerPos.z.toFixed(1)}</div>
      <div>Sala: ${info.roomLabel}</div>
      <div>Enemigos: ${info.enemyCount} · Proyectiles: ${info.projectileCount} · Partículas: ${info.particleCount}</div>
      <div>God mode: ${this.godMode ? 'ON' : 'off'} (G)</div>
    `;
  }
}
