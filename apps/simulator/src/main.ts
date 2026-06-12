import './style.css';
import {
  Simulation,
  auPerYearToKmPerSec,
  orbitalElements,
  totalEnergy,
} from '@space/core';
import { SOLAR_SYSTEM_DATE, SOLAR_SYSTEM_SOURCE, loadSolarSystem, type SolarBodyInfo } from '@space/data';
import { BodiesView, SpaceScene } from '@space/render';
import { formatMass, formatSimTime, formatTimeScale } from './format';

// Базовый шаг интегрирования (годы): ~1.75 часа, Луна устойчива.
const DT_BASE = 2e-4;
// Максимум шагов на кадр — потолок вычислений
const MAX_STEPS_PER_FRAME = 4000;
// Предельный шаг при больших ускорениях времени (точность падает — честно показываем дрейф)
const DT_MAX = 4e-3;

// ---------- Состояние ----------

let bodies = loadSolarSystem();
let sim = new Simulation(bodies as SolarBodyInfo[]);
let energyStart = totalEnergy(sim.bodies);
let paused = false;
let timeScale = 0.25; // лет в секунду реального времени
let achievedScale = 0;
let selectedName: string | null = null;

// ---------- Разметка ----------

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="layout">
    <section id="viewport" class="viewport"></section>
    <aside class="panel">
      <header class="panel-head">
        <h1>Орбитальный симулятор</h1>
      </header>
      <section class="controls">
        <div class="row">
          <button id="play" class="btn">⏸ пауза</button>
          <button id="reset" class="btn">↺ сброс</button>
        </div>
        <label class="speed-label">
          Скорость: <span id="speed-value"></span>
          <input id="speed" type="range" min="-7.5" max="6" step="0.05" />
        </label>
      </section>
      <section class="diag">
        <div><span>Прошло</span><b id="sim-time"></b></div>
        <div><span>Фактическая скорость</span><b id="real-speed"></b></div>
        <div><span>Полная энергия</span><b id="energy"></b></div>
        <div><span>Дрейф энергии</span><b id="energy-drift"></b></div>
      </section>
      <article id="card" class="card empty">Кликните по телу, чтобы увидеть его параметры.</article>
      <footer class="source">данные: ${SOLAR_SYSTEM_SOURCE}, ${SOLAR_SYSTEM_DATE}</footer>
    </aside>
  </main>
`;

// ---------- Сцена ----------

const viewport = document.querySelector<HTMLElement>('#viewport')!;
const space = new SpaceScene(viewport);
const view = new BodiesView(space.scene);

// Клик (не перетаскивание камеры) — выбор тела
let downAt: [number, number] | null = null;
space.renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = [e.clientX, e.clientY];
});
space.renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 5) return;
  selectedName = view.pick(e, space.camera, space.renderer.domElement);
  renderCard();
});

// ---------- Управление ----------

const playBtn = document.querySelector<HTMLButtonElement>('#play')!;
playBtn.addEventListener('click', () => {
  paused = !paused;
  playBtn.textContent = paused ? '▶ пуск' : '⏸ пауза';
});

document.querySelector<HTMLButtonElement>('#reset')!.addEventListener('click', () => {
  bodies = loadSolarSystem();
  sim = new Simulation(bodies as SolarBodyInfo[]);
  energyStart = totalEnergy(sim.bodies);
  view.clearTrails();
  selectedName = null;
  renderCard();
});

const speedInput = document.querySelector<HTMLInputElement>('#speed')!;
const speedValue = document.querySelector<HTMLElement>('#speed-value')!;
speedInput.value = String(Math.log10(timeScale));
speedInput.addEventListener('input', () => {
  timeScale = 10 ** Number(speedInput.value);
  speedValue.textContent = formatTimeScale(timeScale);
});
speedValue.textContent = formatTimeScale(timeScale);

// ---------- Карточка тела ----------

function renderCard(): void {
  const card = document.querySelector<HTMLElement>('#card')!;
  const body = sim.bodies.find((b) => b.name === selectedName) as SolarBodyInfo | undefined;
  if (!body) {
    card.className = 'card empty';
    card.textContent = 'Кликните по телу, чтобы увидеть его параметры.';
    return;
  }
  const speedKms = auPerYearToKmPerSec(Math.hypot(...body.velocity));
  let orbitHtml = '';
  if (body.name !== 'Солнце') {
    const sun = sim.bodies.find((b) => b.name === 'Солнце')!;
    // Для Луны орбиту считаем вокруг Земли, для остальных — вокруг Солнца
    const primary = body.name === 'Луна' ? sim.bodies.find((b) => b.name === 'Земля') ?? sun : sun;
    const el = orbitalElements(body, primary);
    orbitHtml = el.unbound
      ? `<div><dt>Орбита</dt><dd class="alarm">гиперболическая — тело уходит!</dd></div>`
      : `<div><dt>Большая полуось</dt><dd>${el.semiMajorAxis.toFixed(3)} а.е.</dd></div>
         <div><dt>Эксцентриситет</dt><dd>${el.eccentricity.toFixed(4)}</dd></div>
         <div><dt>Период</dt><dd>${formatSimTime(el.periodYears)} ${primary.name !== 'Солнце' ? `(вокруг: ${primary.name})` : ''}</dd></div>`;
  }
  card.className = 'card';
  card.innerHTML = `
    <h2>${body.name}</h2>
    <dl>
      <div><dt>Масса</dt><dd>${formatMass(body.mass)}</dd></div>
      <div><dt>Скорость</dt><dd>${speedKms.toFixed(2)} км/с</dd></div>
      ${orbitHtml}
    </dl>
  `;
}

// ---------- Главный цикл ----------

const simTimeEl = document.querySelector<HTMLElement>('#sim-time')!;
const realSpeedEl = document.querySelector<HTMLElement>('#real-speed')!;
const energyEl = document.querySelector<HTMLElement>('#energy')!;
const driftEl = document.querySelector<HTMLElement>('#energy-drift')!;
let uiAccumulator = 0;

space.onFrame((dtSec) => {
  if (!paused) {
    const wantYears = timeScale * dtSec;
    let dtStep = DT_BASE;
    let steps = Math.ceil(wantYears / dtStep);
    if (steps > MAX_STEPS_PER_FRAME) {
      // Не успеваем базовым шагом — укрупняем шаг до предела, дальше честно не успеваем
      dtStep = Math.min(wantYears / MAX_STEPS_PER_FRAME, DT_MAX);
      steps = MAX_STEPS_PER_FRAME;
    }
    sim.steps(steps, dtStep);
    achievedScale = (steps * dtStep) / dtSec;
  }

  view.sync(sim.bodies as SolarBodyInfo[]);

  // Обновляем тексты ~4 раза в секунду, чтобы не дёргались
  uiAccumulator += dtSec;
  if (uiAccumulator > 0.25) {
    uiAccumulator = 0;
    const e = totalEnergy(sim.bodies);
    simTimeEl.textContent = formatSimTime(sim.time);
    realSpeedEl.textContent = paused ? '—' : formatTimeScale(achievedScale);
    energyEl.textContent = e.toExponential(4);
    driftEl.textContent = ((e - energyStart) / Math.abs(energyStart)).toExponential(1);
    if (selectedName) renderCard();
  }
});
