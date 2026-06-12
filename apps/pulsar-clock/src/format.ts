// Форматирование величин для карточки пульсара

/** Период: миллисекунды для быстрых, секунды для медленных */
export function formatPeriod(periodSec: number): string {
  if (periodSec < 0.1) return `${(periodSec * 1000).toFixed(3)} мс`;
  return `${periodSec.toFixed(4)} с`;
}

/** Прямое восхождение: градусы → "чч мм" */
export function formatRa(raDeg: number): string {
  const hours = raDeg / 15;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}ч ${String(m).padStart(2, '0')}м`;
}

/** Склонение: градусы → "±гг° мм′" */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? '−' : '+';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′`;
}

/** Целое с пробелами между разрядами: 6523 → "6 523" */
export function formatInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
