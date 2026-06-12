// Базовые типы N-body симуляции.
// Единицы: а.е., годы, массы Солнца (см. units.ts), G = 4π².

export type Vec3 = [number, number, number];

export interface Body {
  name: string;
  /** Масса в массах Солнца */
  mass: number;
  /** Позиция в а.е. */
  position: Vec3;
  /** Скорость в а.е./год */
  velocity: Vec3;
}
