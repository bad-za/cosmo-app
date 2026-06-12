import { describe, expect, it } from 'vitest';
import { orbitalElements, type Body } from '../src/nbody';

const sun: Body = { name: 'Солнце', mass: 1, position: [0, 0, 0], velocity: [0, 0, 0] };

function probe(vy: number): Body {
  return { name: 'тело', mass: 0, position: [1, 0, 0], velocity: [0, vy, 0] };
}

describe('орбитальные элементы', () => {
  it('круговая орбита: e ≈ 0, a ≈ 1, период ≈ 1 год', () => {
    const el = orbitalElements(probe(2 * Math.PI), sun);
    expect(el.eccentricity).toBeLessThan(1e-9);
    expect(el.semiMajorAxis).toBeCloseTo(1, 9);
    expect(el.periodYears).toBeCloseTo(1, 9);
    expect(el.unbound).toBe(false);
  });

  it('пониженная скорость: эллипс с апоцентром в точке старта', () => {
    const el = orbitalElements(probe(2 * Math.PI * 0.8), sun);
    expect(el.eccentricity).toBeCloseTo(0.36, 6); // e = 1 − v²/v_круг² = 1 − 0.64
    expect(el.unbound).toBe(false);
  });

  it('скорость выше второй космической: гиперболическая орбита', () => {
    const el = orbitalElements(probe(2 * Math.PI * Math.SQRT2 * 1.01), sun);
    expect(el.unbound).toBe(true);
    expect(el.specificEnergy).toBeGreaterThan(0);
    expect(el.periodYears).toBe(Infinity);
  });
});
