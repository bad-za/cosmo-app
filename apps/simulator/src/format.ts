// Форматирование величин для панелей симулятора

export function formatInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Скорость течения времени, лет/с → человеческий вид */
export function formatTimeScale(yearsPerSec: number): string {
  const daysPerSec = yearsPerSec * 365.25;
  const hoursPerSec = daysPerSec * 24;
  if (hoursPerSec < 1 / 30) return `${(hoursPerSec * 3600).toFixed(1)} с/с`;
  if (hoursPerSec < 0.5) return `${(hoursPerSec * 60).toFixed(1)} мин/с`;
  if (daysPerSec < 0.5) return `${hoursPerSec.toFixed(1)} ч/с`;
  if (yearsPerSec < 0.5) return `${daysPerSec.toFixed(1)} дн/с`;
  if (yearsPerSec < 1000) return `${yearsPerSec.toFixed(yearsPerSec < 10 ? 1 : 0)} лет/с`;
  if (yearsPerSec < 1e6) return `${formatInt(yearsPerSec / 1000)} тыс. лет/с`;
  return `${(yearsPerSec / 1e6).toFixed(1)} млн лет/с`;
}

/** Симулированное время, годы → человеческий вид */
export function formatSimTime(years: number): string {
  if (years < 0.1) return `${(years * 365.25).toFixed(1)} дней`;
  if (years < 1000) return `${years.toFixed(2)} лет`;
  return `${formatInt(years)} лет`;
}

/** Масса в массах Солнца → подпись в М☉ или массах Земли */
export function formatMass(massSun: number): string {
  if (massSun >= 0.01) return `${massSun.toFixed(2)} M☉`;
  const earths = massSun / 3.0035e-6;
  if (earths >= 0.01) return `${earths.toFixed(earths < 10 ? 2 : 1)} M⊕`;
  return `${massSun.toExponential(2)} M☉`;
}
