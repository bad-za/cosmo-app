// Оскулирующие орбитальные элементы тела относительно центрального тела.
// Считаются из текущего вектора состояния (r, v) в задаче двух тел.

import { G } from '../units';
import type { Body } from './types';

export interface OrbitalElements {
  /** Большая полуось, а.е. (отрицательная для гиперболической орбиты) */
  semiMajorAxis: number;
  /** Эксцентриситет: 0 — круг, <1 — эллипс, ≥1 — тело покидает систему */
  eccentricity: number;
  /** Удельная орбитальная энергия, а.е.²/год² (положительная — несвязанная орбита) */
  specificEnergy: number;
  /** true, если орбита гиперболическая/параболическая — тело уходит навсегда */
  unbound: boolean;
  /** Период обращения, годы (Infinity для несвязанных орбит) */
  periodYears: number;
}

export function orbitalElements(body: Body, primary: Body): OrbitalElements {
  const mu = G * (primary.mass + body.mass);
  const rx = body.position[0] - primary.position[0];
  const ry = body.position[1] - primary.position[1];
  const rz = body.position[2] - primary.position[2];
  const vx = body.velocity[0] - primary.velocity[0];
  const vy = body.velocity[1] - primary.velocity[1];
  const vz = body.velocity[2] - primary.velocity[2];

  const r = Math.hypot(rx, ry, rz);
  const v2 = vx * vx + vy * vy + vz * vz;
  const specificEnergy = v2 / 2 - mu / r;

  // Вектор эксцентриситета: e = ((v² − μ/r)·r − (r·v)·v) / μ
  const rv = rx * vx + ry * vy + rz * vz;
  const k = v2 - mu / r;
  const ex = (k * rx - rv * vx) / mu;
  const ey = (k * ry - rv * vy) / mu;
  const ez = (k * rz - rv * vz) / mu;
  const eccentricity = Math.hypot(ex, ey, ez);

  const semiMajorAxis = -mu / (2 * specificEnergy);
  const unbound = specificEnergy >= 0 || eccentricity >= 1;
  const periodYears = unbound ? Infinity : 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / mu);

  return { semiMajorAxis, eccentricity, specificEnergy, unbound, periodYears };
}
