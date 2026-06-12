import { describe, expect, it } from 'vitest';
import { Simulation, angularMomentum, totalEnergy, type Body } from '../src/nbody';

// Солнце + Земля на круговой орбите: r = 1 а.е., v = 2π а.е./год.
// Скорость Солнца подобрана так, чтобы суммарный импульс был нулевым.
function sunEarth(): Body[] {
  const earthMass = 3.0035e-6;
  return [
    { name: 'Солнце', mass: 1, position: [0, 0, 0], velocity: [0, -2 * Math.PI * earthMass, 0] },
    { name: 'Земля', mass: earthMass, position: [1, 0, 0], velocity: [0, 2 * Math.PI, 0] },
  ];
}

const DT = 1e-4; // шаг 1e-4 года ≈ 53 минуты

describe('N-body: двухтельная задача Солнце — Земля', () => {
  it('орбита замкнута, период = 1 год ± 0.1%', () => {
    const sim = new Simulation(sunEarth());
    const start: [number, number] = [1, 0];

    // Ловим момент полного оборота: y меняет знак с минуса на плюс при x > 0
    let period = 0;
    let prevY = 0;
    for (let i = 0; i < 20000; i++) {
      const earth = sim.bodies[1]!;
      const y = earth.position[1];
      if (i > 1000 && prevY < 0 && y >= 0 && earth.position[0] > 0) {
        // Линейная интерполяция момента пересечения внутри шага
        period = sim.time - DT * (y / (y - prevY));
        break;
      }
      prevY = y;
      sim.step(DT);
    }
    expect(period).toBeGreaterThan(0);
    expect(Math.abs(period - 1)).toBeLessThan(0.001); // ± 0.1%

    // Замкнутость: через целый период Земля возвращается в исходную точку
    const sim2 = new Simulation(sunEarth());
    sim2.steps(Math.round(1 / DT), DT);
    const earth = sim2.bodies[1]!;
    const dist = Math.hypot(earth.position[0] - start[0], earth.position[1] - start[1], earth.position[2]);
    expect(dist).toBeLessThan(1e-3); // отклонение < 0.001 а.е.
  });

  it('полная энергия сохраняется на 10 000 шагов: дрейф < 10⁻⁶', () => {
    const sim = new Simulation(sunEarth());
    const e0 = totalEnergy(sim.bodies);
    let maxDrift = 0;
    for (let i = 0; i < 10000; i++) {
      sim.step(DT);
      maxDrift = Math.max(maxDrift, Math.abs((totalEnergy(sim.bodies) - e0) / e0));
    }
    expect(maxDrift).toBeLessThan(1e-6);
  });

  it('момент импульса сохраняется на 10 000 шагов: дрейф < 10⁻⁶', () => {
    const sim = new Simulation(sunEarth());
    const l0 = angularMomentum(sim.bodies);
    const l0mag = Math.hypot(...l0);
    sim.steps(10000, DT);
    const l1 = angularMomentum(sim.bodies);
    const drift = Math.hypot(l1[0] - l0[0], l1[1] - l0[1], l1[2] - l0[2]) / l0mag;
    expect(drift).toBeLessThan(1e-6);
  });

  it('эллиптическая орбита: энергия стабильна и на вытянутой траектории', () => {
    // Земля с пониженной скоростью — эксцентричная орбита с тесным перигелием
    const bodies = sunEarth();
    bodies[1]!.velocity[1] = 2 * Math.PI * 0.7;
    const sim = new Simulation(bodies);
    const e0 = totalEnergy(sim.bodies);
    sim.steps(10000, 5e-5);
    expect(Math.abs((totalEnergy(sim.bodies) - e0) / e0)).toBeLessThan(1e-5);
  });
});
