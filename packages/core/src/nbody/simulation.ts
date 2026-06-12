// Симуляция N тел с интегратором leapfrog (velocity Verlet).
// Симплектический метод второго порядка: энергия не дрейфует монотонно,
// а осциллирует вокруг истинного значения — поэтому он, а не Эйлер.

import { accelerations } from './gravity';
import type { Body, Vec3 } from './types';

export class Simulation {
  bodies: Body[];
  /** Симулированное время от старта, годы */
  time = 0;
  /** Сглаживание гравитации ε, а.е. (0 — честная ньютоновская) */
  softening: number;
  private acc: Vec3[];

  constructor(bodies: Body[], softening = 0) {
    this.bodies = bodies;
    this.softening = softening;
    this.acc = accelerations(bodies, softening);
  }

  /** Один шаг velocity Verlet на dt лет */
  step(dt: number): void {
    const bodies = this.bodies;
    const acc = this.acc;
    // Дрейф: x += v·dt + ½·a·dt²
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]!;
      const a = acc[i]!;
      b.position[0] += b.velocity[0] * dt + 0.5 * a[0] * dt * dt;
      b.position[1] += b.velocity[1] * dt + 0.5 * a[1] * dt * dt;
      b.position[2] += b.velocity[2] * dt + 0.5 * a[2] * dt * dt;
    }
    // Ускорения в новых позициях
    const accNew = accelerations(bodies, this.softening);
    // Пинок: v += ½·(a_old + a_new)·dt
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]!;
      const a = acc[i]!;
      const an = accNew[i]!;
      b.velocity[0] += 0.5 * (a[0] + an[0]) * dt;
      b.velocity[1] += 0.5 * (a[1] + an[1]) * dt;
      b.velocity[2] += 0.5 * (a[2] + an[2]) * dt;
    }
    this.acc = accNew;
    this.time += dt;
  }

  /** Несколько шагов подряд */
  steps(count: number, dt: number): void {
    for (let i = 0; i < count; i++) this.step(dt);
  }

  /** Пересчитать ускорения после внешнего изменения тел (добавили/удалили/изменили массу) */
  invalidate(): void {
    this.acc = accelerations(this.bodies, this.softening);
  }
}
