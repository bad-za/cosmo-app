import './style.css';
import {
  frequencyAt,
  lightTravelYears,
  phaseAt,
  secondsSinceEpoch,
  unixMsToMjd,
} from '@space/core';
import { PULSARS, PULSAR_CATALOG_SOURCE, type PulsarInfo } from '@space/data';
import { PulsarAudio } from './audio';
import { formatDec, formatInt, formatPeriod, formatRa } from './format';

// Быстрее этой частоты глаз не успевает за вспышками — показываем
// замедленную огибающую (стробоскопический режим)
const FAST_VISUAL_HZ = 18;
const SLOWED_ENVELOPE_HZ = 1.5; // частота замедленной пульсации в строб-режиме

const audio = new PulsarAudio();
let current: PulsarInfo = PULSARS.find((p) => p.name === 'B0833-45') ?? PULSARS[0]!;

// ---------- Разметка ----------

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <canvas id="stars"></canvas>
  <main class="clock">
    <section class="stage">
      <div class="orb-wrap">
        <div class="orb"></div>
        <div class="orb-ring"></div>
      </div>
      <div class="freq-label">
        <span id="freq-value"></span>
        <span id="strobe-note" class="strobe-note"></span>
      </div>
    </section>
    <aside class="panel">
      <header class="panel-head">
        <h1>Пульсар-часы</h1>
        <button id="mute" class="mute" aria-pressed="false">🔇 звук выкл</button>
      </header>
      <nav id="switcher" class="switcher"></nav>
      <article id="card" class="card"></article>
      <footer class="source">данные: ${PULSAR_CATALOG_SOURCE}</footer>
    </aside>
  </main>
`;

// ---------- Звёздный фон (рисуется один раз на canvas) ----------

const stars = document.querySelector<HTMLCanvasElement>('#stars')!;
function paintStars(): void {
  stars.width = window.innerWidth * devicePixelRatio;
  stars.height = window.innerHeight * devicePixelRatio;
  const g = stars.getContext('2d')!;
  g.clearRect(0, 0, stars.width, stars.height);
  for (let i = 0; i < 220; i++) {
    const r = (Math.random() * 1.1 + 0.2) * devicePixelRatio;
    g.globalAlpha = Math.random() * 0.7 + 0.1;
    g.fillStyle = '#cdd6ff';
    g.beginPath();
    g.arc(Math.random() * stars.width, Math.random() * stars.height, r, 0, Math.PI * 2);
    g.fill();
  }
}
paintStars();
window.addEventListener('resize', paintStars);

// ---------- Переключатель пульсаров ----------

const switcher = document.querySelector<HTMLElement>('#switcher')!;
switcher.innerHTML = PULSARS.map(
  (p, i) => `
    <button class="pulsar-btn" data-index="${i}">
      <span class="pulsar-btn-name">${p.label}</span>
      <span class="pulsar-btn-period">${formatPeriod(p.periodSec)}</span>
    </button>`,
).join('');

switcher.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pulsar-btn');
  if (!btn) return;
  selectPulsar(PULSARS[Number(btn.dataset.index)]!);
});

// ---------- Карточка ----------

function renderCard(p: PulsarInfo): void {
  const freq = frequencyAt(p, secondsSinceEpoch(p, unixMsToMjd(Date.now())));
  const years = lightTravelYears(p);
  document.querySelector<HTMLElement>('#card')!.innerHTML = `
    <h2>${p.label} <span class="psr-name">PSR ${p.name}</span></h2>
    <p class="story">${p.story}</p>
    <dl>
      <div><dt>Период</dt><dd>${formatPeriod(p.periodSec)}</dd></div>
      <div><dt>Частота</dt><dd>${freq.toFixed(freq > 100 ? 0 : 2)} Гц</dd></div>
      <div><dt>Расстояние</dt><dd>${formatInt(years)} св. лет</dd></div>
      <div><dt>Координаты</dt><dd>${formatRa(p.raDeg)} / ${formatDec(p.decDeg)}</dd></div>
    </dl>
    <p class="travel">Этот ритм шёл к Земле ${formatInt(years)} лет.</p>
  `;
}

function selectPulsar(p: PulsarInfo): void {
  current = p;
  audio.setPulsar(p);
  renderCard(p);
  switcher.querySelectorAll<HTMLButtonElement>('.pulsar-btn').forEach((b) => {
    b.classList.toggle('active', PULSARS[Number(b.dataset.index)] === p);
  });
}

// ---------- Кнопка звука ----------

const muteBtn = document.querySelector<HTMLButtonElement>('#mute')!;
muteBtn.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  muteBtn.textContent = audio.muted ? '🔇 звук выкл' : '🔊 звук вкл';
  muteBtn.setAttribute('aria-pressed', String(!audio.muted));
});

// ---------- Анимация пульсации ----------

const orbWrap = document.querySelector<HTMLElement>('.orb-wrap')!;
const freqValue = document.querySelector<HTMLElement>('#freq-value')!;
const strobeNote = document.querySelector<HTMLElement>('#strobe-note')!;

function frame(): void {
  const dt = secondsSinceEpoch(current, unixMsToMjd(Date.now()));
  const freq = frequencyAt(current, dt);
  const phase = phaseAt(current, dt);

  let intensity: number;
  if (freq < FAST_VISUAL_HZ) {
    // Прямой режим: вспышка в момент целой фазы, затем экспоненциальное затухание
    intensity = Math.exp(-(phase % 1) * 5);
    strobeNote.textContent = '';
  } else {
    // Стробоскопический режим: огибающая, замедленная до видимой частоты
    const slowdown = Math.ceil(freq / SLOWED_ENVELOPE_HZ);
    const slowPhase = (phase / slowdown) % 1;
    intensity = 0.35 + 0.65 * Math.exp(-slowPhase * 5);
    strobeNote.textContent = `огибающая замедлена в ${formatInt(slowdown)}×`;
  }
  orbWrap.style.setProperty('--pulse', intensity.toFixed(3));
  freqValue.textContent = `${freq.toFixed(freq > 100 ? 0 : 2)} Гц`;
  requestAnimationFrame(frame);
}

// ---------- Старт ----------

selectPulsar(current);
requestAnimationFrame(frame);
