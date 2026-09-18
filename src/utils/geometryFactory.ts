import * as THREE from 'three';
import { B } from '../blocks/BlockGrid';

export const PALETTE = {
  stoneLight: '#4a4a4a',
  stoneDark: '#2a2a2a',
  wood: '#3d2817',
  danger: '#8b2020',
  loot: '#2d6b3d',
};

export function stdMat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...opts });
}

/** Geometry cache, keyed by a caller-chosen string. Safe to share across every
 * character instance (player/enemies/viewport) since gameplay code never mutates
 * geometry at runtime — only materials get tinted (see the flash-safety note by
 * `createCharacterMesh`), so geometry is where cross-instance reuse is actually safe. */
const geometryCache = new Map<string, THREE.BufferGeometry>();
function sharedGeo<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
  let geo = geometryCache.get(key) as T | undefined;
  if (!geo) {
    geo = build();
    geometryCache.set(key, geo);
  }
  return geo;
}

export function createFloor(width: number, depth: number, color = PALETTE.stoneDark): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = stdMat(color, { roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

export interface TileFloorRaise {
  /** World-space center of a raised platform (e.g. a dais before an altar/portal). */
  x: number;
  z: number;
  radius: number;
  height: number;
}

export interface TileFloorOptions {
  /** Tiles span -halfExtent..halfExtent on both axes, in whole blocks. */
  halfExtent: number;
  colors: string[];
  /** Max +/- random per-tile height jitter — worn-flagstone unevenness, kept
   * small since nothing in this game follows floor height vertically (no
   * jump/step-up), so a big jitter would look like the character clipping. */
  wobble?: number;
  raise?: TileFloorRaise;
}

/**
 * One flat, single-block-tall tile per cell (each exactly B wide) instead of
 * one big plane — this is the block grid (see blocks/BlockGrid.ts) made
 * visible, with per-tile color variation and a small height offset for a
 * worn stone-floor look. Built as one InstancedMesh (one draw call for the
 * whole floor) since a 20-something-cell room is hundreds of instances.
 */
export function createStoneTileFloor(opts: TileFloorOptions): THREE.InstancedMesh {
  const { halfExtent, colors, wobble = 0, raise } = opts;
  const tileHeight = 0.12;
  const span = halfExtent * 2 + 1;
  const count = span * span;

  const geometry = new THREE.BoxGeometry(B, tileHeight, B);
  const material = stdMat('#ffffff', { roughness: 0.95, metalness: 0.03 });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let i = 0;
  for (let ix = -halfExtent; ix <= halfExtent; ix++) {
    for (let iz = -halfExtent; iz <= halfExtent; iz++) {
      const x = ix * B;
      const z = iz * B;
      let y = tileHeight / 2 + (Math.random() * 2 - 1) * wobble;
      if (raise && Math.hypot(x - raise.x, z - raise.z) < raise.radius) y += raise.height;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(colors[Math.floor(Math.random() * colors.length)]);
      mesh.setColorAt(i, color);
      i++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

const WALL_BLOCK_GROOVE = 0.05; // gap between adjacent stone blocks — a masonry seam, not a real material texture

export interface BlockWallOptions {
  /** Total wall length along its run, in world units — a whole number of blocks. */
  length: number;
  /** Total wall height, in world units — a whole number of blocks. */
  height: number;
  /** Wall thickness (front-to-back), in world units — usually B. */
  thickness: number;
  /** World axis the wall's length runs along. */
  axis: 'x' | 'z';
  colors: string[];
  fadeable?: boolean;
}

/**
 * One block-sized stone per cell (each exactly B wide/tall) instead of one flat
 * box — the wall built from the same per-cell grid the floor already uses (see
 * createStoneTileFloor), so "the wall" and "the block grid" are the same thing
 * instead of two disconnected representations. Per-block color variation plus
 * a small groove between blocks stands in for a real stone texture map (this
 * project has no texture-loading pipeline; every other surface "textures"
 * itself the same procedural way). One InstancedMesh per wall run.
 */
export function createStoneBlockWall(opts: BlockWallOptions): THREE.InstancedMesh {
  const { length, height, thickness, axis, colors, fadeable = false } = opts;
  const cols = Math.round(length / B);
  const rows = Math.round(height / B);
  const count = cols * rows;

  const faceSize = B - WALL_BLOCK_GROOVE;
  const sizeX = axis === 'x' ? faceSize : thickness;
  const sizeZ = axis === 'z' ? faceSize : thickness;
  const geometry = new THREE.BoxGeometry(sizeX, faceSize, sizeZ);
  const material = stdMat('#ffffff', { roughness: 0.95, metalness: 0.03 });
  if (fadeable) {
    material.transparent = true;
    material.depthWrite = false;
  }
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let i = 0;
  for (let col = 0; col < cols; col++) {
    const along = (col - (cols - 1) / 2) * B;
    for (let row = 0; row < rows; row++) {
      const y = row * B + B / 2;
      dummy.position.set(axis === 'x' ? along : 0, y, axis === 'z' ? along : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(colors[Math.floor(Math.random() * colors.length)]);
      mesh.setColorAt(i, color);
      i++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function createWallSegment(
  width: number,
  height: number,
  depth: number,
  color = PALETTE.stoneLight,
  fadeable = false,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = stdMat(color);
  if (fadeable) {
    mat.transparent = true;
    mat.depthWrite = false;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPillar(height: number): THREE.Group {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, height, 8), stdMat(PALETTE.stoneLight));
  shaft.position.y = height / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.65, 0.25, 8), stdMat(PALETTE.stoneDark));
  cap.position.y = height + 0.1;
  cap.castShadow = true;
  group.add(shaft, cap);
  return group;
}

export interface SpikeTrapMesh {
  group: THREE.Group;
  spikesGroup: THREE.Group;
}

export function createSpikeTrap(): SpikeTrapMesh {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.6), stdMat('#2f1414', { roughness: 1 }));
  plate.position.y = 0.05;
  plate.receiveShadow = true;
  group.add(plate);

  const spikesGroup = new THREE.Group();
  const spikeMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.5, roughness: 0.4 });
  const offsets: [number, number][] = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
    [0, 0],
  ];
  for (const [x, z] of offsets) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 5), spikeMat);
    spike.position.set(x, 0.3, z);
    spike.castShadow = true;
    spikesGroup.add(spike);
  }
  spikesGroup.scale.y = 0.05;
  spikesGroup.visible = false;
  group.add(spikesGroup);

  return { group, spikesGroup };
}

