import { describe, expect, it } from 'vitest';
import { G, auPerYearToKmPerSec, kmPerSecToAuPerYear } from '../src/units';

describe('система единиц', () => {
  it('G = 4π² ≈ 39.478', () => {
    expect(G).toBeCloseTo(39.4784176, 6);
  });

  it('орбитальная скорость Земли ~29.79 км/с — это ~2π а.е./год', () => {
    expect(kmPerSecToAuPerYear(29.7859)).toBeCloseTo(2 * Math.PI, 3);
  });

  it('конвертация скоростей обратима', () => {
    expect(auPerYearToKmPerSec(kmPerSecToAuPerYear(17.3))).toBeCloseTo(17.3, 10);
  });
});
