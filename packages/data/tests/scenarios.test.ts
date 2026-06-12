import { describe, expect, it } from 'vitest';
import { Simulation, orbitalElements } from '@space/core';
import { SCENARIOS, applyScenario } from '../src/scenarios';

describe('сценарии «сломай мир»', () => {
  it('все сценарии применяются без ошибок', () => {
    for (const s of SCENARIOS) {
      const bodies = applyScenario(s);
      expect(bodies.length).toBeGreaterThan(9);
    }
  });

  it('«без Юпитера» — Юпитера нет, остальные на месте', () => {
    const bodies = applyScenario(SCENARIOS.find((s) => s.id === 'no-jupiter')!);
    expect(bodies.find((b) => b.name === 'Юпитер')).toBeUndefined();
    expect(bodies.find((b) => b.name === 'Сатурн')).toBeDefined();
  });

  it('«вторая Луна» стартует на связанной орбите вокруг Земли', () => {
    const bodies = applyScenario(SCENARIOS.find((s) => s.id === 'second-moon')!);
    const moon2 = bodies.find((b) => b.name === 'Луна-2')!;
    const earth = bodies.find((b) => b.name === 'Земля')!;
    const el = orbitalElements(moon2, earth);
    expect(el.unbound).toBe(false);
  });

  it('блуждающая звезда прилетает по гиперболе и реально ломает орбиты', () => {
    const scenario = SCENARIOS.find((s) => s.id === 'star-flyby')!;
    const bodies = applyScenario(scenario);
    const star = bodies.find((b) => b.name === 'Блуждающая звезда')!;
    const sun = bodies.find((b) => b.name === 'Солнце')!;
    expect(orbitalElements(star, sun).unbound).toBe(true);

    // Прогоняем 12 лет: звезда должна пройти через систему и возмутить эксцентриситеты
    const sim = new Simulation(bodies, 1e-3);
    const before = orbitalElements(
      sim.bodies.find((b) => b.name === 'Нептун')!,
      sim.bodies.find((b) => b.name === 'Солнце')!,
    ).eccentricity;
    sim.steps(12000, 1e-3);
    const after = orbitalElements(
      sim.bodies.find((b) => b.name === 'Нептун')!,
      sim.bodies.find((b) => b.name === 'Солнце')!,
    ).eccentricity;
    expect(Math.abs(after - before)).toBeGreaterThan(0.01);
  });
});
