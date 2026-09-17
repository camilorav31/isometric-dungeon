import * as THREE from 'three';

const BASE_INTENSITY = 1.4;
const FLICKER_AMOUNT = 0.35;

/** Layers two out-of-phase sine waves per light so a row of torches never pulses in lockstep. */
export function updateTorchFlicker(lights: THREE.PointLight[], elapsed: number) {
  for (let i = 0; i < lights.length; i++) {
    const phase = i * 12.9;
    const n = Math.sin(elapsed * 9 + phase) * 0.5 + Math.sin(elapsed * 23 + phase * 0.7) * 0.5;
    lights[i].intensity = BASE_INTENSITY + n * FLICKER_AMOUNT;
  }
}
