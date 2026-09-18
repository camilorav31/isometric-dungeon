import * as THREE from 'three';
import { AABB } from '../utils/collision';
import { B, CHUNK_SIZE } from '../blocks/BlockGrid';
import {
  PlayerState,
  Rarity,
  LOOT_TABLE,
  RARITY_ORDER,
  RARITY_COLOR,
  RARITY_LABEL,
} from '../state/PlayerState';

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

/** The scene's main light sources, handed in so the DEV panel's brightness
 * slider can scale them together instead of duplicating SceneSetup's values. */
export interface DevLights {
  ambient: THREE.AmbientLight;
  fill: THREE.HemisphereLight;
  moon: THREE.DirectionalLight;
}

type GridGroup = 'cell' | 'chunk' | 'wall';

const HITBOX_Y = 0.08;

function boxLine(aabb: AABB, color: number, y = HITBOX_Y, opacity = 1): THREE.LineLoop {
  const points = [
    new THREE.Vector3(aabb.minX, y, aabb.minZ),
    new THREE.Vector3(aabb.maxX, y, aabb.minZ),
    new THREE.Vector3(aabb.maxX, y, aabb.maxZ),
    new THREE.Vector3(aabb.minX, y, aabb.maxZ),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
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
  private chunkGridHelper: THREE.GridHelper;
  private infoPanel: HTMLDivElement;
  private devPanel: HTMLDivElement;
  private gridPanel: HTMLDivElement;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private fpsDisplay = 0;

  // Grid span/height are fixed geometry constants (see the math note in the
  // constructor); color/opacity/on-off per subgroup are runtime-editable via
  // the grid panel, so a GridHelper is disposed and rebuilt whenever its
  // color changes (its line color is baked into per-vertex geometry data,
  // not a material property that can just be reassigned).
  private readonly span: number;
  private readonly gridY: number;
  private cellOn = true;
  private chunkOn = true;
  private wallBorderOn = true;
  private cellColor = 0x39ff14; // vivid green — per-block cell grid
  private chunkColor = 0x0d1b6e; // dark royal blue — per-chunk grid
  private wallBorderColor = 0xff0000; // vivid red — wall/border bounds
  private cellOpacity = 0.6;
  private chunkOpacity = 0.85;
  private wallBorderOpacity = 1;

  private baseIntensity: { ambient: number; fill: number; moon: number };
  private brightnessFactor = 1;

  constructor(
    private scene: THREE.Scene,
    uiRoot: HTMLElement,
    private playerState: PlayerState,
    private lights: DevLights,
    private onReturnToLobby: () => void,
    private onSyncStats: () => void,
  ) {
    this.baseIntensity = {
      ambient: lights.ambient.intensity,
      fill: lights.fill.intensity,
      moon: lights.moon.intensity,
    };

    this.overlayGroup = new THREE.Group();
    this.overlayGroup.visible = false;
    this.scene.add(this.overlayGroup);

    // Fine grid: one line per block cell (B). Bold grid: one line per chunk
    // (CHUNK_SIZE blocks) — both derived from the block system's own
    // constants instead of a hardcoded size, so they can't drift out of
    // sync with it.
    this.span = CHUNK_SIZE * B * 12; // a round number of whole chunks across
    // Sits above the tallest tile a floor can raise to (tile height + wobble +
    // dais raise, see createStoneTileFloor) — a tiled floor is solid boxes,
    // not a paper-thin plane, so a grid at the old y=0.02 would render buried
    // inside it instead of visibly on top.
    this.gridY = 0.3;

    this.gridHelper = this.buildCellGrid();
    this.scene.add(this.gridHelper);
    this.chunkGridHelper = this.buildChunkGrid();
    this.scene.add(this.chunkGridHelper);

    this.infoPanel = document.createElement('div');
    this.infoPanel.className = 'dev-info-panel';
    this.infoPanel.style.display = 'none';
    uiRoot.appendChild(this.infoPanel);

    // `interactive` opts this panel out of the #ui-root pointer-events:none overlay,
    // without which its buttons are visible but unclickable.
    this.devPanel = document.createElement('div');
    this.devPanel.className = 'dev-panel interactive';
    this.devPanel.style.display = 'none';
    uiRoot.appendChild(this.devPanel);

    this.gridPanel = document.createElement('div');
    this.gridPanel.className = 'dev-grid-panel interactive';
    this.gridPanel.style.display = 'none';
    uiRoot.appendChild(this.gridPanel);

    this.buildDevButtons();
    this.buildGridPanel();
  }

  // A cell with integer coordinate `x` is a block CENTERED at world x (see
  // BlockGrid.ts / createStoneTileFloor), so its edges sit at x±B/2 — i.e.
  // at half-integers, not at the integers a THREE.GridHelper centered on
  // the origin draws lines at by default. Without this offset every grid
  // line cuts through the middle of a tile instead of running along its
  // border. Shifting the whole grid by -B/2 on both axes moves its lines
  // from cell CENTERS to cell EDGES. Chunk boundaries are `floor(x/CHUNK_SIZE)`,
  // so a chunk edge is also at a cell edge (e.g. cell 0's left edge, -0.5) —
  // the same -B/2 shift lines up the bold chunk grid too, since CHUNK_SIZE*B
  // is a whole multiple of B and the shift is invariant mod B.
  private buildCellGrid(): THREE.GridHelper {
    const grid = new THREE.GridHelper(this.span, this.span / B, this.cellColor, this.cellColor);
    grid.position.set(-B / 2, this.gridY, -B / 2);
    const mat = grid.material as THREE.Material;
    mat.transparent = true;
    mat.opacity = this.cellOpacity;
    grid.visible = this.enabled && this.cellOn;
    return grid;
  }

  private buildChunkGrid(): THREE.GridHelper {
    const grid = new THREE.GridHelper(this.span, this.span / (CHUNK_SIZE * B), this.chunkColor, this.chunkColor);
    grid.position.set(-B / 2, this.gridY + 0.01, -B / 2);
    const mat = grid.material as THREE.Material;
    mat.transparent = true;
    mat.opacity = this.chunkOpacity;
    grid.visible = this.enabled && this.chunkOn;
    return grid;
  }

  private rebuildCellGrid() {
    this.scene.remove(this.gridHelper);
    this.gridHelper.geometry.dispose();
    (this.gridHelper.material as THREE.Material).dispose();
    this.gridHelper = this.buildCellGrid();
    this.scene.add(this.gridHelper);
  }

  private rebuildChunkGrid() {
    this.scene.remove(this.chunkGridHelper);
    this.chunkGridHelper.geometry.dispose();
    (this.chunkGridHelper.material as THREE.Material).dispose();
    this.chunkGridHelper = this.buildChunkGrid();
    this.scene.add(this.chunkGridHelper);
  }

  private buildDevButtons() {
    const rarities = [...RARITY_ORDER].reverse();

    const buttons = rarities
      .map(
        (rarity) =>
          `<button class="dev-equip-btn" data-rarity="${rarity}" style="border-left-color:${RARITY_COLOR[rarity]}">${RARITY_LABEL[rarity]}</button>`,
      )
      .join('');

    this.devPanel.innerHTML = `
      <div class="dev-panel-title">DEV EQUIPO</div>
      ${buttons}
      <button class="dev-return-btn">Volver al lobby</button>
    `;

    this.devPanel.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button) return;
      const rarity = button.dataset.rarity as Rarity | undefined;
      if (rarity) this.equipFullSet(rarity);
      else if (button.classList.contains('dev-return-btn')) this.onReturnToLobby();
    });
  }

  private gridRow(group: GridGroup, label: string, color: number, opacity: number): string {
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    return `
      <div class="dev-grid-row">
        <label class="dev-grid-label">
          <input type="checkbox" class="dev-grid-toggle" data-group="${group}" checked> ${label}
        </label>
        <input type="color" class="dev-grid-color" data-group="${group}" value="${hex}">
        <input type="range" class="dev-grid-opacity" data-group="${group}" min="0" max="1" step="0.05" value="${opacity}">
      </div>
    `;
  }

  private buildGridPanel() {
    this.gridPanel.innerHTML = `
      <div class="dev-panel-title">GRID / LUZ</div>
      ${this.gridRow('cell', 'Celdas', this.cellColor, this.cellOpacity)}
      ${this.gridRow('chunk', 'Chunks', this.chunkColor, this.chunkOpacity)}
      ${this.gridRow('wall', 'Paredes', this.wallBorderColor, this.wallBorderOpacity)}
      <div class="dev-grid-divider"></div>
      <div class="dev-grid-row">
        <label class="dev-grid-label">Brillo</label>
        <input type="range" class="dev-brightness" min="0.3" max="2" step="0.05" value="${this.brightnessFactor}" style="width:120px">
      </div>
    `;

    const onInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const group = target.dataset.group as GridGroup | undefined;

      if (target.classList.contains('dev-brightness')) {
        this.setBrightness(parseFloat(target.value));
        return;
      }
      if (!group) return;
      if (target.classList.contains('dev-grid-toggle')) this.setGroupVisible(group, target.checked);
      else if (target.classList.contains('dev-grid-color')) this.setGroupColor(group, target.value);
      else if (target.classList.contains('dev-grid-opacity')) this.setGroupOpacity(group, parseFloat(target.value));
    };

    this.gridPanel.addEventListener('input', onInput);
    this.gridPanel.addEventListener('change', onInput);
  }

  private setGroupVisible(group: GridGroup, on: boolean) {
    if (group === 'cell') {
      this.cellOn = on;
      this.gridHelper.visible = this.enabled && on;
    } else if (group === 'chunk') {
      this.chunkOn = on;
      this.chunkGridHelper.visible = this.enabled && on;
    } else {
      this.wallBorderOn = on;
    }
  }

  private setGroupColor(group: GridGroup, hex: string) {
    const color = parseInt(hex.replace('#', ''), 16);
    if (group === 'cell') {
      this.cellColor = color;
      this.rebuildCellGrid();
    } else if (group === 'chunk') {
      this.chunkColor = color;
      this.rebuildChunkGrid();
    } else {
      this.wallBorderColor = color; // wall outlines are rebuilt every frame in update(), so just store it
    }
  }

  private setGroupOpacity(group: GridGroup, value: number) {
    if (group === 'cell') {
      this.cellOpacity = value;
      (this.gridHelper.material as THREE.Material).opacity = value;
    } else if (group === 'chunk') {
      this.chunkOpacity = value;
      (this.chunkGridHelper.material as THREE.Material).opacity = value;
    } else {
      this.wallBorderOpacity = value;
    }
  }

  /** Scales the scene's ambient/fill/moon lights together from their SceneSetup
   * base values — a single "brightness" knob instead of three disconnected ones. */
  private setBrightness(factor: number) {
    this.brightnessFactor = factor;
    this.lights.ambient.intensity = this.baseIntensity.ambient * factor;
    this.lights.fill.intensity = this.baseIntensity.fill * factor;
    this.lights.moon.intensity = this.baseIntensity.moon * factor;
  }

  /** Replaces every equipment slot with the strongest item of the given rarity. */
  private equipFullSet(rarity: Rarity) {
    this.playerState.equipped = {};

    for (const template of LOOT_TABLE[rarity]) {
      if (this.playerState.equipped[template.slot]) continue;
      this.playerState.equipped[template.slot] = {
        ...template,
        id: `dev_${rarity}_${template.slot}`,
        rarity,
      };
    }

    this.onSyncStats();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.overlayGroup.visible = this.enabled;
    this.gridHelper.visible = this.enabled && this.cellOn;
    this.chunkGridHelper.visible = this.enabled && this.chunkOn;
    this.infoPanel.style.display = this.enabled ? 'block' : 'none';
    this.devPanel.style.display = this.enabled ? 'block' : 'none';
    this.gridPanel.style.display = this.enabled ? 'block' : 'none';
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
    if (this.wallBorderOn) {
      for (const aabb of info.walls) {
        this.overlayGroup.add(boxLine(aabb, this.wallBorderColor, HITBOX_Y, this.wallBorderOpacity));
      }
    }
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
