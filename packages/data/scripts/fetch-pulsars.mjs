// Загрузка параметров пульсаров из каталога ATNF (psrcat) через веб-форму.
// Результат кэшируется в packages/data/pulsars/pulsars.json (коммитится в репозиторий).
// При недоступности каталога или изменении формата — оставляем закэшированный JSON.
// Запуск: node packages/data/scripts/fetch-pulsars.mjs

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'pulsars', 'pulsars.json');

// Обязательный набор из плана + несколько знаковых пульсаров
const NAMES = ['B0531+21', 'B0833-45', 'B1919+21', 'B1937+21', 'B0329+54', 'J0437-4715', 'B1257+12'];

const url =
  'https://www.atnf.csiro.au/research/pulsar/psrcat/proc_form.php?version=2.6.0' +
  '&Name=Name&JName=JName&P0=P0&P1=P1&PEPOCH=PEPOCH&RAJD=RAJD&DECJD=DECJD&DIST=DIST' +
  '&startUserDefined=true&pulsar_names=' + encodeURIComponent(NAMES.join('\r\n')) +
  '&ephemeris=long&coords_unit=raj%2Fdecj&style=Long+with+no+errors&no_value=*&state=query';

function parsePre(html) {
  const pre = html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1];
  if (!pre) throw new Error('в ответе ATNF нет блока <pre>');
  const pulsars = [];
  for (const rawLine of pre.split('\n')) {
    // Убираем ссылки на источники и &nbsp;
    const line = rawLine.replace(/<a [^>]*>[^<]*<\/a>/g, '').replace(/&nbsp;?/g, ' ').trim();
    if (!/^\d+\s/.test(line)) continue;
    const t = line.split(/\s+/);
    // Формат строки: idx NAME PSRJ P0 errP0 P1 errP1 PEPOCH RAJD errRA DECJD errDEC DIST
    if (t.length !== 13) throw new Error(`неожиданное число колонок (${t.length}): ${line}`);
    const p = {
      name: t[1],
      jname: t[2],
      periodSec: Number(t[3]),
      periodDot: Number(t[5]),
      epochMJD: Number(t[7]),
      raDeg: Number(t[8]),
      decDeg: Number(t[10]),
      distanceKpc: Number(t[12]),
    };
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`поле ${k} не распарсилось: ${line}`);
    }
    if (p.periodSec <= 0 || p.periodSec > 100) throw new Error(`подозрительный период ${p.periodSec}: ${line}`);
    pulsars.push(p);
  }
  if (pulsars.length < NAMES.length) throw new Error(`распарсилось только ${pulsars.length} из ${NAMES.length}`);
  return pulsars;
}

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const pulsars = parsePre(await res.text());
  writeFileSync(OUT, JSON.stringify({ source: 'ATNF psrcat 2.6.0', fetchedAt: new Date().toISOString(), pulsars }, null, 2));
  console.log(`OK: ${pulsars.length} пульсаров записано в ${OUT}`);
} catch (err) {
  console.error(`Загрузка из ATNF не удалась (${err.message}).`);
  try {
    const cached = JSON.parse(readFileSync(OUT, 'utf8'));
    console.error(`Используем кэш: ${cached.pulsars.length} пульсаров от ${cached.fetchedAt}.`);
  } catch {
    console.error('Кэша нет — это ошибка, нужен fallback.');
    process.exit(1);
  }
}
