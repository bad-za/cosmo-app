// Сцена «Система»: вся логика симулятора (управление временем, сценарии,
// карточка тела, журнал, детектор катастроф) поверх готовой SpaceScene.
// Используется приложением simulator и дашбордом.

import './sim-app.css';
import {
  Simulation,
  auPerYearToKmPerSec,
  orbitalElements,
  totalEnergy,
  type Vec3,
} from '@space/core';
import {
  SCENARIOS,
  SOLAR_SYSTEM_DATE,
  SOLAR_SYSTEM_SOURCE,
  applyScenario,
  type SolarBodyInfo,
} from '@space/data';
import { BodiesView, type SpaceScene } from '@space/render';
import { formatMass, formatSimTime, formatTimeScale } from './format';

// Базовый шаг интегрирования (годы): ~1.75 часа, Луна устойчива.
const DT_BASE = 2e-4;
// Потолок шагов физики на кадр: подстраивается под производительность устройства
const MAX_STEPS_LIMIT = 4000;
const MIN_STEPS_LIMIT = 250;
// Предельный шаг при больших ускорениях времени (точность падает — честно показываем дрейф)
const DT_MAX = 4e-3;
// Перевод длины «прицельного» клика в скорость: 1 а.е. расстояния = 1 а.е./год
const ADD_VELOCITY_SCALE = 1;

// Пресеты массы для добавляемых тел
const MASS_PRESETS = [
  { id: 'earth', label: 'планета (1 M⊕)', mass: 3.0035e-6, radiusKm: 6371, color: '#6fd49a' },
  { id: 'jupiter', label: 'гигант (1 M_Юп)', mass: 9.5479e-4, radiusKm: 69911, color: '#e0b070' },
  { id: 'star', label: 'звезда (0.5 M☉)', mass: 0.5, radiusKm: 250000, color: '#ff8d66' },
];

export interface SimulatorApp {
  view: BodiesView;
  /** Включить/выключить сцену: видимость, шаги физики, обработку кликов */
  setActive(on: boolean): void;
}