export function createDoorBlocker(width: number, height: number, depth: number): THREE.Mesh {
  const mesh = createWallSegment(width, height, depth, PALETTE.danger);
  (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x330606);
  return mesh;
}

export interface TorchMesh {
  group: THREE.Group;
  light: THREE.PointLight;
}

export function createTorch(): TorchMesh {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), stdMat(PALETTE.wood));
  pole.position.y = 0.6;
  pole.castShadow = true;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.35, 6),
    new THREE.MeshStandardMaterial({ color: '#e8823c', emissive: new THREE.Color('#c24d10'), emissiveIntensity: 1.2, roughness: 0.6 }),
  );
  flame.position.y = 1.35;
  group.add(pole, flame);

  // No shadow casting — only the moon's directional light casts shadows, so a
  // handful of these stay cheap even with a dozen torches in view.
  const light = new THREE.PointLight('#ff9142', 1.4, 7, 2);
  light.position.y = 1.4;
  group.add(light);

  return { group, light };
}

export function createChest(): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), stdMat(PALETTE.wood));
  base.position.y = 0.3;
  base.castShadow = true;
  base.receiveShadow = true;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.25, 0.75), stdMat('#2b1a0d'));
  lid.position.y = 0.72;
  lid.castShadow = true;
  group.add(base, lid);
  return group;
}

export function createTable(): THREE.Group {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1), stdMat(PALETTE.wood));
  top.position.y = 0.75;
  top.castShadow = true;
  group.add(top);
  const legPositions: [number, number][] = [
    [-0.9, -0.4],
    [0.9, -0.4],
    [-0.9, 0.4],
    [0.9, 0.4],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), stdMat('#2b1a0d'));
    leg.position.set(x, 0.375, z);
    leg.castShadow = true;
    group.add(leg);
  }
  return group;
}

