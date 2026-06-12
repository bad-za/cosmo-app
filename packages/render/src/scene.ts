// Базовая Three.js-сцена: камера, рендерер, орбит-контролы, звёздный фон, свет.
// Используется симулятором и (позже) дашбордом.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SpaceScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private frameCallbacks: Array<(dtSec: number) => void> = [];
  private lastTime = 0;
  private running = true;

  constructor(container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, 1, 1e-4, 5e4);
    this.camera.position.set(0, -14, 9);
    this.camera.up.set(0, 0, 1); // ось Z — «север эклиптики»

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.02;
    this.controls.maxDistance = 2e4;

    this.scene.add(makeStarfield());
    // Солнце светит из центра; ambient — чтобы тени не были чёрными
    this.scene.add(new THREE.PointLight(0xfff2d4, 2.2, 0, 0));
    this.scene.add(new THREE.AmbientLight(0x404860, 1.2));

    const resize = (): void => {
      const { clientWidth, clientHeight } = container;
      this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(clientWidth, clientHeight);
    };
    new ResizeObserver(resize).observe(container);
    resize();

    const loop = (t: number): void => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = this.lastTime ? (t - this.lastTime) / 1000 : 0.016;
      this.lastTime = t;
      for (const cb of this.frameCallbacks) cb(Math.min(dt, 0.1));
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  onFrame(cb: (dtSec: number) => void): void {
    this.frameCallbacks.push(cb);
  }

  dispose(): void {
    this.running = false;
    this.renderer.dispose();
  }
}

/** Сфера из случайных звёзд-точек вокруг сцены */
export function makeStarfield(count = 3000, radius = 2e3): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Равномерно по сфере, с разбросом по глубине
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = radius * (0.6 + Math.random() * 0.4);
    positions[i * 3] = r * s * Math.cos(phi);
    positions[i * 3 + 1] = r * s * Math.sin(phi);
    positions[i * 3 + 2] = r * u;
    const brightness = 0.3 + Math.random() * 0.7;
    const warm = Math.random() * 0.15;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness * (1 - warm * 0.3);
    colors[i * 3 + 2] = brightness * (1 - warm);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true });
  return new THREE.Points(geo, mat);
}
