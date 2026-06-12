// Расчёт фазы вращения пульсара.
// Честная модель замедления вращения:
//   φ(t) = φ0 + Δt/P − ½·Pdot·Δt²/P²,  где Δt — секунды от эпохи каталога t0.
// φ измеряется в оборотах: целая часть — номер оборота, дробная — фаза внутри оборота.

export interface PulsarParams {
  /** Имя в B-нотации (или J, если B-имени нет), например "B0531+21" */
  name: string;
  /** Имя в J-нотации, например "J0534+2200" */
  jname: string;
  /** Период вращения P на эпоху каталога, секунды */
  periodSec: number;
  /** Производная периода Pdot, с/с (безразмерная) */
  periodDot: number;
  /** Эпоха каталога t0, MJD */
  epochMJD: number;
  /** Прямое восхождение, градусы */
  raDeg: number;
  /** Склонение, градусы */
  decDeg: number;
  /** Расстояние, килопарсеки */
  distanceKpc: number;
}

/** MJD момента unix-эпохи (1970-01-01T00:00:00Z) */
export const MJD_AT_UNIX_EPOCH = 40587;
const SECONDS_PER_DAY = 86400;
export const LIGHT_YEARS_PER_KPC = 3261.563777;

/** Unix-время в миллисекундах → MJD (UTC; для часов точности достаточно) */
export function unixMsToMjd(unixMs: number): number {
  return unixMs / (SECONDS_PER_DAY * 1000) + MJD_AT_UNIX_EPOCH;
}

/** Секунды, прошедшие от эпохи каталога пульсара до момента mjd */
export function secondsSinceEpoch(p: PulsarParams, mjd: number): number {
  return (mjd - p.epochMJD) * SECONDS_PER_DAY;
}

/** Фаза вращения в оборотах на момент Δt секунд от эпохи (φ0 принимаем = 0) */
export function phaseAt(p: PulsarParams, dtSec: number): number {
  return dtSec / p.periodSec - (0.5 * p.periodDot * dtSec * dtSec) / (p.periodSec * p.periodSec);
}

/** Мгновенная частота вращения, Гц: dφ/dt = 1/P − Pdot·Δt/P² */
export function frequencyAt(p: PulsarParams, dtSec: number): number {
  return 1 / p.periodSec - (p.periodDot * dtSec) / (p.periodSec * p.periodSec);
}

/** Мгновенный период вращения, секунды */
export function periodAt(p: PulsarParams, dtSec: number): number {
  return 1 / frequencyAt(p, dtSec);
}

/** Сколько лет шёл сигнал пульсара до Земли (расстояние в световых годах) */
export function lightTravelYears(p: PulsarParams): number {
  return p.distanceKpc * LIGHT_YEARS_PER_KPC;
}
