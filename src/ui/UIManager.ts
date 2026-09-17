import * as THREE from 'three';
import { Entity } from '../entities/Entity';

const HOTBAR_KEYS = ['1', '2', '3', 'R'];

interface TrackedBar {
  entity: Entity;
  el: HTMLDivElement;
  inner: HTMLDivElement;
}

export class UIManager {
  root: HTMLElement;
  private hpBarLayer: HTMLDivElement;
  private trackedBars: TrackedBar[] = [];

  private hudFrame: HTMLDivElement;
  private hudHpInner: HTMLDivElement;
  private hudStaminaInner: HTMLDivElement;
  private hudAttackCdInner: HTMLDivElement;
  private hudSkillSlots: HTMLDivElement[];
  private hudSkillLabels: HTMLDivElement[];
  private damageNumberLayer: HTMLDivElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;

  private interactPrompt: HTMLDivElement;
  private lobbyMenu: HTMLDivElement;
  private panelOverlay: HTMLDivElement;
  private messageOverlay: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private roomBanner: HTMLDivElement;
  private soulsDisplay: HTMLDivElement;
  private toastTimeout: number | undefined;
  private bannerTimeout: number | undefined;

  constructor(root: HTMLElement) {
    this.root = root;

    this.hpBarLayer = document.createElement('div');
    root.appendChild(this.hpBarLayer);

    this.damageNumberLayer = document.createElement('div');
    root.appendChild(this.damageNumberLayer);

    const skillSlotsHtml = HOTBAR_KEYS.map(
      (key, i) => `
        <div class="hud-skill-slot">
          <div class="hud-skill-slot-label" id="hud-skill-label-${i}">[${key}] —</div>
          <div class="cd-overlay" id="hud-skill-cd-${i}"></div>
        </div>`,
    ).join('');

    this.hudFrame = document.createElement('div');
    this.hudFrame.className = 'hud-bar-frame';
    this.hudFrame.innerHTML = `
      <div class="hud-label">Vida</div>
      <div class="hud-hp-outer"><div class="hud-hp-inner" id="hud-hp-inner"></div></div>
      <div class="hud-label" style="margin-top:8px;">Estamina</div>
      <div class="hud-hp-outer"><div class="hud-stamina-inner" id="hud-stamina-inner"></div></div>
      <div class="hud-label" style="margin-top:8px;">Ataque</div>
      <div class="hud-cd-outer"><div class="hud-cd-inner" id="hud-attack-cd"></div></div>
      <div class="hud-skill-row">${skillSlotsHtml}</div>
    `;
    root.appendChild(this.hudFrame);
    this.hudHpInner = this.hudFrame.querySelector('#hud-hp-inner')!;
    this.hudStaminaInner = this.hudFrame.querySelector('#hud-stamina-inner')!;
    this.hudAttackCdInner = this.hudFrame.querySelector('#hud-attack-cd')!;
    this.hudSkillSlots = HOTBAR_KEYS.map((_, i) => this.hudFrame.querySelector(`#hud-skill-cd-${i}`)!);
    this.hudSkillLabels = HOTBAR_KEYS.map((_, i) => this.hudFrame.querySelector(`#hud-skill-label-${i}`)!);
    this.hudFrame.style.display = 'none';

    this.interactPrompt = document.createElement('div');
    this.interactPrompt.className = 'interact-prompt';
    root.appendChild(this.interactPrompt);

    this.lobbyMenu = document.createElement('div');
    this.lobbyMenu.className = 'lobby-menu interactive';
    root.appendChild(this.lobbyMenu);

    this.panelOverlay = document.createElement('div');
    this.panelOverlay.className = 'panel-overlay hidden';
    root.appendChild(this.panelOverlay);

    this.messageOverlay = document.createElement('div');
    this.messageOverlay.className = 'message-overlay';
    root.appendChild(this.messageOverlay);

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast';
    root.appendChild(this.toastEl);

    this.roomBanner = document.createElement('div');
    this.roomBanner.className = 'room-banner';
    root.appendChild(this.roomBanner);

    const hint = document.createElement('div');
    hint.className = 'crosshair-hint';
    hint.innerHTML =
      'WASD mover · Click/Espacio atacar · Shift rodar<br/>1-2-3-R habilidades · Q/E rotar cámara · Click derecho arrastrar · Scroll zoom · F1 modo DEV';
    root.appendChild(hint);

    this.soulsDisplay = document.createElement('div');
    this.soulsDisplay.className = 'souls-display';
    root.appendChild(this.soulsDisplay);

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.className = 'minimap-canvas';
    this.minimapCanvas.width = 150;
    this.minimapCanvas.height = 150;
    this.minimapCanvas.style.display = 'none';
    root.appendChild(this.minimapCanvas);
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
  }

