// Отображение набора тел: сферы с логарифмическим масштабом радиуса,
// следы орбит (кольцевой буфер точек), выбор тела кликом.

import * as THREE from 'three';

export interface RenderableBody {
  name: string;
  position: [number, number, number];
  radiusKm: number;
  color: string;
  /** Масса (М☉): следы рисуются относительно самого массивного тела — иначе
   *  при дрейфе системы (пролёт звезды, добавленное тело) орбиты в мировых
   *  координатах размазываются в широкие «полосы» из петель */
  mass?: number;
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
  // Длина сегмента от предыдущей точки к точке i (у хвостовой точки не учитывается)
  private readonly segLens = new Float32Array(TRAIL_CAPACITY);
  private totalLen = 0;
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
    let d = 0;
    if (this.last) {
      d = Math.hypot(p[0] - this.last[0], p[1] - this.last[1], p[2] - this.last[2]);
      if (d < TRAIL_MIN_STEP) return;
      // Слишком большой скачок за кадр (высокая скорость времени): соединять
      // точки хордой бессмысленно — обрываем след и начинаем заново,
      // иначе орбиты зарастают «паутиной» линий через всю систему.
      const maxSegment = Math.min(5, Math.max(0.08, 0.25 * Math.hypot(...p)));
      if (d > maxSegment) {
        this.clear();
        d = 0;
      }
    }
    this.last = [...p];
    if (this.count === TRAIL_CAPACITY) {
      // Перезаписываем самую старую точку — её сегмент уходит из суммы
      this.totalLen -= this.segLens[(this.head + 1) % TRAIL_CAPACITY]!;
    }
    this.segLens[this.head] = d;
    this.totalLen += d;
    this.positions.set(p, this.head * 3);
    this.head = (this.head + 1) % TRAIL_CAPACITY;
    this.count = Math.min(this.count + 1, TRAIL_CAPACITY);
    // След не длиннее ~одного оборота, иначе слегка расходящиеся витки
    // накладываются друг на друга и орбита зарисовывается сплошной «полосой»
    const maxLen = 0.92 * 2 * Math.PI * Math.hypot(...p);
    while (this.count > 2 && this.totalLen > maxLen) {
      const tail = (this.head - this.count + TRAIL_CAPACITY) % TRAIL_CAPACITY;
      this.totalLen -= this.segLens[(tail + 1) % TRAIL_CAPACITY]!;
      this.count--;
    }
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
    this.totalLen = 0;
    this.last = null;
    this.line.geometry.setDrawRange(0, 0);
  }
}

export class BodiesView {
  /** Корневая группа: всё отображение тел внутри — можно скрывать/масштабировать целиком */
  readonly root = new THREE.Group();
  /** Контейнер DOM-подписей тел (если передан labelsHost) */
  readonly labelsRoot: HTMLElement | null = null;
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly trails = new Map<string, Trail>();
  private readonly labels = new Map<string, HTMLElement>();
  private readonly raycaster = new THREE.Raycaster();
  private anchorName: string | null = null;

  constructor(scene: THREE.Scene, labelsHost?: HTMLElement) {
    scene.add(this.root);
    if (labelsHost) {
      this.labelsRoot = document.createElement('div');
      this.labelsRoot.className = 'body-labels';
      labelsHost.appendChild(this.labelsRoot);
    }
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
        this.labels.get(name)?.remove();
        this.labels.delete(name);
      }
    }
    // Якорь следов — самое массивное тело (обычно Солнце). Если якорь сменился
    // (Солнце удалили), старые следы в чужой системе отсчёта не имеют смысла.
    const anchor = bodies.reduce(
      (a, b) => ((b.mass ?? 0) > (a?.mass ?? -1) ? b : a),
      undefined as RenderableBody | undefined,
    );
    if ((anchor?.name ?? null) !== this.anchorName) {
      this.anchorName = anchor?.name ?? null;
      this.clearTrails();
    }
    const ax = anchor?.position[0] ?? 0;
    const ay = anchor?.position[1] ?? 0;
    const az = anchor?.position[2] ?? 0;
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
        if (this.labelsRoot) {
          const label = document.createElement('button');
          label.className = 'body-label';
          label.dataset.name = b.name;
          label.textContent = b.name;
          label.style.color = b.color;
          this.labelsRoot.appendChild(label);
          this.labels.set(b.name, label);
        }
      }
      mesh.userData.mass = b.mass ?? 0;
      mesh.position.set(...b.position);
      const trail = this.trails.get(b.name)!;
      trail.line.position.set(ax, ay, az);
      trail.push([b.position[0] - ax, b.position[1] - ay, b.position[2] - az]);
    }
  }

  /** Разместить DOM-подписи над телами (вызывать каждый кадр после sync) */
  updateLabels(camera: THREE.Camera, canvas: HTMLCanvasElement): void {
    if (!this.labelsRoot) return;
    const show = this.root.visible && this.root.scale.x > 0.5;
    this.labelsRoot.style.display = show ? '' : 'none';
    if (!show) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const v = new THREE.Vector3();
    // Размещаем от массивных к лёгким: спутник, налезающий на подпись
    // планеты (Луна у Земли при отдалении), прячем
    const placed: Array<[number, number]> = [];
    const entries = [...this.meshes.values()].sort(
      (a, b) => (b.userData.mass as number) - (a.userData.mass as number),
    );
    for (const mesh of entries) {
      const label = this.labels.get(mesh.name);
      if (!label) continue;
      mesh.getWorldPosition(v).project(camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      const offscreen = v.z > 1 || x < 0 || x > w || y < 0 || y > h;
      const crowded = placed.some(([px, py]) => Math.hypot(px - x, py - y) < 34);
      if (offscreen || crowded) {
        label.style.display = 'none';
        continue;
      }
      placed.push([x, y]);
      label.style.display = '';
      label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
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
