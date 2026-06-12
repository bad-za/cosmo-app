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

  /** Точка клика, спроецированная на плоскость эклиптики (z = 0), или null */
  pointOnEcliptic(event: PointerEvent): [number, number, number] | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    return raycaster.ray.intersectPlane(plane, hit) ? [hit.x, hit.y, hit.z] : null;
  }

  dispose(): void {
    this.running = false;
    this.renderer.dispose();
  }
}

/** Мягкая круглая «звезда» для PointsMaterial вместо квадратного пикселя */
function starTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Случайные позиции по сфере с разбросом по глубине + цвета звёзд */
function scatterStars(count: number, radius: number, dim: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = radius * (0.6 + Math.random() * 0.4);
    positions[i * 3] = r * s * Math.cos(phi);
    positions[i * 3 + 1] = r * s * Math.sin(phi);
    positions[i * 3 + 2] = r * u;
    const brightness = (0.35 + Math.random() * 0.65) * dim;
    // Немного тёплых и холодных звёзд для живости
    const tint = Math.random();
    const warm = tint < 0.2 ? 0.25 : 0;
    const cool = tint > 0.85 ? 0.2 : 0;
    colors[i * 3] = brightness * (1 - cool * 0.5);
    colors[i * 3 + 1] = brightness * (1 - warm * 0.25 - cool * 0.2);
    colors[i * 3 + 2] = brightness * (1 - warm * 0.6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Звёздное небо: три слоя круглых звёзд разного размера (даёт глубину)
 * и тусклая полоса «Млечного Пути» — без неё фон выглядит плоской решёткой.
 */
export function makeStarfield(count = 4200, radius = 2e3): THREE.Group {
  const group = new THREE.Group();
  const tex = starTexture();
  const baseMat = (size: number, opacity: number): THREE.PointsMaterial =>
    new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
  // Слои: много мелких тусклых, средние, несколько ярких
  const layers: Array<[number, number, number]> = [
    [Math.round(count * 0.68), 1.7, 0.75],
    [Math.round(count * 0.26), 3.0, 0.9],
    [Math.round(count * 0.06), 5.2, 1],
  ];
  for (const [n, size, opacity] of layers) {
    const pts = new THREE.Points(scatterStars(n, radius, 1), baseMat(size, opacity));
    pts.frustumCulled = false;
    group.add(pts);
  }
  // Млечный Путь: плотная полоса тусклых звёзд вдоль наклонённой плоскости
  const bandCount = Math.round(count * 0.9);
  const positions = new Float32Array(bandCount * 3);
  const colors = new Float32Array(bandCount * 3);
  for (let i = 0; i < bandCount; i++) {
    const phi = Math.random() * Math.PI * 2;
    // Гауссов разброс поперёк полосы
    const g1 = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const r = radius * (0.7 + Math.random() * 0.3);
    positions[i * 3] = r * Math.cos(phi);
    positions[i * 3 + 1] = r * Math.sin(phi);
    positions[i * 3 + 2] = r * g1 * 0.12;
    const b = 0.25 + Math.random() * 0.45;
    colors[i * 3] = b * 0.85;
    colors[i * 3 + 1] = b * 0.9;
    colors[i * 3 + 2] = b;
  }
  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  bandGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const band = new THREE.Points(bandGeo, baseMat(1.6, 0.5));
  band.frustumCulled = false;
  band.rotation.set(1.1, 0.25, 0.4); // наклон полосы, как у Млечного Пути с Земли
  group.add(band);
  return group;
}
