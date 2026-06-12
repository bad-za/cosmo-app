// Переиспользуемый компонент пульсар-часов: монтируется в любой контейнер.
// Используется приложением pulsar-clock (на весь экран) и дашбордом (как оверлей).

import './clock.css';
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

export interface PulsarClock {
  selectPulsar(p: PulsarInfo): void;
  destroy(): void;
}

export function mountPulsarClock(container: HTMLElement, initial?: PulsarInfo): PulsarClock {
  const audio = new PulsarAudio();
  let current: PulsarInfo = initial ?? PULSARS.find((p) => p.name === 'B0833-45') ?? PULSARS[0]!;
  let alive = true;

  container.innerHTML = `
    <div class="clock-root">
      <section class="stage">
        <div class="orb-wrap">
          <div class="orb"></div>
          <div class="orb-ring"></div>
        </div>
        <div class="freq-label">
          <span class="freq-value"></span>
          <span class="strobe-note"></span>
        </div>
      </section>
      <aside class="clock-panel">
        <header class="panel-head">
          <h1>Пульсар-часы</h1>
          <button class="mute" aria-pressed="false">🔇 звук выкл</button>
        </header>
        <nav class="switcher"></nav>
        <article class="card"></article>
        <footer class="clock-source">данные: ${PULSAR_CATALOG_SOURCE}</footer>
      </aside>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => container.querySelector<T>(sel)!;

  // ---------- Переключатель ----------

  const switcher = $('.switcher');
  switcher.innerHTML = PULSARS.map(
    (p, i) => `
      <button class="pulsar-btn" data-index="${i}">
        <span class="pulsar-btn-name">${p.label}</span>
        <span class="pulsar-btn-period">${formatPeriod(p.periodSec)}</span>
      </button>`,
  ).join('');

  switcher.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pulsar-btn');
    if (btn) selectPulsar(PULSARS[Number(btn.dataset.index)]!);
  });

  // ---------- Карточка ----------

  function renderCard(p: PulsarInfo): void {
    const freq = frequencyAt(p, secondsSinceEpoch(p, unixMsToMjd(Date.now())));
    const years = lightTravelYears(p);
    $('.card').innerHTML = `
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

  const muteBtn = $<HTMLButtonElement>('.mute');
  muteBtn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    muteBtn.textContent = audio.muted ? '🔇 звук выкл' : '🔊 звук вкл';
    muteBtn.setAttribute('aria-pressed', String(!audio.muted));
  });

  // ---------- Анимация ----------

  const orbWrap = $('.orb-wrap');
  const freqValue = $('.freq-value');
  const strobeNote = $('.strobe-note');

  function frame(): void {
    if (!alive) return;
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

  selectPulsar(current);
  requestAnimationFrame(frame);

  return {
    selectPulsar,
    destroy(): void {
      alive = false;
      audio.setMuted(true);
      container.innerHTML = '';
    },
  };
}
