import * as THREE from 'three';
import {
  createCharacterMesh,
  createShieldMesh,
  createWeaponMesh,
  mountWeapon,
  CharacterRig,
  HAND_UPRIGHT_ROTATION,
  PALETTE,
  stdMat,
} from '../utils/geometryFactory';
import { EquipmentSlot, ItemDef, Rarity } from '../state/PlayerState';

const BLADE_COLOR_BY_RARITY: Record<Rarity, string> = {
  common: '#c9c9c9',
  rare: '#6fd67f',
  unique: '#5aa8e8',
  magical: '#b57fe0',
  mythic: '#f2dd6e',
  legendary: '#ffab4d',
};

/**
 * Small standalone 3D preview of the player's character + equipped gear,
 * rendered into its own canvas with its own renderer/scene/camera so it can
 * live inside an HTML panel without touching the main game scene.
 */
export class CharacterViewport {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rig: CharacterRig;
  private decorations: Partial<Record<EquipmentSlot, THREE.Object3D>> = {};
  private rafHandle: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.clientWidth || 180, canvas.clientHeight || 220, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, (canvas.clientWidth || 180) / (canvas.clientHeight || 220), 0.1, 20);
    this.camera.position.set(0, 1.1, 3.2);
    this.camera.lookAt(0, 0.9, 0);

    const key = new THREE.DirectionalLight('#ffffff', 1.1);
    key.position.set(2, 3, 2);
    const fill = new THREE.AmbientLight('#8a8a9a', 0.7);
    this.scene.add(key, fill);

    this.rig = createCharacterMesh('#5b6b7a', PALETTE.loot);
    this.scene.add(this.rig.group);
  }

  updateEquipment(equipped: Partial<Record<EquipmentSlot, ItemDef>>) {
    for (const key of Object.keys(this.decorations) as EquipmentSlot[]) {
      this.decorations[key]?.removeFromParent();
      delete this.decorations[key];
    }

    const weapon = equipped.mainHand;
    const weaponMesh = createWeaponMesh(weapon?.weaponVisual ?? 'sword', weapon ? BLADE_COLOR_BY_RARITY[weapon.rarity] : BLADE_COLOR_BY_RARITY.common);
    this.decorations.mainHand = mountWeapon(this.rig.rightHand, weaponMesh);

    if (equipped.offHand) {
      const offHandPivot = new THREE.Group();
      offHandPivot.rotation.x = HAND_UPRIGHT_ROTATION; // counter the arm's rest lean so the shield hangs upright
      offHandPivot.add(createShieldMesh(equipped.offHand.color, '#8a8a8a'));
      this.rig.leftForearmMount.add(offHandPivot); // strapped to the forearm, not held at the fingertips
      this.decorations.offHand = offHandPivot;
    }

    // Helmet/armor/boots/cape are still flat-color placeholder boxes (the real
    // per-slot geometry is future work), but they're now parented at local
    // (0,0,0) on the rig's named sockets instead of hardcoded absolute Y —
    // so they stay correctly placed if the base body's proportions change
    // again, and this is the first real exercise of the socket system.
    if (equipped.helmet) {
      const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.34), stdMat(equipped.helmet.color));
      this.rig.headSocket.add(helmet);
      this.decorations.helmet = helmet;
    }
    if (equipped.armor) {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.4), stdMat(equipped.armor.color));
      this.rig.torsoSocket.add(armor);
      this.decorations.armor = armor;
    }
    if (equipped.boots) {
      const boots = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.36), stdMat(equipped.boots.color));
      boots.position.y = 0.12;
      this.rig.feetSocket.add(boots);
      this.decorations.boots = boots;
    }
    if (equipped.cape) {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.08), stdMat(equipped.cape.color, { side: THREE.DoubleSide }));
      this.rig.backSocket.add(cape);
      this.decorations.cape = cape;
    }
  }

  start() {
    this.stop();
    const animate = () => {
      this.rig.group.rotation.y += 0.012;
      this.renderer.render(this.scene, this.camera);
      this.rafHandle = requestAnimationFrame(animate);
    };
    animate();
  }

  stop() {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  dispose() {
    this.stop();
    this.renderer.dispose();
  }
}