/** A freestanding stone archway with a glowing vertical veil — walked through, not stepped onto. */
export function createPortal(color = PALETTE.loot): THREE.Group {
  const group = new THREE.Group();
  const frameMat = stdMat(PALETTE.stoneLight);

  const postGeo = new THREE.BoxGeometry(0.4, 3, 0.45);
  const postL = new THREE.Mesh(postGeo, frameMat);
  postL.position.set(-1.15, 1.5, 0);
  postL.castShadow = true;
  postL.receiveShadow = true;
  const postR = postL.clone();
  postR.position.x = 1.15;
  group.add(postL, postR);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.4, 0.45), frameMat);
  lintel.position.set(0, 3.05, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.12, 8, 24),
    new THREE.MeshStandardMaterial({ color: PALETTE.stoneDark, roughness: 0.8 }),
  );
  ring.position.y = 1.5;
  ring.castShadow = true;
  group.add(ring);

  const veil = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  veil.position.y = 1.5;
  group.add(veil);

  return group;
}

export function createTreasureItem(): THREE.Group {
  const group = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color: PALETTE.loot, emissive: new THREE.Color(PALETTE.loot), emissiveIntensity: 0.5, roughness: 0.4 }),
  );
  gem.position.y = 0.9;
  gem.castShadow = true;
  group.add(gem);
  return group;
}

export function createTelegraphIndicator(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.32, 4),
    new THREE.MeshStandardMaterial({
      color: '#ff3b1f',
      emissive: new THREE.Color('#ff3b1f'),
      emissiveIntensity: 1.4,
      roughness: 0.4,
    }),
  );
  mesh.position.y = 2.3;
  mesh.rotation.y = Math.PI / 4;
  mesh.visible = false;
  return mesh;
}

/** Ground-level facing indicator: a ring around the feet with an arrowhead
 * pointing local +Z (the character's forward). Replaces relying on body
 * asymmetry alone to show which way a symmetric low-poly figure is facing. */
export function createFacingMarker(color: string): THREE.Group {
  const group = new THREE.Group();
  const baseMat = { color, emissive: new THREE.Color(color), emissiveIntensity: 0.5, transparent: true, side: THREE.DoubleSide };
  const ringMat = new THREE.MeshStandardMaterial({ ...baseMat, opacity: 0.42 }); // 0.6 - 30%
  const arrowMat = new THREE.MeshStandardMaterial({ ...baseMat, opacity: 0.6 });

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.54, 20), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 3), arrowMat);
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.02, 0.63);
  group.add(arrow);

  return group;
}

// ---------- player/enemy character rig ----------
// Proportions are fractions of a fixed reference height H ≈ 1.80-1.81 (see
// the character-quality plan, iteration 2). Iteration 1 fixed gross
// proportions (head/shoulder size) but the torso was still a single tapered
// cylinder — a smooth taper still reads as "a vertical tube" no matter how
// it's shaped, and there was no pelvis at all, so the legs ran straight into
// the torso. This pass adds real STRUCTURE: a distinct pelvis between the
// legs and waist, and a distinct shoulder "yoke" segment between the chest
// and the arms, so the body gets genuine width step-changes at each
// anatomical seam (pelvis→waist narrows, waist→chest widens, chest→yoke
// flares to the shoulder line) instead of one continuous taper.
const BOOT_H = 0.22;
const LEG_H = 0.42;
const PELVIS_H = 0.2;
const WAIST_H = 0.1;
const TORSO_H = 0.46;
const YOKE_H = 0.14;
const NECK_H = 0.06;
const HEAD_D = 0.31;
const HEAD_R = HEAD_D / 2;

const BOOT_Y = BOOT_H / 2;
const LEG_Y = BOOT_H + LEG_H / 2;
const PELVIS_Y = BOOT_H + LEG_H + PELVIS_H / 2;
const BELT_Y = BOOT_H + LEG_H + PELVIS_H;
const WAIST_Y = BOOT_H + LEG_H + PELVIS_H + WAIST_H / 2;
const TORSO_Y = BOOT_H + LEG_H + PELVIS_H + WAIST_H + TORSO_H / 2;
const YOKE_Y = BOOT_H + LEG_H + PELVIS_H + WAIST_H + TORSO_H + YOKE_H / 2;
const NECK_Y = BOOT_H + LEG_H + PELVIS_H + WAIST_H + TORSO_H + YOKE_H + NECK_H / 2;
const HEAD_Y = BOOT_H + LEG_H + PELVIS_H + WAIST_H + TORSO_H + YOKE_H + NECK_H + HEAD_R;
const SHOULDER_Y = BOOT_H + LEG_H + PELVIS_H + WAIST_H + TORSO_H + YOKE_H;
const SHOULDER_X = 0.28;
/** Half-gap between the two legs' own centerlines — the previous prototype
 * fused both legs into a single box, which read as a pedestal rather than a
 * pair of legs from any camera angle. */
