// Headless-прогон сценария без рендера: метрики орбит в JSON/CSV.
// Это инструмент «агента-лаборанта» — серии экспериментов для отчётов в reports/.
//
// Запуск:
//   npm run lab -- --scenario star-flyby --years 50
//   npm run lab -- --scenario base --years 200 --mass "Юпитер=10" --out run.json --csv series.csv
//
// Параметры:
//   --scenario <id>    id сценария (base | no-jupiter | second-moon | star-flyby | earth-x2)
//   --years <N>        длительность прогона в годах (по умолчанию 100)
//   --dt <шаг>         шаг интегрирования в годах (по умолчанию 1e-3)
//   --sample <годы>    интервал записи временного ряда (по умолчанию years/100)
//   --mass "Имя=K"     умножить массу тела на K (можно несколько раз)
//   --remove "Имя"     удалить тело (можно несколько раз)
//   --out <файл>       записать итоговый JSON в файл (иначе в stdout)
//   --csv <файл>       записать временной ряд (t, тело, a, e, связана) в CSV

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Simulation, orbitalElements, totalEnergy } from '@space/core';
import { SCENARIOS, applyScenario } from '@space/data';

// ---------- Разбор аргументов ----------

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
function flagAll(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === `--${name}`) out.push(args[i + 1]!);
  }
  return out;
}

const scenarioId = flag('scenario') ?? 'base';
const years = Number(flag('years') ?? 100);
const dt = Number(flag('dt') ?? 1e-3);
const sampleEvery = Number(flag('sample') ?? years / 100);
const outFile = flag('out');
const csvFile = flag('csv');

const scenario = SCENARIOS.find((s) => s.id === scenarioId);
if (!scenario || !Number.isFinite(years) || years <= 0 || !Number.isFinite(dt) || dt <= 0) {
  console.error(`Неизвестный сценарий «${scenarioId}» или некорректные параметры.`);
  console.error(`Доступные сценарии: ${SCENARIOS.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

// ---------- Подготовка системы ----------

const bodies = applyScenario(scenario);
for (const spec of flagAll('mass')) {
  const [name, k] = spec.split('=');
  const b = bodies.find((x) => x.name === name);
  if (!b || !Number.isFinite(Number(k))) {
    console.error(`--mass: не нашёл тело «${name}» или множитель не число`);
    process.exit(1);
  }
  b.mass *= Number(k);
}
for (const name of flagAll('remove')) {
  const i = bodies.findIndex((x) => x.name === name);
  if (i < 0) {
    console.error(`--remove: не нашёл тело «${name}»`);
    process.exit(1);
  }
  bodies.splice(i, 1);
}

// ---------- Прогон ----------

interface BodyMetrics {
  name: string;
  a0: number | null;
  e0: number | null;
  aEnd: number | null;
  eEnd: number | null;
  eMax: number | null;
  escaped: boolean;
  escapeTimeYears: number | null;
}

const sim = new Simulation(bodies);
const sun = sim.bodies.reduce((a, b) => (b.mass > a.mass ? b : a));
const tracked = sim.bodies.filter((b) => b !== sun);

function elementsOf(name: string) {
  const b = sim.bodies.find((x) => x.name === name);
  return b ? orbitalElements(b, sun) : null;
}

const metrics = new Map<string, BodyMetrics>(
  tracked.map((b) => {
    const el = orbitalElements(b, sun);
    return [
      b.name,
      {
        name: b.name,
        a0: el.unbound ? null : el.semiMajorAxis,
        e0: el.eccentricity,
        aEnd: null,
        eEnd: null,
        eMax: el.unbound ? null : el.eccentricity,
        escaped: el.unbound,
        escapeTimeYears: el.unbound ? 0 : null,
      },
    ];
  }),
);

const e0 = totalEnergy(sim.bodies);
let maxEnergyDrift = 0;
const csvRows: string[] = ['t_years,body,a_au,e,bound'];
const stepsPerSample = Math.max(1, Math.round(sampleEvery / dt));
const totalSteps = Math.round(years / dt);

for (let done = 0; done < totalSteps; ) {
  const chunk = Math.min(stepsPerSample, totalSteps - done);
  sim.steps(chunk, dt);
  done += chunk;

  maxEnergyDrift = Math.max(maxEnergyDrift, Math.abs((totalEnergy(sim.bodies) - e0) / e0));
  for (const m of metrics.values()) {
    const el = elementsOf(m.name);
    if (!el) continue; // тело могло быть удалено только пользователем UI, тут не бывает
    if (csvFile) {
      csvRows.push(
        `${sim.time.toFixed(4)},${m.name},${el.unbound ? '' : el.semiMajorAxis.toFixed(6)},${el.eccentricity.toFixed(6)},${el.unbound ? 0 : 1}`,
      );
    }
    if (!el.unbound && (m.eMax === null || el.eccentricity > m.eMax)) m.eMax = el.eccentricity;
    if (el.unbound && !m.escaped) {
      m.escaped = true;
      m.escapeTimeYears = sim.time;
    }
  }
}

for (const m of metrics.values()) {
  const el = elementsOf(m.name);
  if (el && !el.unbound) {
    m.aEnd = el.semiMajorAxis;
    m.eEnd = el.eccentricity;
  }
}

// ---------- Вывод ----------

const result = {
  scenario: scenario.id,
  scenarioName: scenario.name,
  massOverrides: flagAll('mass'),
  removed: flagAll('remove'),
  years,
  dt,
  maxEnergyDrift,
  escaped: [...metrics.values()].filter((m) => m.escaped).map((m) => m.name),
  bodies: [...metrics.values()],
};

const json = JSON.stringify(result, null, 2);
if (outFile) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, json);
  console.log(`JSON: ${outFile}`);
} else {
  console.log(json);
}
if (csvFile) {
  mkdirSync(dirname(csvFile), { recursive: true });
  writeFileSync(csvFile, csvRows.join('\n'));
  console.log(`CSV: ${csvFile} (${csvRows.length - 1} строк)`);
}
