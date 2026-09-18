import * as THREE from 'three';
import { createRenderer, createScene, addLighting } from '../scene/SceneSetup';
import { CameraController } from './CameraController';
import { InputManager } from './InputManager';
import { UIManager } from '../ui/UIManager';
import { PlayerState } from '../state/PlayerState';
import { Player } from '../entities/Player';
import { LobbyController } from '../lobby/LobbyController';
import { DungeonController } from '../dungeon/DungeonController';
import { DevMode } from './DevMode';

type Mode = 'LOBBY' | 'DUNGEON';

const LIGHT_OFFSET = new THREE.Vector3(-15, 25, -10);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: CameraController;
  private input: InputManager;
  private ui: UIManager;
  private clock = new THREE.Clock();

  private playerState = new PlayerState();
  private player: Player;

  private lobby: LobbyController;
  private dungeon: DungeonController;
  private mode: Mode = 'LOBBY';
  private paused = false;
  private currentFloor = 1;

  private moonLight!: THREE.DirectionalLight;
  private devMode: DevMode;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = createRenderer(canvas);
    this.scene = createScene();
    const { ambient, fill, moonLight } = addLighting(this.scene);
    this.moonLight = moonLight;

    this.camera = new CameraController(window.innerWidth / window.innerHeight);
    this.input = new InputManager(canvas);
    this.ui = new UIManager(uiRoot);

    this.player = new Player(this.playerState);
    this.scene.add(this.player.group);

    this.lobby = new LobbyController(
      this.scene,
      this.player,
      this.playerState,
      this.ui,
      this.camera,
      this.input,
      () => this.enterDungeon(),
    );

    this.dungeon = new DungeonController(
      this.scene,
      this.player,
      this.ui,
      this.camera,
      this.input,
      (won) => this.exitDungeon(won),
      () => this.onPlayerDied(),
      () => this.descendToNextFloor(),
    );

    this.devMode = new DevMode(
      this.scene,
      this.renderer,
      uiRoot,
      this.playerState,
      { ambient, fill, moon: moonLight },
      () => this.devReturnToLobby(),
      () => {
        this.player.syncStatsFromState();
        this.ui.refreshOpenPanel();
      },
    );

    window.addEventListener('resize', this.onResize);

    this.enterLobby(true);
    this.renderer.setAnimationLoop(this.animate);
  }

  private onResize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.setAspect(window.innerWidth / window.innerHeight);
  };

  private enterLobby(initial = false) {
    this.mode = 'LOBBY';
    this.currentFloor = 1;
    this.playerState.resetForLobby();
    this.player.syncStatsFromState();
    this.player.group.visible = true;
    const spawn = this.lobby.build();
    this.player.group.position.copy(spawn);
    this.ui.showHUD(false);
    if (!initial) this.ui.showToast('De vuelta en el campamento');
  }

  private enterDungeon() {
    this.mode = 'DUNGEON';
    this.currentFloor = 1;
    this.lobby.teardown();
    const spawn = this.dungeon.generate(this.currentFloor);
    this.player.group.position.copy(spawn);
    this.ui.showHUD(true);
  }

  /** Presses onward from the boss room's stairway instead of cashing out at the lobby. */
  private descendToNextFloor() {
    this.currentFloor += 1;
    const spawn = this.dungeon.generate(this.currentFloor);
    this.player.group.position.copy(spawn);
  }

  private exitDungeon(won: boolean) {
    if (won) {
      this.playerState.commitRunLoot();
      this.ui.showToast('Botín asegurado');
    }
    this.dungeon.dispose();
    this.enterLobby();
  }

  private onPlayerDied() {
    if (this.paused) return;
    this.paused = true;
    this.playerState.discardRunLoot();
    this.ui.showMessage('Has muerto', 'Pierdes el botín de esta incursión...', true);
    window.setTimeout(() => {
      this.ui.showMessage('', '', false);
      this.dungeon.dispose();
      this.enterLobby();
      this.paused = false;
    }, 2200);
  }

  private devReturnToLobby() {
    if (this.mode === 'DUNGEON') {
      this.dungeon.dispose();
    }
    this.enterLobby();
  }

  private animate = () => {
    const delta = Math.min(this.clock.getDelta(), 0.05);

    this.camera.handleInput(this.input, delta);

    if (this.input.wasJustPressed('F1')) this.devMode.toggle();
    if (this.devMode.enabled && this.input.wasJustPressed('KeyG')) this.devMode.toggleGodMode();

    if (!this.paused) {
      if (this.mode === 'LOBBY') {
        this.lobby.update(delta);
      } else {
        this.dungeon.update(delta);
      }
    }

    if (this.devMode.godMode && this.mode === 'DUNGEON') {
      this.player.hp = this.player.maxHp;
    }

    this.camera.update(this.player.group.position, delta);

    this.moonLight.position.copy(this.player.group.position).add(LIGHT_OFFSET);
    this.moonLight.target.position.copy(this.player.group.position);
    this.moonLight.target.updateMatrixWorld();

    this.ui.updateHealthBars(this.camera.camera, window.innerWidth, window.innerHeight);

    if (this.devMode.enabled) {
      const overlayInfo = this.mode === 'LOBBY' ? this.lobby.getDevOverlayInfo() : this.dungeon.getDevOverlayInfo();
      this.devMode.update(delta, overlayInfo, this.player.getAABB(), this.player.group.position);
    }

    this.renderer.render(this.scene, this.camera.camera);
    this.input.endFrame();
  };
}
