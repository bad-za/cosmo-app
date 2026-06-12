import { describe, expect, it } from 'vitest';
import {
  frequencyAt,
  phaseAt,
  secondsSinceEpoch,
  unixMsToMjd,
  type PulsarParams,
} from '../src/pulsar';

// Параметры Краба из закэшированного каталога ATNF (см. packages/data/pulsars/pulsars.json)
const CRAB: PulsarParams = {
  name: 'B0531+21',
  jname: 'J0534+2200',
  periodSec: 0.0333924123,
  periodDot: 4.20972e-13,
  epochMJD: 48442.5,
  raDeg: 83.6330565,
  decDeg: 22.014498,
  distanceKpc: 2.0,
};

// Условный момент «сейчас» для тестов: 2026-06-12 (фиксируем, чтобы тест был воспроизводим)
const NOW_MJD = unixMsToMjd(Date.UTC(2026, 5, 12));

describe('фаза пульсара', () => {
  it('фаза строго монотонно растёт', () => {
    const dt0 = secondsSinceEpoch(CRAB, NOW_MJD);
    let prev = phaseAt(CRAB, dt0);
    for (let i = 1; i <= 1000; i++) {
      const next = phaseAt(CRAB, dt0 + i * 0.01); // шаг 10 мс
      expect(next).toBeGreaterThan(prev);
      prev = next;
    }
  });

  it('период тика соответствует P: за один текущий период фаза растёт ровно на 1', () => {
    const dt = secondsSinceEpoch(CRAB, NOW_MJD);
    const currentPeriod = 1 / frequencyAt(CRAB, dt);
    const dPhi = phaseAt(CRAB, dt + currentPeriod) - phaseAt(CRAB, dt);
    expect(dPhi).toBeCloseTo(1, 6);
  });

  it('замедление вращения: частота сегодня ниже, чем на эпохе каталога', () => {
    const dt = secondsSinceEpoch(CRAB, NOW_MJD);
    expect(frequencyAt(CRAB, dt)).toBeLessThan(frequencyAt(CRAB, 0));
  });

  it('Краб тикает ~30 раз в секунду', () => {
    const dt = secondsSinceEpoch(CRAB, NOW_MJD);
    const freq = frequencyAt(CRAB, dt);
    console.log(`Краб тикает ${freq.toFixed(2)} раз в секунду`);
    expect(freq).toBeGreaterThan(29);
    expect(freq).toBeLessThan(31);
  });
});
