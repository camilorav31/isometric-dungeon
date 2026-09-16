import * as THREE from 'three';
import { Entity } from '../entities/Entity';

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
  private hudSkillLabel: HTMLDivElement;

  private interactPrompt: HTMLDivElement;
  private lobbyMenu: HTMLDivElement;
  private panelOverlay: HTMLDivElement;
  private messageOverlay: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private roomBanner: HTMLDivElement;
  private toastTimeout: number | undefined;
  private bannerTimeout: number | undefined;

  constructor(root: HTMLElement) {
    this.root = root;

    this.hpBarLayer = document.createElement('div');
    root.appendChild(this.hpBarLayer);

    this.hudFrame = document.createElement('div');
    this.hudFrame.className = 'hud-bar-frame';
    this.hudFrame.innerHTML = `
      <div class="hud-label">Vida</div>
      <div class="hud-hp-outer"><div class="hud-hp-inner" id="hud-hp-inner"></div></div>
      <div class="hud-skill" id="hud-skill"></div>
    `;
    root.appendChild(this.hudFrame);
    this.hudHpInner = this.hudFrame.querySelector('#hud-hp-inner')!;
    this.hudSkillLabel = this.hudFrame.querySelector('#hud-skill')!;
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
    hint.innerHTML = 'WASD mover · Click/Espacio atacar<br/>Q/E rotar cámara · Click derecho arrastrar · Scroll zoom';
    root.appendChild(hint);
  }

  // ---------- HUD ----------

  showHUD(show: boolean) {
    this.hudFrame.style.display = show ? 'block' : 'none';
  }

  updateHUD(hp: number, maxHp: number, skillName: string) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    this.hudHpInner.style.width = `${pct}%`;
    this.hudSkillLabel.textContent = `[1] ${skillName}`;
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
    this.panelOverlay.classList.remove('hidden');
    this.panelOverlay.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'panel-box';
    box.innerHTML = `
      <div class="panel-title"><span>${title}</span><button class="close-btn">✕</button></div>
      <div class="panel-body">${bodyHtml}</div>
    `;
    this.panelOverlay.appendChild(box);
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
