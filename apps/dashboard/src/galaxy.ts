// Сцена «Галактика»: Солнечная система — точка в центре, вокруг — пульсары
// из каталога на реальных координатах (RA/Dec + расстояние → декартовы).
// Каждый мигает в своём ритме, замедленном до видимой частоты.

import * as THREE from 'three';
import {
  LIGHT_YEARS_PER_KPC,
  frequencyAt,
  phaseAt,
  secondsSinceEpoch,
  raDecToCartesian,
  unixMsToMjd,
} from '@space/core';
import { PULSARS, type PulsarInfo } from '@space/data';

/** Масштаб галактической сцены: 1 юнит = 50 световых лет */
export const LY_PER_UNIT = 50;
/** Видимая частота мигания, Гц (ритм каждого пульсара замедлен до неё) */
const VISIBLE_HZ = 1.1;
const PULSAR_RADIUS = 3;

interface PulsarMesh {
  mesh: THREE.Mesh;
  halo: THREE.Mesh;
  pulsar: PulsarInfo;
  slowdown: number;
}

export class GalaxyView {
  readonly root = new THREE.Group();
  private readonly items: PulsarMesh[] = [];
  private readonly raycaster = new THREE.Raycaster();

  constructor(scene: THREE.Scene) {
    // Солнечная система, сжавшаяся в точку
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffd27d' }),
    );
    sun.name = '__sun__';
    this.root.add(sun);

    for (const p of PULSARS) {
      const distanceUnits = (p.distanceKpc * LIGHT_YEARS_PER_KPC) / LY_PER_UNIT;
      const pos = raDecToCartesian(p.raDeg, p.decDeg, distanceUnits);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(PULSAR_RADIUS, 16, 12),
        new THREE.MeshBasicMaterial({ color: '#bfe2ff', transparent: true }),
      );
      mesh.position.set(...pos);
      mesh.name = p.name;
      // Гало — прозрачная сфера побольше, дышит вместе с пульсаром
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(PULSAR_RADIUS * 2.2, 16, 12),
        new THREE.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.15 }),
      );
      mesh.add(halo);
      this.root.add(mesh);
      const freq = frequencyAt(p, secondsSinceEpoch(p, unixMsToMjd(Date.now())));
      this.items.push({ mesh, halo, pulsar: p, slowdown: Math.max(1, Math.ceil(freq / VISIBLE_HZ)) });
    }

    this.root.visible = false;
    scene.add(this.root);
  }

  /** Обновить мигание (вызывать каждый кадр, когда сцена видима) */
  update(): void {
    const nowMjd = unixMsToMjd(Date.now());
    for (const { mesh, halo, pulsar, slowdown } of this.items) {
      const phase = phaseAt(pulsar, secondsSinceEpoch(pulsar, nowMjd));
      const intensity = Math.exp(-((phase / slowdown) % 1) * 5);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * intensity;
      halo.scale.setScalar(0.7 + intensity);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.05 + 0.3 * intensity;
    }
  }

  /** Пульсар под курсором или null */
  pick(event: PointerEvent, camera: THREE.Camera, canvas: HTMLCanvasElement): PulsarInfo | null {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObjects(
      this.items.map((i) => i.mesh),
      true,
    );
    const name = hits[0]?.object.name || hits[0]?.object.parent?.name;
    return this.items.find((i) => i.pulsar.name === name)?.pulsar ?? null;
  }
}
