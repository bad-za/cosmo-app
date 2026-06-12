// Снимок Солнечной системы из JPL Horizons (кэш в solar-system/solar-system.json)
// плюс отображаемые свойства тел для рендера (радиусы, цвета).

import type { Body, Vec3 } from '@space/core';
import snapshot from '../solar-system/solar-system.json';

export interface SolarBodyInfo extends Body {
  /** Реальный радиус тела, км (для логарифмического масштаба в рендере) */
  radiusKm: number;
  /** Цвет для отрисовки */
  color: string;
}

// Радиусы (км) и цвета — справочные, только для отображения
const DISPLAY: Record<string, { radiusKm: number; color: string }> = {
  Солнце: { radiusKm: 696000, color: '#ffd27d' },
  Меркурий: { radiusKm: 2440, color: '#9c9488' },
  Венера: { radiusKm: 6052, color: '#e6c89c' },
  Земля: { radiusKm: 6371, color: '#6fa8dc' },
  Луна: { radiusKm: 1737, color: '#b7b7b7' },
  Марс: { radiusKm: 3390, color: '#cc6f4e' },
  Юпитер: { radiusKm: 69911, color: '#d8a36a' },
  Сатурн: { radiusKm: 58232, color: '#e3cf9a' },
  Уран: { radiusKm: 25362, color: '#9fd8df' },
  Нептун: { radiusKm: 24622, color: '#5b7fd4' },
  Плутон: { radiusKm: 1188, color: '#c4b29a' },
};

/** Дата снимка (ISO) и источник — для подписи в UI */
export const SOLAR_SYSTEM_DATE = snapshot.date;
export const SOLAR_SYSTEM_SOURCE = snapshot.source;

/** Свежая глубокая копия системы — симуляцию можно мутировать свободно */
export function loadSolarSystem(): SolarBodyInfo[] {
  return snapshot.bodies.map((b) => ({
    name: b.name,
    mass: b.mass,
    position: [...b.position] as Vec3,
    velocity: [...b.velocity] as Vec3,
    radiusKm: DISPLAY[b.name]?.radiusKm ?? 1000,
    color: DISPLAY[b.name]?.color ?? '#aaaaaa',
  }));
}
