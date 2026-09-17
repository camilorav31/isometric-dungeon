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

export function createDoorBlocker(width: number, height: number, depth: number): THREE.Mesh {
  const mesh = createWallSegment(width, height, depth, PALETTE.danger);
  (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x330606);
  return mesh;
}

export function createTorch(): THREE.Group {
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
  return group;
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

export function createPortal(color = PALETTE.loot): THREE.Group {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.15, 8, 24),
    new THREE.MeshStandardMaterial({ color: PALETTE.stoneLight, roughness: 0.8 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.1;
  ring.castShadow = true;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 24),
    new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.6, side: THREE.DoubleSide }),
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 1.1;
  group.add(ring, disc);
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

export function createCharacterMesh(bodyColor: string, accentColor: string): THREE.Group {
  const group = new THREE.Group();

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.35), stdMat('#2a2320'));
  legs.position.y = 0.3;
  legs.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.4), stdMat(bodyColor));
  torso.position.y = 0.95;
  torso.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), stdMat('#c9a882'));
  head.position.y = 1.5;
  head.castShadow = true;

  // Nose/face marker so facing direction is visible on a symmetric placeholder body.
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), stdMat(accentColor));
  face.position.set(0, 1.5, 0.3);
  face.castShadow = true;

  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), stdMat(accentColor));
  shoulderL.position.set(-0.42, 0.95, 0);
  shoulderL.castShadow = true;
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.42;

  group.add(legs, torso, head, face, shoulderL, shoulderR);
  return group;
}

export function createSwordMesh(): THREE.Group {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.75, 0.03),
    new THREE.MeshStandardMaterial({ color: '#c9c9c9', metalness: 0.6, roughness: 0.35 }),
  );
  blade.position.y = 0.45;
  blade.castShadow = true;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), stdMat('#2b1a0d'));
  guard.castShadow = true;
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 6), stdMat('#2b1a0d'));
  hilt.position.y = -0.14;
  hilt.castShadow = true;
  group.add(blade, guard, hilt);
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
