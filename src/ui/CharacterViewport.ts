import * as THREE from 'three';
import {
  createCharacterMesh,
  createWeaponMesh,
  PALETTE,
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
  private characterGroup: THREE.Group;
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

    this.characterGroup = createCharacterMesh('#5b6b7a', PALETTE.loot);
    this.scene.add(this.characterGroup);
  }

  updateEquipment(equipped: Partial<Record<EquipmentSlot, ItemDef>>) {
    for (const key of Object.keys(this.decorations) as EquipmentSlot[]) {
      const obj = this.decorations[key];
      if (obj) this.characterGroup.remove(obj);
      delete this.decorations[key];
    }

    const weapon = equipped.mainHand;
    const weaponMesh = createWeaponMesh(weapon?.weaponVisual ?? 'sword', weapon ? BLADE_COLOR_BY_RARITY[weapon.rarity] : BLADE_COLOR_BY_RARITY.common);
    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.42, 0.95, 0);
    weaponPivot.rotation.x = -0.4;
    weaponMesh.position.set(0, -0.3, 0.15);
    weaponPivot.add(weaponMesh);
    this.characterGroup.add(weaponPivot);
    this.decorations.mainHand = weaponPivot;

    if (equipped.helmet) {
      const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.42), new THREE.MeshStandardMaterial({ color: equipped.helmet.color }));
      helmet.position.set(0, 1.68, 0);
      this.characterGroup.add(helmet);
      this.decorations.helmet = helmet;
    }
    if (equipped.armor) {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.46), new THREE.MeshStandardMaterial({ color: equipped.armor.color }));
      armor.position.set(0, 1.05, 0);
      this.characterGroup.add(armor);
      this.decorations.armor = armor;
    }
    if (equipped.boots) {
      const boots = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: equipped.boots.color }));
      boots.position.set(0, 0.11, 0);
      this.characterGroup.add(boots);
      this.decorations.boots = boots;
    }
    if (equipped.cape) {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.08), new THREE.MeshStandardMaterial({ color: equipped.cape.color, side: THREE.DoubleSide }));
      cape.position.set(0, 0.95, -0.24);
      this.characterGroup.add(cape);
      this.decorations.cape = cape;
    }
    if (equipped.ring) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), new THREE.MeshStandardMaterial({ color: equipped.ring.color }));
      ring.position.set(0.42, 0.68, 0.18);
      this.characterGroup.add(ring);
      this.decorations.ring = ring;
    }
    if (equipped.jewel) {
      const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshStandardMaterial({ color: equipped.jewel.color, emissive: new THREE.Color(equipped.jewel.color), emissiveIntensity: 0.4 }));
      jewel.position.set(0, 1.32, 0.24);
      this.characterGroup.add(jewel);
      this.decorations.jewel = jewel;
    }
    if (equipped.offHand) {
      const offHand = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: equipped.offHand.color }));
      offHand.position.set(-0.42, 0.9, 0.12);
      this.characterGroup.add(offHand);
      this.decorations.offHand = offHand;
    }
  }

  start() {
    this.stop();
    const animate = () => {
      this.characterGroup.rotation.y += 0.012;
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
