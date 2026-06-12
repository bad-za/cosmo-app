import { describe, expect, it } from 'vitest';
import { raDecToCartesian } from '../src/pulsar';

describe('RA/Dec → декартовы координаты', () => {
  it('точка весеннего равноденствия лежит на оси X', () => {
    const [x, y, z] = raDecToCartesian(0, 0, 10);
    expect(x).toBeCloseTo(10, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(0, 9);
  });

  it('северный полюс мира лежит на оси Z', () => {
    const [x, y, z] = raDecToCartesian(123, 90, 5);
    expect(Math.hypot(x, y)).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(5, 9);
  });

  it('модуль вектора равен расстоянию', () => {
    const v = raDecToCartesian(83.6, 22.0, 6523);
    expect(Math.hypot(...v)).toBeCloseTo(6523, 6);
  });
});
