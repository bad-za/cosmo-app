// Пересчёт небесных координат в декартовы для сцены «Галактика».

import type { Vec3 } from '../nbody/types';

/**
 * RA/Dec (градусы) + расстояние → декартовы координаты в той же единице,
 * что и расстояние. Экваториальная система: X — к точке весеннего равноденствия,
 * Z — к северному полюсу мира, Солнце в начале координат.
 */
export function raDecToCartesian(raDeg: number, decDeg: number, distance: number): Vec3 {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [
    distance * Math.cos(dec) * Math.cos(ra),
    distance * Math.cos(dec) * Math.sin(ra),
    distance * Math.sin(dec),
  ];
}
