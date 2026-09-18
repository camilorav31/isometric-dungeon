import * as THREE from 'three';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14161c');
  scene.fog = new THREE.Fog('#14161c', 26, 85);
  return scene;
}

export function addLighting(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight('#3c4658', 0.85);
  scene.add(ambient);

  const fill = new THREE.HemisphereLight('#4a5a75', '#151312', 0.5);
  scene.add(fill);

  const moonLight = new THREE.DirectionalLight('#a8bede', 1.4);
  moonLight.position.set(-15, 25, -10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -30;
  moonLight.shadow.camera.right = 30;
  moonLight.shadow.camera.top = 30;
  moonLight.shadow.camera.bottom = -30;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 80;
  moonLight.shadow.bias = -0.001;
  scene.add(moonLight);
  scene.add(moonLight.target);

  return { ambient, fill, moonLight };
}
