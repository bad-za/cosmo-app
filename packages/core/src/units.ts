// Система единиц проекта (зафиксирована в плане):
//   расстояние — астрономические единицы (а.е.)
//   время      — годы
//   масса      — массы Солнца
// В этих единицах гравитационная постоянная G = 4π²:
// для круговой орбиты с a = 1 а.е. вокруг массы 1 M☉ период равен 1 году.

export const G = 4 * Math.PI ** 2;

// Константы для конвертации в привычные единицы (для UI и загрузки данных)
export const AU_IN_KM = 1.495978707e8;
export const YEAR_IN_SECONDS = 365.25 * 86400; // юлианский год
export const SOLAR_MASS_IN_KG = 1.98892e30;
export const LIGHT_YEAR_IN_AU = 63241.077;

/** км/с → а.е./год (для импорта скоростей из эфемерид JPL) */
export function kmPerSecToAuPerYear(v: number): number {
  return (v * YEAR_IN_SECONDS) / AU_IN_KM;
}

/** а.е./год → км/с (для отображения скоростей в UI) */
export function auPerYearToKmPerSec(v: number): number {
  return (v * AU_IN_KM) / YEAR_IN_SECONDS;
}