  // ---------- souls (lobby currency badge) ----------

  showSoulsDisplay(show: boolean) {
    this.soulsDisplay.style.display = show ? 'block' : 'none';
  }

  updateSoulsDisplay(souls: number) {
    this.soulsDisplay.textContent = `Almas: ${souls}`;
  }

  // ---------- HUD ----------

  showHUD(show: boolean) {
    this.hudFrame.style.display = show ? 'block' : 'none';
    this.minimapCanvas.style.display = show ? 'block' : 'none';
  }

  // ---------- minimap ----------

  updateMinimap(rooms: Array<{ gridX: number; gridY: number; type: string; visited: boolean; cleared: boolean; current: boolean }>) {
    const ctx = this.minimapCtx;
    const size = 150;
    const cell = 22;
    const cx = size / 2;
    const cy = size / 2;
    ctx.clearRect(0, 0, size, size);
    for (const room of rooms) {
      if (!room.visited) continue;
      const x = cx + room.gridX * cell - (cell - 3) / 2;
      const y = cy + room.gridY * cell - (cell - 3) / 2;
      ctx.fillStyle =
        room.type === 'boss'
          ? '#8b2020'
          : room.type === 'treasure'
            ? '#d1a237'
            : room.type === 'start'
              ? '#2d6b3d'
              : room.cleared
                ? '#4a4a4a'
                : '#6b6b6b';
      ctx.fillRect(x, y, cell - 3, cell - 3);
      if (room.current) {
        ctx.strokeStyle = '#e8dcc4';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cell - 3, cell - 3);
      }
    }
  }

  updateHUD(
    hp: number,
    maxHp: number,
    stamina: number,
    maxStamina: number,
    attackReadiness: number,
    skillReadiness: number[],
    skillLabels?: string[],
  ) {
    const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    this.hudHpInner.style.width = `${hpPct}%`;
    const staminaPct = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));
    this.hudStaminaInner.style.width = `${staminaPct}%`;
    this.hudAttackCdInner.style.width = `${Math.max(0, Math.min(1, attackReadiness)) * 100}%`;
    skillReadiness.forEach((readiness, i) => {
      const slot = this.hudSkillSlots[i];
      if (slot) slot.style.height = `${(1 - Math.max(0, Math.min(1, readiness))) * 100}%`;
    });
    if (skillLabels) {
      skillLabels.forEach((label, i) => {
        const el = this.hudSkillLabels[i];
        if (el) el.textContent = `[${HOTBAR_KEYS[i]}] ${label}`;
      });
    }
  }

  // ---------- floating damage numbers ----------

  spawnDamageNumber(worldPos: THREE.Vector3, camera: THREE.Camera, amount: number, variant: 'enemy' | 'player' = 'enemy') {
    const v = worldPos.clone().project(camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = variant === 'player' ? 'damage-number player-damage' : 'damage-number';
    el.textContent = String(Math.round(amount));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.damageNumberLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  }

  // ---------- floating entity hp bars ----------

  registerHealthBar(entity: Entity, friendly = false): void {
    const el = document.createElement('div');
    el.className = 'entity-hpbar';
    const inner = document.createElement('div');
    inner.className = friendly ? 'entity-hpbar-inner friendly' : 'entity-hpbar-inner';
    el.appendChild(inner);
    this.hpBarLayer.appendChild(el);
    this.trackedBars.push({ entity, el, inner });
  }

  unregisterHealthBar(entity: Entity): void {
    const idx = this.trackedBars.findIndex((t) => t.entity === entity);
    if (idx >= 0) {
      this.trackedBars[idx].el.remove();
      this.trackedBars.splice(idx, 1);
    }
  }

  clearHealthBars(): void {
    for (const t of this.trackedBars) t.el.remove();
    this.trackedBars = [];
  }

  updateHealthBars(camera: THREE.Camera, viewportW: number, viewportH: number): void {
    const v = new THREE.Vector3();
    for (const t of this.trackedBars) {
      if (!t.entity.alive) {
        t.el.style.display = 'none';
        continue;
      }
      t.entity.getHeadWorldPosition(v);
      v.project(camera);
      if (v.z > 1) {
        t.el.style.display = 'none';
        continue;
      }
      t.el.style.display = 'block';
      const x = (v.x * 0.5 + 0.5) * viewportW;
      const y = (-v.y * 0.5 + 0.5) * viewportH;
      t.el.style.transform = `translate(${x}px, ${y}px)`;
      const pct = Math.max(0, Math.min(100, (t.entity.hp / t.entity.maxHp) * 100));
      t.inner.style.width = `${pct}%`;
    }
  }

  // ---------- interact prompt ----------

  setInteractPrompt(text: string | null) {
    if (text) {
      this.interactPrompt.textContent = text;
      this.interactPrompt.classList.add('visible');
    } else {
      this.interactPrompt.classList.remove('visible');
    }
  }

  // ---------- lobby menu ----------

  setLobbyMenu(buttons: Array<{ label: string; onClick: () => void }> | null) {
    this.lobbyMenu.innerHTML = '';
    if (!buttons) {
      this.lobbyMenu.style.display = 'none';
      return;
    }
    this.lobbyMenu.style.display = 'flex';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.onclick = b.onClick;
      this.lobbyMenu.appendChild(btn);
    }
  }

  // ---------- generic panel ----------

  showPanel(title: string, bodyHtml: string, onClose: () => void, wireUp?: (panelEl: HTMLElement) => void) {
    const prevScrollTop = this.panelOverlay.querySelector('.panel-box')?.scrollTop ?? 0;
    this.panelOverlay.classList.remove('hidden');
    this.panelOverlay.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'panel-box';
    box.innerHTML = `
      <div class="panel-title"><span>${title}</span><button class="close-btn">✕</button></div>
      <div class="panel-body">${bodyHtml}</div>
    `;
    this.panelOverlay.appendChild(box);
    box.scrollTop = prevScrollTop;
    box.querySelector('.close-btn')!.addEventListener('click', () => {
      this.hidePanel();
      onClose();
    });
    this.panelOverlay.onclick = (e) => {
      if (e.target === this.panelOverlay) {
        this.hidePanel();
        onClose();
      }
    };
    if (wireUp) wireUp(box);
  }

  hidePanel() {
    this.panelOverlay.classList.add('hidden');
    this.panelOverlay.innerHTML = '';
  }

  // ---------- messages / toast / banner ----------

  showMessage(big: string, small: string, visible: boolean) {
    if (visible) {
      this.messageOverlay.innerHTML = `<div class="big">${big}</div><div class="small">${small}</div>`;
      this.messageOverlay.classList.add('visible');
    } else {
      this.messageOverlay.classList.remove('visible');
    }
  }

  showToast(text: string, duration = 2200) {
    window.clearTimeout(this.toastTimeout);
    this.toastEl.textContent = text;
    this.toastEl.classList.add('visible');
    this.toastTimeout = window.setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, duration);
  }

  showRoomBanner(text: string, duration = 1800) {
    window.clearTimeout(this.bannerTimeout);
    this.roomBanner.textContent = text;
    this.roomBanner.classList.add('visible');
    this.bannerTimeout = window.setTimeout(() => {
      this.roomBanner.classList.remove('visible');
    }, duration);
  }
}
