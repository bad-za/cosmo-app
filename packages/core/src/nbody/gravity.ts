// Попарная ньютоновская гравитация и интегралы движения.

import { G } from '../units';
import type { Body, Vec3 } from './types';

/**
 * Ускорения всех тел от взаимного притяжения, а.е./год².
 * softening — сглаживание ε (а.е.) против сингулярности при тесных сближениях:
 * знаменатель (r² + ε²)^{3/2}. Для тестов точности ε = 0.
 */
export function accelerations(bodies: Body[], softening = 0): Vec3[] {
  const n = bodies.length;
  const acc: Vec3[] = Array.from({ length: n }, () => [0, 0, 0]);
  const eps2 = softening * softening;
  for (let i = 0; i < n; i++) {
    const bi = bodies[i]!;
    for (let j = i + 1; j < n; j++) {
      const bj = bodies[j]!;
      const dx = bj.position[0] - bi.position[0];
      const dy = bj.position[1] - bi.position[1];
      const dz = bj.position[2] - bi.position[2];
      const r2 = dx * dx + dy * dy + dz * dz + eps2;
      const inv = 1 / (r2 * Math.sqrt(r2));
      // Ускорение i от j и j от i — третий закон Ньютона
      const fi = G * bj.mass * inv;
      const fj = G * bi.mass * inv;
      const ai = acc[i]!;
      const aj = acc[j]!;
      ai[0] += fi * dx;
      ai[1] += fi * dy;
      ai[2] += fi * dz;
      aj[0] -= fj * dx;
      aj[1] -= fj * dy;
      aj[2] -= fj * dz;
    }
  }
  return acc;
}

/** Полная энергия: кинетическая + потенциальная (в единицах M☉·а.е.²/год²) */
export function totalEnergy(bodies: Body[]): number {
  let kinetic = 0;
  let potential = 0;
  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i]!;
    const [vx, vy, vz] = bi.velocity;
    kinetic += 0.5 * bi.mass * (vx * vx + vy * vy + vz * vz);
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j]!;
      const dx = bj.position[0] - bi.position[0];
      const dy = bj.position[1] - bi.position[1];
      const dz = bj.position[2] - bi.position[2];
      potential -= (G * bi.mass * bj.mass) / Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  return kinetic + potential;
}

/** Суммарный момент импульса системы: Σ m·(r × v) */
export function angularMomentum(bodies: Body[]): Vec3 {
  const L: Vec3 = [0, 0, 0];
  for (const b of bodies) {
    const [x, y, z] = b.position;
    const [vx, vy, vz] = b.velocity;
    L[0] += b.mass * (y * vz - z * vy);
    L[1] += b.mass * (z * vx - x * vz);
    L[2] += b.mass * (x * vy - y * vx);
  }
  return L;
}
