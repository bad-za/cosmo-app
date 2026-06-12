import { describe, expect, it } from 'vitest';
import { Simulation, totalEnergy } from '@space/core';
import { loadSolarSystem } from '../src/solarSystem';

describe('снимок Солнечной системы (JPL Horizons)', () => {
  it('содержит 11 тел: Солнце, 8 планет, Луна, Плутон', () => {
    const bodies = loadSolarSystem();
    expect(bodies).toHaveLength(11);
    expect(bodies.map((b) => b.name)).toContain('Юпитер');
  });

  it('Земля на ~1 а.е. от Солнца со скоростью ~2π а.е./год', () => {
    const bodies = loadSolarSystem();
    const sun = bodies.find((b) => b.name === 'Солнце')!;
    const earth = bodies.find((b) => b.name === 'Земля')!;
    const r = Math.hypot(
      earth.position[0] - sun.position[0],
      earth.position[1] - sun.position[1],
      earth.position[2] - sun.position[2],
    );
    expect(r).toBeGreaterThan(0.97);
    expect(r).toBeLessThan(1.03);
    const v = Math.hypot(...earth.velocity);
    expect(v).toBeGreaterThan(2 * Math.PI * 0.95);
    expect(v).toBeLessThan(2 * Math.PI * 1.05);
  });

  it('симуляция реальной системы на 1 год: Земля делает оборот, энергия стабильна', () => {
    const sim = new Simulation(loadSolarSystem());
    const e0 = totalEnergy(sim.bodies);
    const earth = sim.bodies.find((b) => b.name === 'Земля')!;
    const start = [...earth.position];

    sim.steps(10000, 1e-4); // ровно 1 год
    const dist = Math.hypot(
      earth.position[0] - start[0],
      earth.position[1] - start[1],
      earth.position[2] - start[2],
    );
    // Реальная орбита не идеально круговая, но через год Земля рядом со стартом
    expect(dist).toBeLessThan(0.05);
    expect(Math.abs((totalEnergy(sim.bodies) - e0) / e0)).toBeLessThan(1e-6);
  });
});