const LEG_X = 0.14;

/** Darkens/lightens a hex color by a linear-space factor — used so parts that
 * don't take their own color parameter (e.g. the waist/hip flare) still
 * harmonize with whatever `bodyColor` a given character/enemy type uses,
 * instead of a hardcoded tone that would clash with some of them. */
function shade(hex: string, factor: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(factor).getHexString()}`;
}

export const UPPER_ARM_LEN = 0.3;
export const FOREARM_LEN = 0.24;
/** Upper-arm rest lean (rad, about local X) — a slight forward hang from the shoulder. */
export const SHOULDER_LEAN = -0.312;
/** Forearm's local rotation at rest, relative to its shoulder parent — combines with
 * SHOULDER_LEAN to reach a world lean of ~-43.5° (elbow bend ~25.6°), putting the
 * hand ~43% up the body and clear of the torso's silhouette. */
export const ELBOW_BEND_REST = -0.447;
/** Elbow rotation range during an attack swing — the whole forearm (and whatever is
 * mounted at the hand) sweeps together, rather than only the weapon pivoting in place. */
export const ELBOW_SWING_START = ELBOW_BEND_REST - 1.5;
export const ELBOW_SWING_END = ELBOW_BEND_REST + 1.3;
/** Weapon's own grip angle at the hand socket, layered on top of the arm's rest pose.
 * First-pass value — confirmed visually, not purely analytically, since it depends on
 * Three.js's rotation-composition sign along this hierarchy. */
export const WEAPON_LOCAL_REST_ROTATION = 1.81;
/** Cancels the arm chain's accumulated rest lean, so something mounted at a hand
 * (e.g. a shield) hangs upright instead of tilted along with the arm. */
export const HAND_UPRIGHT_ROTATION = -(SHOULDER_LEAN + ELBOW_BEND_REST);

/** Lateral clearance (world/character X) of the forearm-mount anchor beyond the
 * forearm's own centerline — half the forearm's cross-section (0.08) + half the
 * shield's thickness (0.04) + a small gap (0.02), so a shield strapped there sits
 * flush against the arm's outer side without clipping through the bone mesh. */
const FOREARM_MOUNT_LATERAL = 0.14;

export interface CharacterRig {
  group: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rightHand: THREE.Group;
  leftHand: THREE.Group;
  rightForearmMount: THREE.Group;
  leftForearmMount: THREE.Group;
  /** Empty anchors for future equipment, additive to the joints above — see
   * the character-quality plan's socket table. Zero render cost (no geometry). */
  headSocket: THREE.Group;
  torsoSocket: THREE.Group;
  backSocket: THREE.Group;
  waistSocket: THREE.Group;
  feetSocket: THREE.Group;
}

/** Side-count choices below aren't uniform on purpose: a regular n-gon prism's
 * silhouette width swings between a face-on and corner-on camera view by a
 * factor of 1/cos(pi/n) as the (free-rotating, isometric) camera yaws around
 * it — 41% for a 4-sided box, 15% for 6 sides, 8% for 8 sides. Small parts
 * (forearm/upper-arm/neck/shoulder cap) use 6 sides since the remaining wobble
 * beyond that is usually sub-pixel at gameplay camera distance anyway; larger,
 * more central parts (torso/waist/thigh) use 8 since they're big enough on
 * screen for the extra facets to actually read, and the head uses an
 * icosahedron (no UV-sphere pole pinching at any yaw angle at all). */
function buildArm(side: 1 | -1, armMat: THREE.MeshStandardMaterial, skinMat: THREE.MeshStandardMaterial) {
  const shoulder = new THREE.Group();
  shoulder.position.set(SHOULDER_X * side, SHOULDER_Y, 0);
  shoulder.rotation.x = SHOULDER_LEAN;

  // Sized to nest against the yoke's own rim (0.30 top radius, see
  // createCharacterMesh) instead of floating as a disc balanced on the arm.
  const shoulderCapGeo = sharedGeo('shoulder-cap-6', () => new THREE.CylinderGeometry(0.17, 0.14, 0.1, 6));
  const shoulderCap = new THREE.Mesh(shoulderCapGeo, armMat);
  shoulderCap.position.y = 0.01;
  shoulderCap.castShadow = true;
  shoulder.add(shoulderCap);

  // Noticeably thicker than iteration 1 ("el diámetro debe ser
  // considerablemente mayor") and tapered upper-arm-thick → wrist-thin across
  // the whole 2-bone chain, not just within one segment.
  const upperArmGeo = sharedGeo('limb-upperArm-6', () => new THREE.CylinderGeometry(0.13, 0.115, UPPER_ARM_LEN, 6));
  const upperArm = new THREE.Mesh(upperArmGeo, armMat);
  upperArm.position.y = -UPPER_ARM_LEN / 2;
  upperArm.castShadow = true;
  shoulder.add(upperArm);

  const elbow = new THREE.Group();
  elbow.position.y = -UPPER_ARM_LEN;
  elbow.rotation.x = ELBOW_BEND_REST;
  shoulder.add(elbow);

  const forearmGeo = sharedGeo('limb-forearm-6', () => new THREE.CylinderGeometry(0.115, 0.09, FOREARM_LEN, 6));
  const forearm = new THREE.Mesh(forearmGeo, armMat);
  forearm.position.y = -FOREARM_LEN / 2;
  forearm.castShadow = true;
  elbow.add(forearm);

  const hand = new THREE.Group();
  hand.position.y = -FOREARM_LEN;
  elbow.add(hand);

  // A small fist volume so an empty hand (no weapon/shield equipped) still
  // reads as a hand instead of the limb just stopping in mid-air.
  const handGeo = sharedGeo('hand-6', () => new THREE.CylinderGeometry(0.075, 0.065, 0.11, 6));
  const handMesh = new THREE.Mesh(handGeo, skinMat);
  handMesh.position.y = -0.055;
  handMesh.castShadow = true;
  hand.add(handMesh);

  // Anchor for something strapped to the forearm (e.g. a shield) rather than held
  // at the fingertips: midway along the bone, offset outward off its centerline.
  const forearmMount = new THREE.Group();
  forearmMount.position.set(FOREARM_MOUNT_LATERAL * side, -FOREARM_LEN / 2, 0);
  elbow.add(forearmMount);

  return { shoulder, elbow, hand, forearmMount };
}

/** Builds the shared low-poly body. Geometry is deduped across every character
 * instance via `sharedGeo` (safe — never mutated at runtime); materials are
 * still created fresh per call but deduped *within* this one character's own
 * parts (e.g. one `armMat` for both arms' 6 meshes) — NOT shared across
 * characters, because `Entity.triggerFlash` mutates `material.emissive`
 * directly on whatever it finds by traversing one entity's own group, and a
 * cross-instance-shared material would make every character sharing it flash
 * together. See the character-quality plan for the full reasoning. */
export function createCharacterMesh(bodyColor: string, accentColor: string): CharacterRig {
  const group = new THREE.Group();

  const skinMat = stdMat('#c9a882');
  const legMat = stdMat('#2a2320');
  const bootMat = stdMat('#4a3320');
  const darkMat = stdMat('#2b1a0d'); // belt + eyes — same dark leather/shadow tone, one fewer unique material
  const lowerMat = stdMat(shade(bodyColor, 0.7)); // pelvis + waist — one shared "under-tunic" tone
  const torsoMat = stdMat(bodyColor); // chest + shoulder yoke — same cloth, continuous across that seam
  const armMat = stdMat(accentColor);

  // Thigh-wide → ankle-narrow (was accidentally inverted in iteration 1 —
  // "W_thigh > W_calf > W_ankle" is the whole point of a leg silhouette).
  const legGeo = sharedGeo('leg-6', () => new THREE.CylinderGeometry(0.15, 0.105, LEG_H, 6));
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-LEG_X, LEG_Y, 0);
  legL.castShadow = true;
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(LEG_X, LEG_Y, 0);
  legR.castShadow = true;

  // Offset forward (+Z, the facing-marker's "forward") instead of centered,
  // so the foot actually projects ahead of the ankle instead of just being a
  // symmetric bulge around it.
  const bootGeo = sharedGeo('boot-6', () => new THREE.CylinderGeometry(0.14, 0.12, BOOT_H, 6));
  const bootL = new THREE.Mesh(bootGeo, bootMat);
  bootL.position.set(-LEG_X, BOOT_Y, 0.04);
  bootL.scale.z = 1.1;
  bootL.castShadow = true;
  const bootR = new THREE.Mesh(bootGeo, bootMat);
  bootR.position.set(LEG_X, BOOT_Y, 0.04);
  bootR.scale.z = 1.1;
  bootR.castShadow = true;

  // Pelvis: a real mass between the legs and the waist (iteration 1 had the
  // legs run straight into a single hip-flare piece with no pelvis at all).
  // Widest low-body volume — the two legs emerge from underneath it, and the
  // waist above it pinches in, so the pelvis→waist seam reads as a visible
  // step rather than a continuous taper.
  const pelvisGeo = sharedGeo('pelvis-8', () => new THREE.CylinderGeometry(0.21, 0.17, PELVIS_H, 8));
  const pelvis = new THREE.Mesh(pelvisGeo, lowerMat);
  pelvis.position.y = PELVIS_Y;
  pelvis.scale.z = 0.85;
  pelvis.castShadow = true;

  const beltGeo = sharedGeo('belt-8', () => new THREE.CylinderGeometry(0.205, 0.205, 0.06, 8));
  const belt = new THREE.Mesh(beltGeo, darkMat);
  belt.position.y = BELT_Y;
  belt.scale.z = 0.85;
  belt.castShadow = true;

  // Waist: deliberately narrower than both the pelvis below and the chest
  // above (a cinch, not a midpoint average) so both seams show a step.
  const waistGeo = sharedGeo('waist-8', () => new THREE.CylinderGeometry(0.2, 0.195, WAIST_H, 8));
  const waist = new THREE.Mesh(waistGeo, lowerMat);
  waist.position.y = WAIST_Y;
  waist.scale.z = 0.8;
  waist.castShadow = true;

  // Chest: wider than the waist below it (a visible step out), tapering up
  // toward the shoulder yoke rather than the yoke's job alone.
  const torsoGeo = sharedGeo('torso-chest-8', () => new THREE.CylinderGeometry(0.25, 0.22, TORSO_H, 8));
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = TORSO_Y;
  torso.scale.z = 0.75; // oval cross-section: chest reads wider than deep
  torso.castShadow = true;

  // Shoulder yoke: the torso->shoulder transition the reference needs and
  // iteration 1 didn't have — without this, the shoulder caps read as discs
  // balanced on top of the arms instead of a continuation of the torso mass.
  const yokeGeo = sharedGeo('shoulder-yoke-8', () => new THREE.CylinderGeometry(0.3, 0.25, YOKE_H, 8));
  const yoke = new THREE.Mesh(yokeGeo, torsoMat);
  yoke.position.y = YOKE_Y;
  yoke.scale.z = 0.8;
  yoke.castShadow = true;

  const neckGeo = sharedGeo('neck-6', () => new THREE.CylinderGeometry(0.09, 0.1, NECK_H, 6));
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = NECK_Y;
  neck.castShadow = true;

  // Low-poly humanoid head: a lathed profile (8 sides around, per the "8
  // lados" ask) instead of a sphere/icosahedron — a solid of revolution lets
  // the jaw/cheek/brow/forehead/crown each get their own radius, so the head
  // has real vertical structure instead of being uniformly round at every
  // height. Points run chin (near-point) -> jaw -> cheek -> brow (widest) ->
  // forehead -> crown (near-point).
  const headGeo = sharedGeo('head-lathe-8', () => {
    const r = HEAD_R;
    const pts = [
      new THREE.Vector2(0.06 * r, -1.0 * r),
      new THREE.Vector2(0.62 * r, -0.72 * r),
      new THREE.Vector2(0.82 * r, -0.32 * r),
      new THREE.Vector2(0.96 * r, 0.05 * r),
      new THREE.Vector2(0.74 * r, 0.45 * r),
      new THREE.Vector2(0.42 * r, 0.8 * r),
      new THREE.Vector2(0.03 * r, 1.0 * r),
    ];
    return new THREE.LatheGeometry(pts, 8);
  });
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = HEAD_Y;
  head.scale.z = 0.92; // slightly flatter front-to-back than cheek-to-cheek
  head.castShadow = true;

  const eyeGeo = sharedGeo('eye', () => new THREE.BoxGeometry(0.045, 0.035, 0.02));
  const eyeL = new THREE.Mesh(eyeGeo, darkMat);
  eyeL.position.set(-0.06, 0.05 * HEAD_R, HEAD_R * 0.88);
  const eyeR = new THREE.Mesh(eyeGeo, darkMat);
  eyeR.position.set(0.06, 0.05 * HEAD_R, HEAD_R * 0.88);
  head.add(eyeL, eyeR);

  const right = buildArm(1, armMat, skinMat);
  const left = buildArm(-1, armMat, skinMat);

  group.add(legL, legR, bootL, bootR, pelvis, belt, waist, torso, yoke, neck, head, right.shoulder, left.shoulder);

  const headSocket = new THREE.Group();
  headSocket.position.y = HEAD_Y;
  const torsoSocket = new THREE.Group();
  torsoSocket.position.y = TORSO_Y;
  const backSocket = new THREE.Group();
  backSocket.position.set(0, TORSO_Y, -0.25);
  const waistSocket = new THREE.Group();
  waistSocket.position.y = BELT_Y;
  const feetSocket = new THREE.Group();
  feetSocket.position.y = 0;
  group.add(headSocket, torsoSocket, backSocket, waistSocket, feetSocket);

  return {
    group,
    rightShoulder: right.shoulder,
    rightElbow: right.elbow,
    rightHand: right.hand,
    leftHand: left.hand,
    rightForearmMount: right.forearmMount,
    leftForearmMount: left.forearmMount,
    headSocket,
    torsoSocket,
    backSocket,
    waistSocket,
    feetSocket,
  };
}

/** Mounts a weapon at a hand anchor with the shared rest grip angle; returns the pivot
 * so callers can swap the inner mesh (e.g. on re-equip) without rebuilding the joint. */
export function mountWeapon(hand: THREE.Group, weaponMesh: THREE.Group): THREE.Group {
  const pivot = new THREE.Group();
  pivot.rotation.x = WEAPON_LOCAL_REST_ROTATION;
  pivot.add(weaponMesh);
  hand.add(pivot);
  return pivot;
}

export type WeaponVisual = 'dagger' | 'sword' | 'axe';

/** Builds the equipped weapon's mesh; `bladeColor` reflects the item's rarity tint. */
export function createWeaponMesh(kind: WeaponVisual = 'sword', bladeColor = '#c9c9c9'): THREE.Group {
  const group = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({
    color: bladeColor,
    emissive: new THREE.Color(bladeColor),
    emissiveIntensity: bladeColor === '#c9c9c9' ? 0 : 0.35,
    metalness: 0.6,
    roughness: 0.35,
  });

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 6), stdMat('#2b1a0d'));
  hilt.position.y = -0.14;
  hilt.castShadow = true;
  group.add(hilt);

  if (kind === 'dagger') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.025), bladeMat);
    blade.position.y = 0.22;
    blade.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), stdMat('#2b1a0d'));
    guard.castShadow = true;
    group.add(blade, guard);
  } else if (kind === 'axe') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), stdMat('#3d2817'));
    handle.position.y = 0.3;
    handle.castShadow = true;
    // A flat wedge reads as an axe-blade silhouette; the previous 4-sided
    // cone read as a spike instead — same triangle cost, right primitive.
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.05), bladeMat);
    head.position.set(0, 0.56, 0.1);
    head.castShadow = true;
    group.add(handle, head);
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.03), bladeMat);
    blade.position.y = 0.45;
    blade.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), stdMat('#2b1a0d'));
    guard.castShadow = true;
    group.add(blade, guard);
  }

  return group;
}

/** A round shield: a faceted disc (10 sides — matches the "8-12 sides, not a
 * smooth circle" ask) plus a small faceted boss, exported so it's a shared
 * shape any future Player/Enemy offhand can mount too, not just the
 * character-sheet viewport it replaces here. */
export function createShieldMesh(bodyColor: string, rimColor: string): THREE.Group {
  const group = new THREE.Group();

  const bodyGeo = sharedGeo('shield-disc-10', () => new THREE.CylinderGeometry(0.26, 0.26, 0.06, 10));
  const body = new THREE.Mesh(bodyGeo, stdMat(bodyColor));
  body.rotation.z = Math.PI / 2; // stand the disc on edge, flat face pointing sideways (worn on the forearm)
  body.castShadow = true;
  group.add(body);

  const bossGeo = sharedGeo('shield-boss', () => new THREE.OctahedronGeometry(0.07, 0));
  const boss = new THREE.Mesh(bossGeo, stdMat(rimColor, { metalness: 0.5, roughness: 0.4 }));
  boss.position.x = 0.035;
  boss.castShadow = true;
  group.add(boss);

  return group;
}

export function createProjectileMesh(color = PALETTE.danger): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.8 }),
  );
  mesh.castShadow = true;
  return mesh;
}
