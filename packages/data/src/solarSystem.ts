// Снимок Солнечной системы из JPL Horizons (кэш в solar-system/solar-system.json)
// плюс отображаемые свойства тел для рендера (радиусы, цвета).

import type { Body, Vec3 } from '@space/core';
import snapshot from '../solar-system/solar-system.json';

export interface SolarBodyInfo extends Body {
  /** Реальный радиус тела, км (для логарифмического масштаба в рендере) */
  radiusKm: number;
  /** Цвет для отрисовки */
  color: string;
  /** Короткое описание для карточки тела (у добавленных тел нет) */
  story?: string;
}

// Радиусы (км), цвета и описания — справочные, только для отображения
const DISPLAY: Record<string, { radiusKm: number; color: string; story: string }> = {
  Солнце: {
    radiusKm: 696000,
    color: '#ffd27d',
    story: 'Жёлтый карлик, 99.86 % массы всей системы. Свет от него до Земли идёт 8 минут.',
  },
  Меркурий: {
    radiusKm: 2440,
    color: '#9c9488',
    story: 'Самая маленькая и быстрая планета: год — 88 земных дней. Днём +430 °C, ночью −180 °C.',
  },
  Венера: {
    radiusKm: 6052,
    color: '#e6c89c',
    story: 'Почти двойник Земли по размеру, но под облаками серной кислоты парниковый ад: +465 °C.',
  },
  Земля: {
    radiusKm: 6371,
    color: '#6fa8dc',
    story: 'Единственное известное обитаемое место во Вселенной. Орбита Земли задаёт нашу единицу: 1 а.е., 1 год.',
  },
  Луна: {
    radiusKm: 1737,
    color: '#b7b7b7',
    story: 'Стабилизирует наклон земной оси и поднимает приливы. Удаляется от Земли на 3.8 см в год.',
  },
  Марс: {
    radiusKm: 3390,
    color: '#cc6f4e',
    story: 'Холодная пустыня со следами древних рек. Вулкан Олимп — 21 км, почти втрое выше Эвереста.',
  },
  Юпитер: {
    radiusKm: 69911,
    color: '#d8a36a',
    story: 'В 2.5 раза тяжелее всех остальных планет вместе. Большое Красное Пятно — шторм, бушующий веками.',
  },
  Сатурн: {
    radiusKm: 58232,
    color: '#e3cf9a',
    story: 'Плотность меньше воды. Кольца из льда и камней — сотни тысяч км в ширину и лишь десятки метров в толщину.',
  },
  Уран: {
    radiusKm: 25362,
    color: '#9fd8df',
    story: 'Вращается «лёжа на боку»: ось наклонена на 98°. Каждый полюс по 42 года в темноте и на свету.',
  },
  Нептун: {
    radiusKm: 24622,
    color: '#5b7fd4',
    story: 'Самые быстрые ветры в системе — до 2100 км/ч. Открыт «на кончике пера» по возмущениям орбиты Урана.',
  },
  Плутон: {
    radiusKm: 1188,
    color: '#c4b29a',
    story: 'Карликовая планета пояса Койпера. Орбита так вытянута, что Плутон бывает ближе к Солнцу, чем Нептун.',
  },
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
    story: DISPLAY[b.name]?.story,
  }));
}
