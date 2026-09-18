import * as THREE from 'three';

export const PALETTE = {
  stoneLight: '#4a4a4a',
  stoneDark: '#2a2a2a',
  wood: '#3d2817',
  danger: '#8b2020',
  loot: '#2d6b3d',
};

function stdMat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...opts });
}

export function createFloor(width: number, depth: number, color = PALETTE.stoneDark): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = stdMat(color, { roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
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
// Proportions are fractions of a fixed reference height H = 1.80: legs 33.3%,
// torso 37.8%, neck 2.2%, head 26.7% (see the character-design plan). The arm
// is a 2-segment chain (upper arm + forearm) hanging from a shoulder pivot at
// the TOP of the torso, verified by direct kinematics so the hand socket
// clears the torso's silhouette instead of sitting inside it as it used to.
const LEG_H = 0.6;
const TORSO_H = 0.68;
const NECK_H = 0.04;
const HEAD_D = 0.48;
const HEAD_R = HEAD_D / 2;

const TORSO_Y = LEG_H + TORSO_H / 2; // 0.94
const NECK_Y = LEG_H + TORSO_H + NECK_H / 2; // 1.30
const HEAD_Y = LEG_H + TORSO_H + NECK_H + HEAD_R; // 1.56
const SHOULDER_Y = LEG_H + TORSO_H; // 1.28
const SHOULDER_X = 0.42;

export const UPPER_ARM_LEN = 0.33;
export const FOREARM_LEN = 0.26;
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
}

function buildArm(side: 1 | -1, accentColor: string) {
  const shoulder = new THREE.Group();
  shoulder.position.set(SHOULDER_X * side, SHOULDER_Y, 0);
  shoulder.rotation.x = SHOULDER_LEAN;

  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, UPPER_ARM_LEN, 0.18), stdMat(accentColor));
  upperArm.position.y = -UPPER_ARM_LEN / 2;
  upperArm.castShadow = true;
  shoulder.add(upperArm);

  const elbow = new THREE.Group();
  elbow.position.y = -UPPER_ARM_LEN;
  elbow.rotation.x = ELBOW_BEND_REST;
  shoulder.add(elbow);

  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, FOREARM_LEN, 0.16), stdMat(accentColor));
  forearm.position.y = -FOREARM_LEN / 2;
  forearm.castShadow = true;
  elbow.add(forearm);

  const hand = new THREE.Group();
  hand.position.y = -FOREARM_LEN;
  elbow.add(hand);

  // Anchor for something strapped to the forearm (e.g. a shield) rather than held
  // at the fingertips: midway along the bone, offset outward off its centerline.
  const forearmMount = new THREE.Group();
  forearmMount.position.set(FOREARM_MOUNT_LATERAL * side, -FOREARM_LEN / 2, 0);
  elbow.add(forearmMount);

  return { shoulder, elbow, hand, forearmMount };
}

export function createCharacterMesh(bodyColor: string, accentColor: string): CharacterRig {
  const group = new THREE.Group();

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, LEG_H, 0.35), stdMat('#2a2320'));
  legs.position.y = LEG_H / 2;
  legs.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, TORSO_H, 0.4), stdMat(bodyColor));
  torso.position.y = TORSO_Y;
  torso.castShadow = true;

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, NECK_H, 0.16), stdMat('#c9a882'));
  neck.position.y = NECK_Y;
  neck.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 8, 8), stdMat('#c9a882'));
  head.position.y = HEAD_Y;
  head.castShadow = true;

  const right = buildArm(1, accentColor);
  const left = buildArm(-1, accentColor);

  group.add(legs, torso, neck, head, right.shoulder, left.shoulder);
  return {
    group,
    rightShoulder: right.shoulder,
    rightElbow: right.elbow,
    rightHand: right.hand,
    leftHand: left.hand,
    rightForearmMount: right.forearmMount,
    leftForearmMount: left.forearmMount,
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
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 4), bladeMat);
    head.position.set(0, 0.58, 0);
    head.rotation.z = Math.PI / 2;
    head.rotation.y = Math.PI / 4;
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

export function createProjectileMesh(color = PALETTE.danger): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.8 }),
  );
  mesh.castShadow = true;
  return mesh;
}
