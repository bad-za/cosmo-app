// Загрузка реальных положений и скоростей тел Солнечной системы
// из NASA JPL Horizons API на текущую дату.
// Результат в единицах проекта (а.е., а.е./год, массы Солнца) кэшируется
// в packages/data/solar-system/solar-system.json (коммитится в репозиторий).
// При недоступности API остаётся закэшированный снимок.
// Запуск: node packages/data/scripts/fetch-solar-system.mjs

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Node не доверяет перехватывающим TLS-прокси (SELF_SIGNED_CERT_IN_CHAIN),
// поэтому при неудаче fetch повторяем запрос через системный curl,
// который использует хранилище сертификатов ОС.
async function httpGetText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    const { stdout } = await execFileAsync('curl', ['-sf', '-m', '30', url], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'solar-system', 'solar-system.json');
const DAYS_PER_YEAR = 365.25;

// Horizons ID и массы в массах Солнца (массы — справочные значения IAU/JPL)
const BODIES = [
  { id: '10', name: 'Солнце', mass: 1 },
  { id: '199', name: 'Меркурий', mass: 1.6601e-7 },
  { id: '299', name: 'Венера', mass: 2.4478e-6 },
  { id: '399', name: 'Земля', mass: 3.0035e-6 },
  { id: '301', name: 'Луна', mass: 3.6943e-8 },
  { id: '499', name: 'Марс', mass: 3.2272e-7 },
  { id: '599', name: 'Юпитер', mass: 9.5479e-4 },
  { id: '699', name: 'Сатурн', mass: 2.8586e-4 },
  { id: '799', name: 'Уран', mass: 4.3662e-5 },
  { id: '899', name: 'Нептун', mass: 5.1514e-5 },
  { id: '999', name: 'Плутон', mass: 6.58e-9 },
];

async function fetchVectors(id, date, nextDate) {
  const url =
    'https://ssd.jpl.nasa.gov/api/horizons.api?format=json' +
    `&COMMAND='${id}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'` +
    // Центр — барицентр Солнечной системы, эклиптическая система координат
    `&CENTER='500@0'&REF_PLANE='ECLIPTIC'&OUT_UNITS='AU-D'&VEC_TABLE='2'` +
    `&START_TIME='${date}'&STOP_TIME='${nextDate}'&STEP_SIZE='2d'`;
  const text = JSON.parse(await httpGetText(url)).result;
  const block = text.match(/\$\$SOE([\s\S]*?)\$\$EOE/)?.[1];
  if (!block) throw new Error(`нет блока $$SOE для тела ${id}`);
  const num = (label) => {
    const m = block.match(new RegExp(`${label}\\s*=\\s*([-+\\d.E]+)`));
    if (!m) throw new Error(`нет поля ${label} для тела ${id}`);
    const v = Number(m[1]);
    if (!Number.isFinite(v)) throw new Error(`поле ${label} не число для тела ${id}`);
    return v;
  };
  return {
    position: [num('X'), num('Y'), num('Z')],
    // а.е./день → а.е./год
    velocity: [num('VX') * DAYS_PER_YEAR, num('VY') * DAYS_PER_YEAR, num('VZ') * DAYS_PER_YEAR],
  };
}

const today = new Date();
const date = today.toISOString().slice(0, 10);
const next = new Date(today.getTime() + 86400000 * 2).toISOString().slice(0, 10);

try {
  const bodies = [];
  for (const b of BODIES) {
    const vectors = await fetchVectors(b.id, date, next);
    bodies.push({ name: b.name, mass: b.mass, ...vectors });
    console.log(`  ${b.name}: r = [${vectors.position.map((x) => x.toFixed(3)).join(', ')}] а.е.`);
  }
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        source: 'NASA JPL Horizons',
        date,
        units: 'а.е., а.е./год, массы Солнца; центр — барицентр, плоскость — эклиптика',
        bodies,
      },
      null,
      2,
    ),
  );
  console.log(`OK: ${bodies.length} тел записано в ${OUT}`);
} catch (err) {
  console.error(`Загрузка из Horizons не удалась (${err.message}).`);
  try {
    const cached = JSON.parse(readFileSync(OUT, 'utf8'));
    console.error(`Используем кэш от ${cached.date}: ${cached.bodies.length} тел.`);
  } catch {
    console.error('Кэша нет — нужен fallback-снимок.');
    process.exit(1);
  }
}