export function mountSimulator(space: SpaceScene, viewport: HTMLElement, panel: HTMLElement): SimulatorApp {
  // ---------- Состояние ----------

  let scenario = SCENARIOS[0]!;
  let sim = new Simulation(applyScenario(scenario));
  let originalMass = new Map(sim.bodies.map((b) => [b.name, b.mass]));
  let energyStart = totalEnergy(sim.bodies);
  let paused = false;
  let active = true;
  let timeScale = 0.25; // лет в секунду реального времени
  let achievedScale = 0;
  let selectedName: string | null = null;
  let addedCount = 0;
  // Режим добавления тела: 'position' — ждём клик позиции, 'velocity' — клик скорости
  let addMode: 'off' | 'position' | 'velocity' = 'off';
  let addPosition: Vec3 | null = null;
  // Статус «улетает» по имени тела — для журнала и подсветки
  const unboundState = new Map<string, boolean>();

  function bodiesInfo(): SolarBodyInfo[] {
    return sim.bodies as SolarBodyInfo[];
  }

  // ---------- Разметка ----------

  viewport.insertAdjacentHTML('beforeend', `<div class="add-hint hidden"></div>`);
  panel.innerHTML = `
    <header class="panel-head">
      <h1>Орбитальный симулятор</h1>
    </header>
    <section class="controls">
      <label class="speed-label">Сценарий
        <select class="select scenario-select">
          ${SCENARIOS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </label>
      <p class="scenario-desc"></p>
      <div class="row">
        <button class="btn play-btn">⏸ пауза</button>
        <button class="btn reset-btn">↺ сброс</button>
        <button class="btn add-btn">+ тело</button>
      </div>
      <div class="add-form hidden">
        <select class="select add-mass">
          ${MASS_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}
        </select>
      </div>
      <label class="speed-label">
        Скорость: <span class="speed-value"></span>
        <input class="speed-input" type="range" min="-7.5" max="6" step="0.05" />
      </label>
    </section>
    <section class="diag">
      <div><span>Прошло</span><b class="sim-time"></b></div>
      <div><span>Фактическая скорость</span><b class="real-speed"></b></div>
      <div><span>Полная энергия</span><b class="energy"></b></div>
      <div><span>Дрейф энергии</span><b class="energy-drift"></b></div>
    </section>
    <article class="card empty">Кликните по телу, чтобы увидеть его параметры.</article>
    <section class="journal-wrap">
      <h3>Журнал событий</h3>
      <ul class="journal"></ul>
    </section>
    <footer class="source">данные: ${SOLAR_SYSTEM_SOURCE}, ${SOLAR_SYSTEM_DATE}</footer>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => panel.querySelector<T>(sel)!;
  const view = new BodiesView(space.scene);
  const addHint = viewport.querySelector<HTMLElement>('.add-hint')!;

  // ---------- Журнал ----------

  const journalEl = $('.journal');

  function logEvent(text: string, alarm = false): void {
    const li = document.createElement('li');
    li.className = alarm ? 'alarm' : '';
    li.textContent = `${formatSimTime(sim.time)}: ${text}`;
    journalEl.prepend(li);
    while (journalEl.children.length > 60) journalEl.lastChild?.remove();
  }

  // ---------- Сценарии / сброс ----------

  const scenarioSelect = $<HTMLSelectElement>('.scenario-select');
  const scenarioDesc = $('.scenario-desc');

  function loadScenario(s: (typeof SCENARIOS)[number]): void {
    scenario = s;
    sim = new Simulation(applyScenario(s));
    originalMass = new Map(sim.bodies.map((b) => [b.name, b.mass]));
    energyStart = totalEnergy(sim.bodies);
    unboundState.clear();
    view.clearTrails();
    selectedName = null;
    addedCount = 0;
    setAddMode('off');
    journalEl.innerHTML = '';
    scenarioDesc.textContent = s.description;
    logEvent(`сценарий «${s.name}» загружен`);
    renderCard();
  }

  scenarioSelect.addEventListener('change', () => {
    loadScenario(SCENARIOS.find((s) => s.id === scenarioSelect.value)!);
  });

  $('.reset-btn').addEventListener('click', () => loadScenario(scenario));

  // ---------- Пауза и скорость ----------

  const playBtn = $<HTMLButtonElement>('.play-btn');
  playBtn.addEventListener('click', () => {
    paused = !paused;
    playBtn.textContent = paused ? '▶ пуск' : '⏸ пауза';
  });

  const speedInput = $<HTMLInputElement>('.speed-input');
  const speedValue = $('.speed-value');
  speedInput.value = String(Math.log10(timeScale));
  speedInput.addEventListener('input', () => {
    timeScale = 10 ** Number(speedInput.value);
    speedValue.textContent = formatTimeScale(timeScale);
  });
  speedValue.textContent = formatTimeScale(timeScale);

  // ---------- Добавление тела кликом ----------

  const addBtn = $<HTMLButtonElement>('.add-btn');
  const addForm = $('.add-form');
  const addMassSelect = $<HTMLSelectElement>('.add-mass');

  function setAddMode(mode: typeof addMode): void {
    addMode = mode;
    if (mode !== 'velocity') addPosition = null;
    addBtn.classList.toggle('active', mode !== 'off');
    addForm.classList.toggle('hidden', mode === 'off');
    addHint.classList.toggle('hidden', mode === 'off');
    if (mode === 'position') addHint.textContent = 'Кликните в плоскости эклиптики — там появится тело';
    if (mode === 'velocity') addHint.textContent = 'Теперь кликните, куда ему лететь (дальше — быстрее)';
  }

  addBtn.addEventListener('click', () => setAddMode(addMode === 'off' ? 'position' : 'off'));

  // ---------- Клики по сцене: выбор тела или добавление ----------

  let downAt: [number, number] | null = null;
  space.renderer.domElement.addEventListener('pointerdown', (e) => {
    downAt = [e.clientX, e.clientY];
  });
  space.renderer.domElement.addEventListener('pointerup', (e) => {
    if (!active || !downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 5) return;

    if (addMode === 'position') {
      const p = space.pointOnEcliptic(e);
      if (!p) return;
      setAddMode('velocity');
      addPosition = p;
      return;
    }
    if (addMode === 'velocity' && addPosition) {
      const target = space.pointOnEcliptic(e);
      if (!target) return;
      const preset = MASS_PRESETS.find((p) => p.id === addMassSelect.value)!;
      addedCount++;
      const name = `${preset.label.split(' ')[0]}-${addedCount}`;
      const velocity: Vec3 = [
        (target[0] - addPosition[0]) * ADD_VELOCITY_SCALE,
        (target[1] - addPosition[1]) * ADD_VELOCITY_SCALE,
        0,
      ];
      bodiesInfo().push({
        name,
        mass: preset.mass,
        position: addPosition,
        velocity,
        radiusKm: preset.radiusKm,
        color: preset.color,
      });
      originalMass.set(name, preset.mass);
      sim.invalidate();
      energyStart = totalEnergy(sim.bodies); // энергия легитимно изменилась
      logEvent(`добавлено тело «${name}» (${formatMass(preset.mass)})`);
      setAddMode('off');
      return;
    }

    selectedName = view.pick(e, space.camera, space.renderer.domElement);
    renderCard();
  });

  // ---------- Карточка тела ----------

  const card = $('.card');
  // Пока пользователь взаимодействует с карточкой (тянет слайдер) — не перерисовываем её фоном
  let cardBusy = false;
  card.addEventListener('pointerdown', () => {
    cardBusy = true;
  });
  window.addEventListener('pointerup', () => {
    cardBusy = false;
  });

  function primaryFor(body: SolarBodyInfo): SolarBodyInfo | null {
    if (body.name === 'Луна' || body.name === 'Луна-2') {
      return bodiesInfo().find((b) => b.name === 'Земля') ?? null;
    }
    // Самое массивное тело, кроме самого себя
    const others = bodiesInfo().filter((b) => b !== body);
    return others.length ? others.reduce((a, b) => (b.mass > a.mass ? b : a)) : null;
  }

  function renderCard(): void {
    const body = bodiesInfo().find((b) => b.name === selectedName);
    if (!body) {
      card.className = 'card empty';
      card.textContent = 'Кликните по телу, чтобы увидеть его параметры.';
      return;
    }
    const speedKms = auPerYearToKmPerSec(Math.hypot(...body.velocity));
    const primary = primaryFor(body);
    let orbitHtml = '';
    if (primary && primary.mass > body.mass) {
      const el = orbitalElements(body, primary);
      orbitHtml = el.unbound
        ? `<div><dt>Орбита</dt><dd class="alarm">гиперболическая — тело уходит!</dd></div>`
        : `<div><dt>Большая полуось</dt><dd>${el.semiMajorAxis.toFixed(3)} а.е.</dd></div>
           <div><dt>Эксцентриситет</dt><dd>${el.eccentricity.toFixed(4)}</dd></div>
           <div><dt>Период</dt><dd>${formatSimTime(el.periodYears)}${primary.name !== 'Солнце' ? ` (вокруг: ${primary.name})` : ''}</dd></div>`;
    }
    const massRatio = body.mass / (originalMass.get(body.name) ?? body.mass);
    card.className = 'card';
    card.innerHTML = `
      <h2>${body.name}</h2>
      <dl>
        <div><dt>Масса</dt><dd>${formatMass(body.mass)}</dd></div>
        <div><dt>Скорость</dt><dd>${speedKms.toFixed(2)} км/с</dd></div>
        ${orbitHtml}
      </dl>
      <label class="speed-label mass-label">Масса: ×${massRatio.toFixed(2)}
        <input class="mass-slider" type="range" min="-1" max="1" step="0.01" value="${Math.log10(massRatio)}" />
      </label>
      <button class="btn danger delete-btn">✕ удалить тело</button>
    `;
    card.querySelector<HTMLInputElement>('.mass-slider')!.addEventListener('input', (e) => {
      const factor = 10 ** Number((e.target as HTMLInputElement).value);
      body.mass = (originalMass.get(body.name) ?? body.mass) * factor;
      sim.invalidate();
      energyStart = totalEnergy(sim.bodies);
      card.querySelector('.mass-label')!.childNodes[0]!.textContent = `Масса: ×${factor.toFixed(2)}`;
    });
    card.querySelector<HTMLButtonElement>('.delete-btn')!.addEventListener('click', () => {
      sim.bodies = sim.bodies.filter((b) => b !== body);
      sim.invalidate();
      energyStart = totalEnergy(sim.bodies);
      unboundState.delete(body.name);
      logEvent(`тело «${body.name}» удалено пользователем`, true);
      selectedName = null;
      renderCard();
    });
  }

  // ---------- Детектор катастроф ----------

  function checkEscapes(): void {
    const sun = bodiesInfo().find((b) => b.name === 'Солнце');
    if (!sun) return;
    for (const body of bodiesInfo()) {
      if (body === sun) continue;
      const el = orbitalElements(body, sun);
      const was = unboundState.get(body.name) ?? false;
      const now = el.unbound;
      if (now !== was) {
        unboundState.set(body.name, now);
        view.setHighlight(body.name, now);
        if (now) {
          logEvent(`«${body.name}» — орбита гиперболическая (e = ${el.eccentricity.toFixed(2)}), тело покидает систему`, true);
        } else {
          logEvent(`«${body.name}» снова на связанной орбите (e = ${el.eccentricity.toFixed(2)})`);
        }
      }
    }
  }

  // ---------- Главный цикл ----------

  const simTimeEl = $('.sim-time');
  const realSpeedEl = $('.real-speed');
  const energyEl = $('.energy');
  const driftEl = $('.energy-drift');
  let uiAccumulator = 0;
  // Адаптация под устройство: кадры дольше ~45 мс — снижаем потолок шагов,
  // стабильно быстрые — поднимаем обратно (важно для телефонов в мини-аппе)
  let stepsLimit = MAX_STEPS_LIMIT;

  space.onFrame((dtSec) => {
    if (!active) return;
    if (dtSec > 0.045) stepsLimit = Math.max(MIN_STEPS_LIMIT, Math.round(stepsLimit * 0.7));
    else if (dtSec < 0.022 && stepsLimit < MAX_STEPS_LIMIT) {
      stepsLimit = Math.min(MAX_STEPS_LIMIT, Math.round(stepsLimit * 1.1));
    }
    if (!paused) {
      const wantYears = timeScale * dtSec;
      // Шаг подгоняем так, чтобы steps * dtStep == wantYears точно: иначе на
      // малых скоростях минимальный шаг DT_BASE становится «полом» и фактическая
      // скорость перестаёт уменьшаться вслед за слайдером
      let steps = Math.max(1, Math.ceil(wantYears / DT_BASE));
      let dtStep = wantYears / steps;
      if (steps > stepsLimit) {
        // Не успеваем базовым шагом — укрупняем шаг до предела, дальше честно не успеваем
        dtStep = Math.min(wantYears / stepsLimit, DT_MAX);
        steps = stepsLimit;
      }
      sim.steps(steps, dtStep);
      achievedScale = (steps * dtStep) / dtSec;
    }

    view.sync(bodiesInfo());

    // Обновляем тексты и детектор ~4 раза в секунду
    uiAccumulator += dtSec;
    if (uiAccumulator > 0.25) {
      uiAccumulator = 0;
      checkEscapes();
      const e = totalEnergy(sim.bodies);
      simTimeEl.textContent = formatSimTime(sim.time);
      realSpeedEl.textContent = paused ? '—' : formatTimeScale(achievedScale);
      energyEl.textContent = e.toExponential(4);
      driftEl.textContent = ((e - energyStart) / Math.abs(energyStart)).toExponential(1);
      if (selectedName && !cardBusy) renderCard();
    }
  });

  // ---------- Старт ----------

  scenarioDesc.textContent = scenario.description;
  logEvent(`сценарий «${scenario.name}» загружен`);

  return {
    view,
    setActive(on: boolean): void {
      active = on;
      view.root.visible = on;
      if (!on) setAddMode('off');
    },
  };
}
