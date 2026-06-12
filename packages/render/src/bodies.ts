// Отображение набора тел: сферы с логарифмическим масштабом радиуса,
// следы орбит (кольцевой буфер точек), выбор тела кликом.

import * as THREE from 'three';

export interface RenderableBody {
  name: string;
  position: [number, number, number];
  radiusKm: number;
  color: string;
}

/**
 * Визуальный радиус в а.е. из реального радиуса в км — логарифмическая шкала,
 * иначе рядом с Солнцем планет просто не видно.
 */
export function visualRadius(radiusKm: number): number {
  return Math.max(0.015, 0.052 * (Math.log10(radiusKm) - 2.85));
}

const TRAIL_CAPACITY = 1200;
/** Минимальный сдвиг (а.е.), при котором добавляем точку в след */
const TRAIL_MIN_STEP = 0.003;

class Trail {
  readonly line: THREE.Line;
  private readonly positions = new Float32Array(TRAIL_CAPACITY * 3);
  private count = 0;
  private head = 0; // индекс следующей записи в кольцевом буфере
  private last: [number, number, number] | null = null;

  constructor(color: string) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
    this.line = new THREE.Line(geo, mat);
    this.line.frustumCulled = false;
  }

  push(p: [number, number, number]): void {
    if (this.last) {
      const d = Math.hypot(p[0] - this.last[0], p[1] - this.last[1], p[2] - this.last[2]);
      if (d < TRAIL_MIN_STEP) return;
    }
    this.last = [...p];
    this.positions.set(p, this.head * 3);
    this.head = (this.head + 1) % TRAIL_CAPACITY;
    this.count = Math.min(this.count + 1, TRAIL_CAPACITY);
    // Перекладываем кольцевой буфер в непрерывный порядок для отрисовки линией
    const geo = this.line.geometry;
    const attr = geo.getAttribute('position') as THREE.BufferAttribute;
    const ordered = new Float32Array(this.count * 3);
    const start = (this.head - this.count + TRAIL_CAPACITY) % TRAIL_CAPACITY;
    for (let i = 0; i < this.count; i++) {
      const src = ((start + i) % TRAIL_CAPACITY) * 3;
      ordered[i * 3] = this.positions[src]!;
      ordered[i * 3 + 1] = this.positions[src + 1]!;
      ordered[i * 3 + 2] = this.positions[src + 2]!;
    }
    (attr.array as Float32Array).set(ordered);
    attr.needsUpdate = true;
    geo.setDrawRange(0, this.count);
  }

  clear(): void {
    this.count = 0;
    this.head = 0;
    this.last = null;
    this.line.geometry.setDrawRange(0, 0);
  }
}

export class BodiesView {
  /** Корневая группа: всё отображение тел внутри — можно скрывать/масштабировать целиком */
  readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly trails = new Map<string, Trail>();
  private readonly raycaster = new THREE.Raycaster();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Привести отображение в соответствие списку тел (создать/удалить/подвинуть) */
  sync(bodies: RenderableBody[]): void {
    const alive = new Set(bodies.map((b) => b.name));
    for (const [name, mesh] of this.meshes) {
      if (!alive.has(name)) {
        this.root.remove(mesh);
        const trail = this.trails.get(name)!;
        this.root.remove(trail.line);
        this.meshes.delete(name);
        this.trails.delete(name);
      }
    }
    for (const b of bodies) {
      let mesh = this.meshes.get(b.name);
      if (!mesh) {
        const r = visualRadius(b.radiusKm);
        const isSun = b.name === 'Солнце';
        const mat = isSun
          ? new THREE.MeshBasicMaterial({ color: b.color })
          : new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
        mesh.name = b.name;
        this.root.add(mesh);
        const trail = new Trail(b.color);
        this.root.add(trail.line);
        this.meshes.set(b.name, mesh);
        this.trails.set(b.name, trail);
      }
      mesh.position.set(...b.position);
      this.trails.get(b.name)!.push(b.position);
    }
  }

  /** Подсветить тело (например, улетающее из системы) */
  setHighlight(name: string, on: boolean): void {
    const mesh = this.meshes.get(name);
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.emissive) mat.emissive.set(on ? 0xff3333 : 0x000000);
  }

  clearTrails(): void {
    for (const t of this.trails.values()) t.clear();
  }

  /** Имя тела под курсором или null */
  pick(event: PointerEvent, camera: THREE.Camera, canvas: HTMLCanvasElement): string | null {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, camera);
    // Увеличенный порог попадания, чтобы в мелкие планеты можно было попасть
    this.raycaster.params.Points = { threshold: 0.1 };
    const hits = this.raycaster.intersectObjects([...this.meshes.values()], false);
    return hits[0]?.object.name ?? null;
  }
}
